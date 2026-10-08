# Relay: Implementation Plan

Inputs: `SPEC.md` v2 (open questions resolved). Planning only. Conventions: bun/bunx only, never npm; server is already running; no commits unless asked; vitest `*.spec.ts(x)` beside source; Playwright per `agent_docs/chain-e2e` (Gherkin-first `.feature.md`, `@qa` tag, `seededPage`, hermetic route mocks, no `waitForTimeout`, `getByTestId` first). No tests under `src/components/reactbits/`.

## 1. Grounding (repo facts verified)
- AI route: `src/app/api/ai/route.ts` (action dispatch, `generateText`, `getDeepseek()` throws a message naming `DEEPSEEK_API_KEY`; catch at ~L300 inspects that string). Client: `src/hooks/useAI.ts` (+ spec). Consumers (get "Open in Relay"): `components/response/{ErrorExplainer,TransformPlayground,ResponsePanel,AssertionsTab}.tsx`, `components/request/{UrlBar,BodyEditor,ScriptEditor,HeadersEditor}.tsx`, `components/transform/TransformPage.tsx`.
- Layout: `src/components/layout/MainLayout.tsx` holds a desktop `ResizablePanelGroup` (left `LeftPanel`, right `RightPanel` in `<main id="app-main">`) plus an always-mounted `CommandPalette` (`components/common/CommandPalette.tsx`). The Relay dock fits as a third `ResizablePanel` to the right of `<main>` (>= md); mobile is a `ui/sheet.tsx`. Spec FR-1 says "root layout"; but `MainLayout` is the shell that owns panels and is not mounted on `/settings` etc., so Phase 0 decides root-layout portal vs MainLayout (default: a `RelayDock` mounted in `AppProviders`-adjacent shell, layout slot in MainLayout).
- Shortcuts: `src/hooks/useKeyboardShortcuts.ts` already binds Ctrl-only+I to Import collection; shortcut docs in `src/app/settings/constants.ts`, `components/settings/ShortcutsSection.tsx`, `components/layout/KeyboardShortcutsModal.tsx`, `messages/*/shortcuts.json`.
- Stores in `src/stores/` (no workspace concept; `workspaceId = "local"`). Undo pattern `src/stores/chainHistory.ts` (`createHistory`). UI prefs pattern: `useUIStore.ts` (`readPreference`/`writePreference`, `rq_*` keys).
- IndexedDB: `src/lib/idb.ts` (`getDB`), schema single source `src/lib/idbSchema.ts` (`IDB_VERSION = 5`, `IDB_STORES`), consumed by `e2e/fixtures/qaSeed.ts` and `scripts/build-qa-seed-js.ts` (`bun run qa:seed:build`).
- i18n: `messages/{en,fr,ja}/*.json` aggregated in `messages/*/index.ts`; `src/i18n/messages.ts`; parity specs `src/i18n/messages.parity.spec.ts`, `chainMessages.parity.spec.ts`. Settings: `src/app/settings/{page,SettingsPageClient,constants}`, `src/components/settings/*Section.tsx`, `SettingsNav.tsx`.
- Rate limit precedent: `src/lib/shareServer.ts` (`enforceShareRateLimit`, Redis counter), user id from `src/lib/anonUser.ts`.
- Store hydration: `src/providers/AppProviders.tsx` `StoreHydrator`.

## 2. Architecture
### 2.1 Server route `src/app/api/relay/chat/route.ts`
zod-validate body (256 KB cap) -> `relayGuard` (flag, key present, rate limit per user + IP) -> build system prompt (`systemPrompt.ts`, includes untrusted-data framing/injection guard) -> `streamText({ model: relayModel(), messages: convertToModelMessages(...), tools: toolSchemas (no execute), stopWhen: stepCountIs(12), maxOutputTokens: 4000, abortSignal: req.signal })` -> `toUIMessageStreamResponse({ onError })`. Non-thinking flash model only (FR-24); `RELAY_MODEL_ID` constant in `src/lib/relay/server/model.ts`; key `RELAY_API_KEY` (legacy `DEEPSEEK_API_KEY` alias read only server-side). `errors.ts` maps every failure to a Relay code (FR-70), strips provider headers/messages and provider metadata/model ids from streamed parts (so none reach the UI or IndexedDB), sets `Retry-After`. Logging without prompt contents. Also fix `/api/ai` error text to use the same sanitizer (shared `getRelayProvider()`); prompts of the existing actions move to `src/lib/relay/prompts/` for reuse.
### 2.2 Client tool registry `src/lib/relay/tools/`
One file per domain (`workspaceRead.ts`, `requestWrite.ts`, `collectionWrite.ts`, `environmentWrite.ts`, `chainWrite.ts`, `destructive.ts`, `network.ts`, `ui.ts`), each exporting `{ schema (zod 4, strict-compatible), kind: "read"|"write"|"confirm", run(input, ctx) }`; `registry.ts` builds the name map; `schemas.ts` exports schema-only definitions shared with the server (single source of truth, no store imports so it is server-safe). `run` operates on a `StoreAccess` interface (`storeAccess.ts`) over the Zustand stores, so tools are unit-testable with fakes (NFR-7). Every tool: validate -> re-check ids live (FR-43) -> apply -> capture inverse -> return `{ok,data}|{ok,error}` through `serializeResult` (redact + cap).
### 2.3 Change log and undo
`changeLog.ts` + IndexedDB `relay_changes`: record `{id, threadId, turnId, toolCallId, entity, entityId, before, afterHash, status}`. Undo applies inverse after a conflict check (current entity hash must equal `afterHash`, else blocked with reason, FR-44). Chain edits reuse `chainHistory.ts` patterns and `useChainStore` persist; no global undo added to stores. Batch inverse for bulk ops and "Undo all" per turn. Delete inverse snapshots include children.
### 2.4 Confirmation flow
Confirm tools do not resolve in `onToolCall`; the tool part stays `input-available` and `ConfirmCard` renders from part state (decision OQ-2 default; spike may swap to `needsApproval`). Approve runs the tool then `addToolOutput/addToolResult` (name from spike); Decline returns `"user declined"`. Cards show resolved host and flag host differing from the request's saved host. Pending cards at reload are auto-declined with a note (OQ-9). Stop aborts pending tools and chain run (`useChainRunStore` abort).
### 2.5 Redaction `src/lib/relay/redact.ts`
Two choke points: `contextBuilder` and `serializeResult`. FR-61 timing: the `shareValues` option and persisted store field land in P4; the Settings toggle UI lands in P8 and only flips that field. Redacts Authorization/Cookie/Set-Cookie headers, secret-typed env values, token/JWT/`sk-`/basic patterns, secret query params; keeps `{{var}}` names. Env secret flag from `useEnvironmentsStore`; "share variable values" setting default off. Corpus spec of secret shapes.
### 2.6 Context assembly and token budget `contextBuilder.ts`
System prompt + workspace summary (counts/names/ids) + active-context snapshot (from `useTabsStore`, `useCollectionsStore`, `useEnvironmentsStore`) + chip filter + history. `tokenBudget.ts`: cheap estimator (chars/4), 24k input cap, drop/summarize oldest turns, tool-result cap (4 KB head+tail, binary -> metadata, FR-52). Large lookups are tools (FR-51).
### 2.7 Persistence
`idbSchema.ts` -> `IDB_VERSION = 6`, new stores `relay_threads` (keyPath `id`, index `by-workspace` on `workspaceId`+`updatedAt`) and `relay_changes` (index `by-thread`); mirrored in `idb.ts` `RequestlyDB` types and `qaSeed.ts` (upgrade is additive; fail-soft to in-memory). `threadDb.ts`: CRUD, debounced upsert after each finished message, prune to 50 per workspace (FR-14), clear-all. `useRelayStore` holds panel UI state only (open, width `rq_relay_width`, open `rq_relay_open`, active thread id, draft chips) using the `useUIStore` preference helpers.
### 2.8 Dock UI
`src/components/relay/`: `RelayDock` (lazy via `next/dynamic`), `RelayHeader`, `RelayConversation`, `RelayComposer` (AI Elements PromptInput), `ContextChips`, `ToolRow`, `ChangeCard`, `ConfirmCard`, `ThreadList`, `PrunedNotice`, `EmptyState`, `RelayOnboarding`, `RelayMarkdown` (no raw HTML), `ResizeHandle`. AI Elements vendored to `src/components/ai-elements/` (Conversation, Message, PromptInput, Tool) and scrubbed for vendor strings; the Reasoning component is not installed (FR-24). Hooks: `useRelayChat` (useChat + DefaultChatTransport + onToolCall + sendAutomaticallyWhen), `useRelayShortcut`, `useOnlineStatus`.
### 2.9 "Open in Relay"
`openInRelay({prompt, context})` action on `useRelayStore`; shared `OpenInRelayButton` added next to the nine AI consumers; builds prompts from `src/lib/relay/prompts/`.
### 2.10 i18n and flag
New `messages/{en,fr,ja}/relay.json` registered in each `index.ts`; `src/i18n/relayMessages.parity.spec.ts` (mirrors chain parity). Flag `NEXT_PUBLIC_RELAY_ENABLED` read in one `src/lib/relay/flag.ts`; guards button, shortcut, palette entries, dock, settings section, and the route (404 + `not_configured`). Banned-token spec scans `src/`, `messages/`, route fixtures.

## 3. File inventory
NEW
- `src/app/api/relay/chat/{route.ts,route.spec.ts}`
- `src/lib/relay/{flag.ts,constants.ts,errors.ts,redact.ts,redact.corpus.ts,contextBuilder.ts,tokenBudget.ts,changeLog.ts,threadDb.ts,storeAccess.ts,openInRelay.ts,telemetry.ts}` (+ `.spec.ts` each; also `threadDb.migration.spec.ts`)
- `src/lib/relay/server/{model.ts,guard.ts,rateLimit.ts,systemPrompt.ts,bannedTokens.ts}` (+ specs; `bannedTokens.ts` is the single banned-token constant shared by the unit guard and e2e audit, excluded from the brand grep)
- `src/lib/relay/prompts/*` (moved from `/api/ai`; `index.ts` + spec)
- `.env.example` (does not exist today; documents `RELAY_API_KEY` and `NEXT_PUBLIC_RELAY_ENABLED` only)
- `src/lib/relay/tools/{schemas,registry,workspaceRead,requestWrite,collectionWrite,environmentWrite,chainWrite,destructive,network,ui}.ts` (+ specs; plus cross-tool `gating.spec.ts`, `hardening.spec.ts`, `coverage.spec.ts`)
- `src/stores/useRelayStore.ts` (+ spec)
- `src/hooks/{useRelayChat,useRelayShortcut,useRelayFocus,useOnlineStatus}.ts` (+ specs)
- `src/components/relay/*` (list in 2.8, plus `RelayToggleButton`, `ErrorBubble`, `PrunedNotice`, `TurnChangeBar`, `AskUserCard`, `OpenInRelayButton`, `lazyBoundary.spec.ts`), `src/components/ai-elements/*`, `src/components/settings/RelaySection.tsx`
- `messages/{en,fr,ja}/relay.json`, `src/i18n/relayMessages.parity.spec.ts`, `src/lib/relay/brandGuard.spec.ts`
- E2E: `e2e/scenarios/relay/{relay-shell,relay-chat,relay-threads,relay-write,relay-confirm,relay-privacy,relay-a11y}.feature.md` (+ `check-ids.sh`, modelled on `e2e/scenarios/chain/check-ids.sh`), `e2e/qa/relay/{relay-shell,relay-chat,relay-write,relay-confirm,relay-threads,relay-privacy,relay-a11y}.spec.ts`, `e2e/fixtures/{relayRoutes.ts,relayE2eHelpers.ts,seed/relay-e2e.json}`
- Spike only: `agent_docs/relay-agent/SPIKE.md`, scratch under the scratchpad (not committed to src)
MODIFIED
- `src/app/api/ai/route.ts` (sanitized errors, shared provider/prompts), `src/hooks/useAI.ts` (no vendor text)
- `src/lib/idbSchema.ts`, `src/lib/idb.ts`, `e2e/fixtures/qaSeed.ts`, regenerated `e2e/fixtures/qa-seed.init.js`
- `src/components/layout/MainLayout.tsx` (dock panel), `src/components/layout/RightPanel.tsx` only if needed, header button location (decide in P0; default MainLayout header/breadcrumb area `AppBreadcrumb.tsx`)
- `src/components/common/CommandPalette.tsx`, `src/hooks/useKeyboardShortcuts.ts`, `src/app/settings/constants.ts`, `src/components/settings/{ShortcutsSection,SettingsNav}.tsx`, `src/app/settings/SettingsPageClient.tsx`, `src/components/layout/KeyboardShortcutsModal.tsx`
- `messages/*/{index.ts,shortcuts.json,settings.json,navigation.json}`
- The nine AI consumer components in 1 (Open in Relay)
- `src/providers/AppProviders.tsx` (hydrate thread prefs / mount point), `.env.example` if present (`RELAY_API_KEY`, `NEXT_PUBLIC_RELAY_ENABLED`), `package.json` (any AI Elements deps via bun)
- `e2e/fixtures/qa.ts` (relay route mocks wired into `seededPage` if needed), `scripts/build-qa-seed-js.ts`, `src/lib/idb.spec.ts`, `src/app/api/ai/route.spec.ts`

## 4. Phases (vertical slices; each ends demoable)
### Phase 0: Spike (no production code)
Verify against installed `ai@6.0.174` and the real provider: (a) exact `useChat` tool API names (`addToolOutput`/`addToolResult`, `sendAutomaticallyWhen`, `needsApproval`) and whether built-in approval can replace cards (OQ-2); (b) ~35 tool schemas in one request, parallel calls, strict-compatible schemas, step loop on non-thinking flash, error shapes with a wrong key (OQ-1, OQ-4); (c) Cmd+I and Ctrl+Shift+L capture in Chrome/Firefox/Safari and over CodeMirror (OQ-3); (d) confirm no workspace concept (grep stores, share/import, settings) (OQ-5); (e) dock placement: root-layout vs `MainLayout` third `ResizablePanel` and mobile sheet; (f) AI Elements install under React 19/Tailwind v4 and vendor-string scrub; (g) streaming through Next 16 route and abort propagation (300ms, AC-18); (h) Redis availability for rate limit. Output `SPIKE.md` with go/no-go and any spec amendments. Demo: a throwaway script/page streaming a tool-calling turn. Gate: no phase starts before decisions recorded.
### Phase 1: Shell
Flag, `useRelayStore`, `RelayDock` (empty shell with resize, persistence, mobile sheet), header button with aria-expanded, shortcut, palette entries, settings shortcut docs, relay.json + parity, IndexedDB untouched. Covers FR-1..4, 30, 31, 80, 83 (shell strings). A new-thread keyboard shortcut is optional and out of scope (no FR requires it). Demo: open/close/resize via button, shortcut, palette; persists; flag off hides all. Tests: store spec, shortcut spec, shell e2e.
### Phase 2: Streaming chat, no tools
`/api/relay/chat`, model/guard/rate-limit/error mapping, system prompt with injection guard, `useRelayChat`, composer, streaming message list, Stop/Regenerate, markdown, error bubbles, offline notice, `/api/ai` sanitization, `RELAY_API_KEY`, brand-guard spec. FR-20, 21 (loop bound), 23, 24, 62, 63, 70-72. Demo: chat with Relay, stop, force 429/not-configured. Tests: route spec (mock model), error mapping, rate limit, brand spec, mocked-route e2e.
### Phase 3: Threads and persistence
`IDB_VERSION 6`, `threadDb`, thread list (search/rename/delete/confirm+undo toast), new thread, restore last, prune to 50, clear-all hook. FR-10, 11, 12, 14. Demo: reload restores; 51st thread prunes oldest. Tests: threadDb spec (fake-indexeddb as used in `idb.spec.ts`), migration spec, e2e persistence.
### Phase 4: Context, redaction, read tools
`redact.ts`, `contextBuilder`, `tokenBudget`, context chips, registry + schemas, read tools, `get_last_response`, empty-state suggested prompts. FR-13, 22, 40 (read), 43, 46, 50-52, 60, 61. Demo: "why did this 401?" explained from redacted last response; chip removal changes payload. Tests: redaction corpus, budget, each read tool, payload-inspection e2e (AC-14, 16).
### Phase 5: Write tools, Change Cards, Undo
`changeLog`, `relay_changes`, request/collection/env/open_item tools, ChangeCard, Undo / Undo all, conflict check, secret-write refusal (`set_request_auth` var-only, `set_env_variables` placeholders), ToolRow. FR-41, 44; AC-5..8. Demo: "create collection Orders with GET and POST /orders" then Undo. Tests: per-tool success/validation/undo, conflict, e2e AC-5/6/7.
### Phase 6: Confirm tools
ConfirmCard, `destructive.ts` deletes, `network.ts` send_request (via `useSendRequest`/apiExecutor path, FR-45), `run_chain`, bulk >10, `ask_user`, reload auto-decline, host-diff warning, injection tests. FR-42, 45; AC-9..11, 17. Demo: delete with child count then restore; approved send is summarized. Tests: gating spec (no execution before approval), e2e with injected response.
### Phase 7: Chain tools
`chainWrite.ts` (create_chain, add/update/connect nodes, delete node confirm), use `chainBlocks`/`chainSlice`/validation, `get_chain`, `get_chain_run`. AC-12, AC-10 (Stop aborts run). Demo: "after login extract token and call /me". Tests: validation-passing assertion, undo via chainHistory-style inverse, e2e with chain seeds.
### Phase 8: Entry points, settings, onboarding
`OpenInRelayButton` on nine consumers, `RelaySection` settings (enable, position, share values toggle, clear history, explainer), onboarding coach, telemetry hooks (no-op sink). FR-32, 81, 82, 84; AC-20. Demo: click Open in Relay on a failing request. Tests: component specs, settings e2e, existing `useAI` specs stay green.
### Phase 9: Hardening
A11y pass (live regions, focus, reduced motion, 44px targets), dark/light, virtualized thread list (>50 threads) and long message lists, bundle check (NFR-2), step indicator after step 6, daily soft cap, network brand audit e2e, final e2e suites, security review of tool args (URL scheme allowlist), `bun run lint` / typecheck at end only. AC-15, 18, 19, 21-23.

## 5. Dependency graph
```
P0 ──> P1 ──> P2 ──┬──> P3 ───────────────┐
                   └──> P4 ──> P5 ──> P6 ──┼──> P7 ──┐
                         P3 ──> P5 (threadId on changes)         ├──> P9
                   P1,P2,P4 ──> P8 (OpenInRelay needs chat+context) ┘
```
P3 and P4 can run in parallel after P2 (P5 needs both). P7 needs P5 and P6. P8 needs P2 and P4 (and P3 for threads). P9 needs all. Shared single-owner files: `idbSchema.ts` (P3), `messages/*/relay.json` (additive each phase), `registry.ts` (additive).

## 6. Testing strategy
- Unit (vitest, beside source): every tool (success, validation failure, undo/conflict), redaction corpus (JWT, `sk-`, basic auth, cookies, secret env), token budget, error mapping, rate limit, thread prune, IDB migration, `useRelayStore`, route with `MockLanguageModelV3`-style model; i18n parity; brand-guard scan.
- E2E (Playwright `@qa`, following `agent_docs/chain-e2e`): Gherkin-first in `e2e/scenarios/relay/*.feature.md` with one scenario ID per test titled `[REL-<AREA>-nn] ...`, ID-parity script, `seededPage`, a `relayRoutes.ts` mock for `/api/relay/chat` that streams scripted UIMessage chunks (no real provider), helpers file not page objects, no timeouts, console guard default. Covers AC-5, 6, 9, 10, 13, 15 required by AC-23 plus 1-4, 14, 16-19. AC-21 (flag off) is unit-tested only: `NEXT_PUBLIC_*` is build-time and the shared server is never restarted.
- Never run the server; use `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000`. Run typecheck only after a phase is fully done.
- Real-provider checks only in P0 and a manual smoke at P9.

## 7. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Tool API names/behaviors differ in ai 6.0.174 | P0 spike; isolate behind `useRelayChat` |
| 35 tools degrade non-thinking flash | Spike measure; dynamic tool groups; ask_user; small tools |
| Ctrl+I/Cmd+I collisions | FR-30 split bindings, verified in P0; central constant |
| `MainLayout` not on every route | P0 decides mount point |
| Vendor leak (errors, headers, i18n, AI Elements text, source) | `errors.ts`, brand spec incl. `src/components/ai-elements`, e2e network scan |
| Secret leakage | Two choke points, corpus, no secret tools |
| IDB version bump breaks seeds | Update `idbSchema` consumers together; regenerate seed; migration spec |
| Undo drift | afterHash conflict check |
| Abuse of shared key | Per-user+IP limit, caps, flag, daily cap |
| Bundle growth | `next/dynamic`, bundle check in P9 |

## 8. Traceability (FR/AC -> phase)
| Requirement | Phase(s) |
|---|---|
| FR-1,2,3,4 | P1 (P9 a11y polish) |
| FR-10,11,12 | P3 |
| FR-13 | P4 |
| FR-14 | P3 |
| FR-20 | P2 |
| FR-21 | P2 (loop), P9 (step indicator) |
| FR-22 | P4 |
| FR-23 | P2 |
| FR-24 | P0, P2 |
| FR-30,31 | P1 |
| FR-32 | P8 |
| FR-40 | P4, P5 |
| FR-41 | P5 |
| FR-42 | P6 |
| FR-43 | P4, P5 |
| FR-44 | P5 |
| FR-45 | P6 |
| FR-46 | P4 |
| FR-50,51,52 | P4 |
| FR-60,61 | P4 (shareValues logic + store); P8 (Settings toggle UI only) |
| FR-62,63 | P2 (P9 audit) |
| FR-70,71,72 | P2 |
| FR-80 | P1 (unit-tested; P2 route 404, P8 settings/button guards) |
| FR-81 | P8 |
| FR-82 | P8 |
| FR-83 | P1, each phase |
| FR-84 | P8 |
| AC-1 | P1 |
| AC-2,3,4 | P1 |
| AC-5,6,7,8 | P5 |
| AC-9,10,11 | P6 (AC-10 Stop-run also P7) |
| AC-12 | P7 |
| AC-13 | P3 |
| AC-14 | P4 |
| AC-15 | P2, P9 |
| AC-16 | P4 |
| AC-17 | P6 |
| AC-18 | P2 (verified P0, P9) |
| AC-19 | P2 (tool-failure P5) |
| AC-20 | P8 |
| AC-21 | P1 (unit specs; P2, P8 guards; no e2e by design) |
| AC-22 | P9 |
| AC-23 | all (unit per phase; e2e P1-P9) |
| NFR-1..8 | NFR-2 P1/P9, NFR-4 P2, NFR-5/7 P5, NFR-6 P9, NFR-8 all |
