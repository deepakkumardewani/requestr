# Relay Agent: Phase 0 Spike Results

Internal document. Vendor and model names appear here only. All scratch code lived in the session scratchpad, never under `src/`, `messages/`, `e2e/` or `package.json`.

Environment facts: installed `ai` is 6.0.182 (package.json range `^6.0.174`, bun.lock pins 6.0.182), `@ai-sdk/deepseek` 2.0.35, `@ai-sdk/provider-utils` as pulled by `ai`. `@ai-sdk/react` is NOT installed (it is where `useChat` and `Chat` live). Next 16.1.6 (Turbopack), React 19.2.3, Tailwind 4, zod 4.3.6.

## A. Client tool API names and built-in approval (OQ-2)

Evidence paths are under `node_modules/ai/dist/` (`index.d.ts` = types, `index.js` = runtime) unless stated.

| Concern | Final name | Evidence |
| --- | --- | --- |
| Submit a tool result from the client | `addToolOutput({ tool, toolCallId, output })`, or `{ state: "output-error", errorText }` for failures | `index.d.ts:3744` |
| Deprecated alias | `addToolResult` (same behavior, do not use) | `index.d.ts:3917-3919`, `index.js:13256` |
| Client-side tool hook | `onToolCall: ({ toolCall }) => void \| PromiseLike<void>`; return value is ignored, results go through `addToolOutput` | `index.d.ts:3777`, option at `3826`; awaited mid-stream at `index.js:5809-5811` |
| Auto-continue after tool results | `sendAutomaticallyWhen: ({ messages }) => boolean \| PromiseLike<boolean>` | `index.d.ts:3841` |
| Ready-made predicate | `lastAssistantMessageIsCompleteWithToolCalls` | `index.d.ts:4116`, `index.js:13528` |
| Built-in approval flag | `needsApproval` on the tool definition | `@ai-sdk/provider-utils` `index.d.ts:1100` |
| Approval state and responder | part state `approval-requested`; `addToolApprovalResponse` | `index.d.ts:1725`, `index.d.ts:3726` |

Empirical results (real `Chat` class from `@ai-sdk/react@3.0.184`, mock and live models):

1. `void chat.addToolOutput(...)` inside `onToolCall` works: 2 requests, ends with assistant text.
2. `await chat.addToolOutput(...)` inside `onToolCall` DEADLOCKS. `addToolOutput` queues on the `SerialJobExecutor` (`index.js:10617`, `13225-13254`) behind the job that is awaiting `onToolCall`. Rule: never await it there.
3. A confirm-gated tool left unresolved: the stream finishes, status returns to `ready`, the part stays `input-available`. A later `addToolOutput` triggers the continuation request. `sendAutomaticallyWhen` stays false while any part is pending.
4. `addToolOutput` only updates the LAST message (`index.js:13232-13234`). Pending ConfirmCards must live in the last assistant message.
5. A part in `input-available` survives a JSON round trip and `validateUIMessages` accepts it, so a pending card can persist across reload.
6. Pending `input-available` part followed by a new user message: `streamText` throws `AI_MissingToolResultsError` (`index.js:1488`, thrown from `convertToLanguageModelPrompt`). `convertToModelMessages` itself does not throw. Two safe handlings, both verified: `convertToModelMessages(msgs, { ignoreIncompleteToolCalls: true })` (`index.js:8520`), or on reload auto-decline every pending part with `addToolOutput({ output: { ok: false, error: "user declined" } })` (auto-send then becomes true). This supports OQ-9.
7. Built-in approval emits a `tool-approval-request` chunk even for tools with no `execute` (verified with `MockLanguageModelV3`), but it is designed for server-executed tools.

Decision: keep the custom ConfirmCard (default). Reasons: it must show the target host/workspace item, pause across reload, carry our decline semantics, and execute client-side against Zustand stores. Built-in approval adds none of that and couples to server execution.

Step-cap finding: with client-executed tools every tool round trip is a NEW HTTP request, so server `stopWhen: stepCountIs(12)` restarts per request. FR-21's 12-step cap per user turn must be enforced by counting `step-start` parts since the last user message (server, and the client `sendAutomaticallyWhen` guard). Rate limiting must define per-turn versus per-request counting.

Verdict A: use `addToolOutput` (void, never awaited inside `onToolCall`), `sendAutomaticallyWhen`, custom ConfirmCard. Pin `@ai-sdk/react@3.0.184` exactly (see Amendments).

## B. Provider tool-calling quality, limits, abort, error shapes (OQ-1, OQ-4)

All numbers are from real provider calls using scratch scripts under `bun --env-file=<repo>/.env`. Key values were never printed.

Model id (`RELAY_MODEL_ID`):
- `deepseek-v4-flash`, `deepseek-flash`, `deepseek-v4-pro` and the legacy `deepseek-chat` all answered. The API reports `deepseek-v4-flash` as `deepseek-flash`; a bad-model error lists supported names `deepseek-flash`, `deepseek-v4-pro`.
- Pick `RELAY_MODEL_ID = "deepseek-flash"`. The retired legacy id still works today but must not be the default.

Thinking is ON by default (critical):
- Without options the flash model emits reasoning parts, and with a small `maxOutputTokens` the visible text came back empty.
- Non-thinking requires `providerOptions: { deepseek: { thinking: { type: "disabled" } } }` (`@ai-sdk/deepseek` `dist/index.js:309`, `474-488`). Verified: 0 reasoning parts.
- The existing `src/app/api/ai/route.ts` uses `deepseek("deepseek-v4-flash")` with no options, so it runs in thinking mode today. Relay must pass the option explicitly.

Tool catalog (38 tools, scratch `catalog.mjs`):
- Strict-compatible shape: every property required, optionals expressed as `.nullable()`.
- Input size about 5.4k to 6.4k tokens including the system prompt, roughly 22 to 26 percent of the 24k budget.
- 12-step loop with execute stubs, 18 prompts x 2 runs: 30 of 36 pass strictly (29 before adding chain fixtures). ZERO wrong-tool selections. The non-passes were fixture artifacts, or the model asked for confirmation in prose or called `ask_user` instead of calling `delete_*` / `run_chain`. Mitigation: system prompt rule "call the delete tool directly; the app shows the confirmation".
- Read-before-write flows took 2 to 8 steps, inside the 12 cap. A 12-step run ended with finishReason `tool-calls` after exactly 12 steps.
- Parallel calls: 3 `create_request` calls in one step. Client execution of parallel calls is sequential (FR-24).
- A prompt containing a literal secret was refused in text, in both runs.
- Strict mode on the `/beta` base URL with `strict: true` on all 38 tools also worked. v1 keeps strict off per spec; the schemas are already compatible if enabled later.
- First-token latency (non-thinking, with tools): p50 about 550 ms, max about 960 ms. Abort-route runs measured 442 to 600 ms.

Error shapes (map to the FR-70 taxonomy in `errors.ts`):

| Trigger | Shape observed | Map to |
| --- | --- | --- |
| Wrong API key | `APICallError`, status 401, `isRetryable: false`, body type `authentication_error`; message includes a masked key fragment and `request_id` | `not_configured` (server config problem; never forward the text) |
| Bad model | status 400, non-retryable, message names supported models | `not_configured` (server config problem) |
| Unreachable host | `statusCode` undefined, `isRetryable: true`, message "Cannot connect to API..." | `relay_unavailable` |
| 429 rate limit | NOT reproduced | `rate_limited` (mapped by status, unverified) |
| 402 / insufficient balance | NOT reproduced | `relay_unavailable` (mapped by status, unverified) |
| Context too long | NOT reproduced (a roughly 700k word prompt did not error, limit not reached) | `context_too_long` (unverified; enforced by the 24k budget client and server side) |
| Client abort | upstream abort within 1 to 2 ms | `aborted` |
| Browser offline | client-side `navigator.onLine`, no provider call | `offline` |
| Tool execution failure | client-side | `tool_failed` |

Leak check: the default `toUIMessageStreamResponse()` chunk types and response headers contain no vendor or model strings, BUT on error the default forwards the raw provider message as `errorText` (for example "Authentication Fails, Your api key: ****-000 is invalid (request_id: ...)"). An `onError: () => "relay_unavailable"`-style mapper is mandatory (FR-63, FR-70).

Abort (AC-18, FR-24): scratch Next 16.1.6 Turbopack dev app, route handler with `abortSignal: req.signal`, and a fetch wrapper timestamping the upstream abort. Five runs: client abort to upstream abort 1 to 2 ms, `onAbort` callback 1 to 6 ms, client stream closed 0 to 1 ms. All far under the 300 ms budget. This is a handler-level, localhost, dev-mode measurement. The UI-stop half (`useChat.stop` calls `abortController.abort()`, `index.js:13264`) is deferred to P2/P9 browser verification.

Go/no-go on the ~35-tool catalog: viable. Required mitigations: explicit non-thinking providerOptions; "call the delete tool directly" prompt rule; cross-request step counting; mandatory `onError` mapper. Fallback if selection degrades (for example after the catalog grows or schemas change): dynamic tool groups via `prepareStep` / `activeTools`, exposing a per-intent subset (requests, collections, environments, chains, navigation) per step.

Verdict B: go.

## C. Shortcut capture and workspace concept (OQ-3, OQ-5)

Existing code (`src/hooks/useKeyboardShortcuts.ts`):
- The listener is on `window` with `{ capture: true }` (line 319).
- `handleKeyDown` returns early on `isEditableTarget(e.target)` (line 210), so every shortcut, including any Relay case added to the switch, is ignored in inputs, textareas, `[contenteditable]`, `[role=textbox|combobox|searchbox]`, `.cm-editor` and `.monaco-editor` (selector list in `src/lib/isEditableTarget.ts`).
- FR-30 requires the toggle to work inside inputs, so the Relay handler must run BEFORE the `isEditableTarget` guard, while still skipping CodeMirror.
- Existing import binding: `case "i"` with `isCtrlOnly = e.ctrlKey && !e.metaKey` (lines 299-303) calls `handlers.onImportCollection` (routes to `/import`). It is UNCHANGED. Relay uses Cmd+I on Mac (`metaKey`) and Ctrl+Shift+L elsewhere, so there is no collision: Ctrl+I (no Shift, no Meta) remains import.

In-page probe (agent-browser against `http://127.0.0.1:3000/app`, capture and bubble listeners):

| Target | Meta+I | Ctrl+Shift+L | Ctrl+I |
| --- | --- | --- | --- |
| body | free (not prevented) | free | prevented by the app (import) |
| URL input | not prevented by the app (guard skips editable targets) | same | same |
| `.cm-content` | not prevented at capture, prevented at bubble (consumed by CodeMirror) | same | not prevented |

CodeMirror collisions: `src/components/request/CodeEditor.tsx:13,257` uses `basicSetup`. `@codemirror/commands` 6.10.3 binds `Mod-i` to `selectParentSyntax` with `preventDefault: true` (`dist/index.js:1777`); `@codemirror/search` 6.7.0 binds `Mod-Shift-l` to `selectSelectionMatches` (`dist/index.js:1047`). Both Relay bindings are consumed inside CodeMirror, consistent with FR-30 "unless an editor consumes it". Users reach Relay there through the header button or command palette.

Browser verdicts (synthetic CDP key events cannot prove browser-level capture, so these combine vendor docs and the in-page probe):

| Browser | Cmd+I (Mac) | Ctrl+Shift+L (Win/Linux) | Basis |
| --- | --- | --- | --- |
| Chrome | free | free | Support page 157179: reserved set is Cmd/Ctrl+L (address bar), Cmd+Shift+I is "email link" on Mac; neither binding is listed |
| Safari (Mac) | free | not applicable | Shortcuts page does not list Command-I or Shift-Command-L (Command-L is Smart Search) |
| Firefox | likely free, UNVERIFIED | UNVERIFIED, no evidence either way | SUMO page blocked automated fetch. From memory Cmd+I opens Page Info on Mac, which is not a reserved shortcut so a page can `preventDefault` it. Nothing is known about Ctrl+Shift+L. Needs a manual check in P9 |

Manual verification still required: Firefox on Mac and Windows, Safari on Mac, in a real window (not CDP).

SPEC consistency: SPEC section 6, FR-30 and AC-1 already agree (Cmd+I on Mac, Ctrl+Shift+L elsewhere). No change to the three together is needed.

workspaceId (OQ-5): no workspace entity exists. `grep -rniE workspace src` finds only labels (settings nav group at `src/app/settings/constants.ts:40,95`, landing copy, `MainLayout.tsx:155` aria-label, `ImportDialog.tsx:309`, `utils.ts:104` comment, `insomniaParser.ts:192`). No `workspaceId`, tenant, org or team exists in `src/`. `anonUser.ts` exposes only `getAnonUserId`; `useSettingsStore` has no workspace field; the 17 stores are chainHistory, useChainRunStore, useChainStore, useCollectionsStore, useConnectionStore, useDataSchemaStore, useEnvironmentsStore, useFolderExpandStore, useHistoryStore, useJsonCompareStore, useJsonVisualizeStore, usePlaygroundStore, useResponseStore, useSettingsStore, useTabsStore, useTransformStore, useUIStore. Decision: `workspaceId = "local"` constant.

Verdict C: go, with the pre-guard handler placement and the manual Firefox/Safari check.

## D. Dock mount, AI Elements install, rate-limit backend

Mount facts:
- `MainLayout` renders only on `src/app/app/page.tsx` and `src/app/chain/[collectionId]/page.tsx`. It is NOT on `/settings`, `/environments`, `/import`, `/transform`, `/json-compare`, `/json-visualize` or the landing page.
- `useKeyboardShortcuts` is called only from `MainLayout` (and `useChainCanvasShortcuts`); `CommandPalette` is mounted only in `MainLayout` and the chain page. So the shortcut and palette are absent from `/settings` today.
- `MainLayout` desktop branch (`MainLayout.tsx:139-176`) is a two-panel `ResizablePanelGroup` (left 20%, right 80% with `minSize="80%"`), shown at `md:` and above; below `md` it shows `MobileDesktopNotice`.
- `src/app/layout.tsx` wraps children in `NextIntlClientProvider` and `AppProviders` (`src/providers/AppProviders.tsx`: StoreHydrator, Toaster, TooltipProvider, ThemeAccentApplier). It is the only point common to every route.
- `ui/sheet.tsx` (133 lines, `@base-ui/react/dialog`) supports `side="right|bottom"`, default width `w-3/4 sm:max-w-sm`.

Decisions:
1. Dock mount: root-level, not a third `ResizablePanel`. A `RelayRoot` client component mounted in `AppProviders` owns the dock (desktop, fixed right aside; reserves space via a CSS variable on the body so content is pushed, not overlaid), the mobile sheet, the Relay shortcut handler and a Relay palette entry. This satisfies "reachable on every route" (FR-1, AC-2) including `/settings`. A third `ResizablePanel` would cover only `/app` and `/chain/*`.
2. Header button: there is no shared header. `AppBreadcrumb.tsx` (44 lines) is a plain list with no right slot and is used only by json-compare, json-visualize, transform and `ChainPageHeader`; it is not on `/app` or `/settings`. Place the `RelayToggleButton` (a) in the `LeftPanel` icon row beside Settings (`LeftPanel.tsx` around lines 120-143, pattern `data-testid="sidebar-settings-btn"`) for `/app`, and (b) via an optional `actions` slot on `AppBreadcrumb` for the pages that use it. Pages with neither (settings, environments, import) rely on the shortcut and palette entry from `RelayRoot`. This updates the TASKS default of `AppBreadcrumb.tsx` only; add `LeftPanel.tsx` to the relevant task Files.
3. Mobile (<md): `ui/sheet.tsx` with `side="bottom"`, height overridden to about 85vh. The app already shows a desktop-only notice on mobile, so the sheet is a graceful-degradation path, not a primary surface.
4. Reasoning component: NOT needed. Relay disables thinking (Spike B), so no reasoning parts are streamed; do not install AI Elements Reasoning.

AI Elements trial (rsync copy of the repo without `node_modules`, `.next`, `.git`; `bun install --frozen-lockfile`; then `bunx shadcn@latest add` of conversation, message, prompt-input, tool from the elements registry; style `base-nova`):
- `ai` stayed at 6.0.182; `@ai-sdk/react` was NOT pulled in. No ai v7 or `@ai-sdk/react` 4.x pulled.
- New dependencies added to package.json: `streamdown ^2.7.0`, `@streamdown/cjk ^1.0.4`, `@streamdown/code ^2.0.0`, `@streamdown/math ^1.0.3`, `@streamdown/mermaid ^1.0.3`, `shiki ^4.5.0`, `use-stick-to-bottom ^1.1.6`, and `cn ^0.4.0` (an unrelated npm package). `nanoid` was already present.
- DANGER: the install overwrote 11 existing `src/components/ui` files (button, separator, tooltip, input, textarea, dropdown-menu, select, badge, dialog, input-group, command), changed styling (for example the button `secondary` hover and `lg` padding) and rewrote the `cn` import from `@/lib/utils` to the `cn` npm package, dropping `"use client"`. It also added `button-group`, `collapsible`, `hover-card`, `spinner`. Never run the registry add against the real repo.
- `tsc` on the trial copy: `prompt-input.tsx` (1459 lines) has 7 type errors against base-ui (`BaseUIEvent` handler types, `openDelay`/`closeDelay` on the preview card). `conversation.tsx` (168 lines), `message.tsx` (360 lines) and `tool.tsx` (173 lines) type-check clean.
- `message.tsx` pulls streamdown with cjk/code/math/mermaid plugins; `mermaid` alone is 84 MB in node_modules and Relay does not need diagrams or math.
- Vendor strings in the installed AI Elements files: grep for deepseek, openai, anthropic, claude, gpt, gemini, ai-sdk, vercel returned nothing. The only coupling is `import type ... from "ai"` (`UIMessage`, `ChatStatus`, `FileUIPart`, `SourceDocumentUIPart`, `ToolUIPart`, `DynamicToolUIPart`), which is a type-only import in `src/components/ai-elements`, not a runtime provider import.

Recommended install approach: copy only conversation, tool and a trimmed message into `src/components/ai-elements/` by hand, rewriting `cn` to `@/lib/utils`, keeping `"use client"`, and replacing `Streamdown` with a minimal renderer or `streamdown` core without the cjk/math/mermaid plugins. Build the prompt input by hand on the existing `input-group.tsx` / `textarea.tsx`. Add only `use-stick-to-bottom` (and `streamdown` plus `shiki` only if code highlighting is wanted). Do not add `button-group`, `hover-card` or `spinner` unless used.

Scrub list (strings that must not reach client-reachable code, messages or fixtures): `deepseek`, `openai`, `anthropic`, `claude`, `gpt`, the value of `RELAY_MODEL_ID`, and user-visible strings or error text naming the provider. Provider hostnames and env var names are already covered by the `deepseek` token. The client hook `useRelayChat` legitimately imports `useChat` from `@ai-sdk/react`, so package names are NOT banned; only the provider package import is restricted to the server dir. The existing `/api/ai/route.ts` error text names it at about lines 20-23 and 303; that route is not Relay-owned and is left alone, but Relay's own errors must use generic text). Raw provider error text must never reach the client (Spike B `onError` mapper).

Rate-limit backend (FR-72): `.env` has `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` set (values not printed, file is gitignored via `.env*`) and `@upstash/redis` is installed. `src/lib/shareServer.ts` already implements the pattern (`enforceShareRateLimit`: atomic `incr`, then `expire` only on the first increment, with an injectable client type at lines 70-72 and an in-memory fallback for dev). Decision: reuse that counter pattern for Relay with a distinct key prefix; Redis is available.

Brand-guard scope: TASKS header defines BRAND_GREP as scoped to Relay-owned surfaces (relay and shortcuts/settings messages, `src/components/relay`, `src/components/ai-elements`, `RelaySection`, `src/lib/relay`, Relay hooks, `useAI.ts`, `src/app/settings`, `src/app/api/relay`, Relay e2e fixtures), excluding `src/lib/relay/server/**`, specs and `*.corpus.ts`. The P2.6 `brandGuard.spec.ts` says it scans all of `src/`. That is inconsistent: a repo-wide scan fails today on pre-existing text (`handleOpenAI` in `BodyEditor.tsx:64,131` and `ScriptEditor.tsx:74,192`, "OpenAI" in `landing/data/features.ts:116`, a "CLAUDE.md" comment in `PickerContext.tsx:16`, and the whole of `src/app/api/ai/route.ts` and its spec). Decision: the spec uses the same Relay-owned path list as BRAND_GREP, so both agree. Exclusions: only `src/lib/relay/server/**` and spec files. The provider package import and the legacy env alias live only in `src/lib/relay/server/model.ts`; the spec asserts the provider import appears nowhere else. Also `--exclude-dir=server` matches ANY directory named `server`; use the path-exact exclusion in the spec and keep the grep only over paths where the only `server` dir is `src/lib/relay/server`.

Verdict D: go.

## Amendments

Proposed changes to SPEC.md, PLAN.md and TASKS.md. None have been applied; each needs user approval.

Status: amendments 1 (dependency pin, decided: stay on the v6 line, pin `@ai-sdk/react@3.0.184`) and 10 (mount point, landing `/` confirmed out of scope) are APPLIED to SPEC.md, PLAN.md and TASKS.md (P1.5, P2.7). Amendments 2, 4, 5, 6, 8, 9, 11, 12, 13, 14 are also APPLIED (P1.7, P2.1, P2.2, P2.3, P2.5, P2.6, P2.8, ConfirmCard task, P4.9, P9.11, SPEC FR-21/FR-24/FR-72). Amendments 3 and 7 were already covered by the docs and need no edit.

1. Dependency pin: add `@ai-sdk/react@3.0.184` exactly (it depends on `ai` 6.0.182). Never run a bare `bun add @ai-sdk/react`, which resolves to 4.x and `ai` 7. Update references to `ai@6.0.174` to 6.0.182 (installed).
2. Non-thinking is mandatory: pass `providerOptions.deepseek.thinking = { type: "disabled" }` in the Relay model call. The existing `/api/ai` route is in thinking mode; Relay must not inherit that.
3. `RELAY_MODEL_ID = "deepseek-flash"`; the legacy id `deepseek-chat` still works but is retired.
4. The 12-step cap (FR-21) must count `step-start` parts since the last user message, not rely on `stopWhen: stepCountIs(12)` alone, because each client tool round trip is a new request. Define rate limits per user turn versus per request.
5. Never `await addToolOutput` inside `onToolCall` (deadlock). Call `void chat.addToolOutput(...)`.
6. On reload with a pending `input-available` card, either auto-decline via `addToolOutput` (preferred, resolves OQ-9) or call `convertToModelMessages` with `ignoreIncompleteToolCalls: true`; otherwise the next user message throws `AI_MissingToolResultsError`. Pending cards must be in the last assistant message.
7. An `onError` mapper on the stream response is mandatory: default `errorText` leaks masked key fragments and request ids.
8. System prompt rule: call `delete_*` and `run_chain` directly; the app shows the confirmation. Do not confirm in prose and do not use `ask_user` for confirmation.
9. FR-30: the Relay shortcut handler runs before the `isEditableTarget` guard in `useKeyboardShortcuts.ts`; both bindings are consumed by CodeMirror (accepted, per FR-30 wording). The existing Ctrl+I import binding is unchanged.
10. Mount: SPEC FR-1 already says "mounted in root layout"; TASKS/PLAN assumptions about `MainLayout` must follow it. Relay shortcut, palette entry and dock go in a root-level `RelayRoot` in `AppProviders`, because `MainLayout` is only on `/app` and `/chain/[collectionId]`. `AppProviders` also wraps the landing page `/`; gate `RelayRoot` by pathname so the landing page has no Relay UI (open point for the user: confirm landing is out of scope). Add `LeftPanel.tsx` (and an `actions` slot on `AppBreadcrumb.tsx`) to the Files of the header-button task, since `AppBreadcrumb` is not on `/app` or `/settings`.
11. AI Elements: do not run `shadcn add` in the real repo (overwrites 11 `ui` files and rewrites the `cn` import). Hand-copy conversation, tool and a trimmed message; build the prompt input by hand (the registry `prompt-input.tsx` has 7 type errors under base-ui). Skip Reasoning. Avoid the mermaid/math/cjk streamdown plugins.
12. Brand guard: `brandGuard.spec.ts` must scan the same Relay-owned path list as BRAND_GREP, not all of `src/` (a repo-wide scan fails on pre-existing `handleOpenAI`, landing copy, a CLAUDE.md comment and `/api/ai`). Drop the `*.corpus.ts` exclusion from BRAND_GREP: the redaction corpus shapes (for example `sk-ant-...`, `sk-proj-...`) contain none of the banned words, so P0.4's two exclusions (`src/lib/relay/server/**` and spec files) suffice; if a corpus entry ever needs a banned word, build it from a split string at runtime. Also replace `--exclude-dir=server` with the exact server path where possible.
13. Unverified error shapes: 429, 402 and context-too-long were not reproduced; `errors.ts` must map by HTTP status and default to `relay_unavailable`.
14. Manual checks pending in P9: Firefox (Mac, Windows) and Safari (Mac) key capture in real windows; UI stop (`useChat.stop`) timing against the 300 ms budget in a browser.

GO
