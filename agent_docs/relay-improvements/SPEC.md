# Relay Improvements: Polish, Context, Tools and Rich Replies (SPEC)

Status: Draft v1 (spec only, no feature code). Branch: feature/ai-agent. Extends `agent_docs/relay-agent/SPEC.md` (FR-1..FR-84). New requirements use FR-1xx so they never collide with that numbering.

## 1. Objective
Relay just shipped and has rough edges that make it feel unfinished: stale or unexplained UI, a thin tool set, no support for GraphQL/WebSocket/Socket.IO requests, and plain-text replies. This spec fixes 14 items in one pass.

Users: developers using Requestr who ask Relay to explain, build and manage their workspace.
Success:
- No stale or unexplained UI (context chips, suggestions, pills, send button).
- Every destructive or lossy action is confirmed in-chat.
- Relay can do anything the sidebar/tabs can, for every request type (HTTP, GraphQL, WebSocket, Socket.IO).
- Entities mentioned in replies open in one click.

Out of scope: server-side or local Whisper STT; changing model/provider; diff previews for edits; sending env values without the Share setting; dumping whole large collections into context.

## 2. Tech stack, commands, structure
Next.js App Router, React, Zustand (`src/stores`), shadcn UI, AI SDK (`ai` v6 line, `@ai-sdk/react` pinned), zod, Vitest, Playwright. Package manager is bun; never run npm.
- Test: `bun run test` (Vitest, specs next to source), targeted e2e only: `bunx playwright test e2e/<spec>`
- Lint/types: per task `bunx biome check <files>` and `bun run typecheck`; full `bun run lint:check` at phase gates and the full-gate `bunx tsc --noEmit` at TASKS P12.10
- Do not run the dev server (already running).

Touch points: `src/components/relay/*` (RelayComposer, ContextChips, EmptyState, RelayConversation, ConfirmCard, ToolRow, RelayMarkdown, RelayHeader, RelayOnboarding); `src/lib/relay/tools/*` (schemas, registry, requestWrite, collectionWrite, environmentWrite, chainWrite, destructive, workspaceRead, network, ui); `src/lib/relay/{chips,contextBuilder,redact}.ts`; `src/stores/{useRelayStore,useHistoryStore,useTabsStore}.ts`; `src/app/api/relay/chat/route.ts`; `src/app/{transform,json-compare,json-visualize}/page.tsx`; `messages/{en,fr,ja}/*.json`. New code goes in new files where it exceeds ~20 lines of JSX or ~30 lines of logic (repo style: one responsibility per function, named constants, no swallowed errors).

## 3. Functional requirements

### A. Loading and status feedback
- FR-101 While a turn is in flight and no assistant text has streamed, show a "Thinking…" line with a shimmer.
- FR-102 When tool calls start, the line becomes live tool steps derived from the tool name and input (e.g. "Reading dummy add…", "Searching workspace…"), one active step at a time, with a soft pulsing dot. Completed steps collapse into the existing ToolRow.
- FR-103 Step labels come from an i18n map keyed by tool name; unknown tools fall back to a generic "Working…". No vendor/model names.
- FR-104 All shimmer/pulse animation is disabled under `prefers-reduced-motion: reduce` (static text and dot remain). The indicator has `role="status"` and `aria-live="polite"`.

### B. Layout fixes
- FR-110 The "Jump to latest" pill has an opaque themed background, border and shadow, is positioned above the composer, and never overlaps message text illegibly (z-index above messages, sits in its own gutter).
- FR-111 The send button is inline on the right side inside the composer row, same row as the textfield; the "+" button sits to its left, and the mic button (FR-170) sits beside send. Row remains usable at the 320px minimum panel width.
- FR-112 Persistent muted footer line under the composer: "Relay is AI and can make mistakes. Check important changes." Not dismissible. Onboarding gets a one-time mention (add to an existing step or one line; no new step).

### C. Context (hybrid)
- FR-120 The current tab is auto-attached as ONE chip labelled "Using: <name> · current tab". Tooltip explains: Relay can see this tab's request, and the chip updates when you switch tabs. It is removable for the current turn.
- FR-121 The auto chip follows tab switches (derived live from `useTabsStore`), not captured once.
- FR-122 Starting a new conversation clears manually attached items and re-derives the auto chip from the current tab. No chips from the previous conversation survive.
- FR-123 Empty-state suggestions are recomputed from the current tab and reset on new conversation and tab switch (no stale suggestions for a previous request).
- FR-124 (Repo fact: `ContextChips.tsx` already derives chips via `useAvailableChips`/`computeContextChips` from tab, collection, environment and chain; extend it, do not duplicate.) A "+" button left of the textfield opens a searchable picker (shadcn Popover/Command) listing requests, collections, environments and chains, with kind filter. Typing `@` opens the same picker (shared component and hook), inserting a mention token and attaching the item as a chip.
- FR-125 The picker is virtualized and search-driven: it renders only a window of rows, searches via the existing workspace index, caps results (default 50) with "Keep typing to narrow results", and stays responsive with thousands of items.
- FR-126 Attached environment sends variable NAMES plus a has-value flag only. Values are sent only when the existing Settings "Share variable values with Relay" toggle (`shareValues`) is on, and variables with `isSecret: true` are always redacted regardless. The picker shows a "values hidden" note when sharing is off.
- FR-127 Attached collection sends a capped summary (names, methods, URLs), at most 50 items, then "…and N more — use search". Whole large collections are never sent.
- FR-128 Attached chips are removable, show exactly what is sent, and are keyboard reachable.

### D. Tab and bulk tools
- FR-130 `close_tab({tabId})` (kind auto if the tab's `isDirty` is false, confirm if true) and `close_all_tabs({includePinned?: boolean})`, built on `useTabsStore.closeTab/closeAllTabs`. Clean tabs close silently. "Pinned" means a tab whose `requestId` is in `pinnedRequestIds` (settings; pinning is per request in the sidebar, there is no tab-level pin). `close_all_tabs` SKIPS pinned tabs unless `includePinned` is true, which the model may set only when the user explicitly names pinned tabs. The result reports how many pinned tabs were kept open.
- FR-131 If any target tab has `isDirty` true, an in-chat ConfirmCard lists the dirty tabs and offers [Save all & close] [Discard & close] [Cancel], warning that unsaved work will be lost if discarded. Cancel returns "user declined" to the model.
- FR-132 `delete_requests({ids})` and `delete_requests_in_collection({collectionId})` are kind `destructive`: ConfirmCard shows the count and first N names, always requires confirmation. Existing single delete tools stay confirmed and unchanged.
- FR-133 Deleting an entity also closes its open tabs (existing behaviour preserved; if dirty, FR-131 applies).

### E. Request kinds: GraphQL, WebSocket, Socket.IO
- FR-140 Repo fact: saved `RequestModel` is HTTP-shaped (method/params/body) with no kind; GraphQL, WebSocket and Socket.IO exist only as `TabState` variants (`TabType`: http, graphql, websocket, socketio) in `useTabsStore`. New tools `create_graphql_request`, `create_websocket_request`, `create_socketio_request` and `update_tab_request` therefore open/edit tabs via `openTab`/`updateTabState`; existing `create_request`/`update_request` stay HTTP-only and unchanged. Saving these kinds into collections is out of scope (Assumption 11).
- FR-141 GraphQL (`GraphQLTab`): `name`, `url`, `query`, `variables` (JSON string, validated), `operationName`, `headers`, `auth`.
- FR-142 WebSocket (`WebSocketTab`): `name`, `url` (ws/wss), `headers`, and a compose `draft`. `draft` becomes an optional tab field (today it is component-local `useState` in `src/components/request/tabs/WebSocketTabs.tsx`) read/written via `updateTabState`. Subprotocols and saved messages are not in the tab model and are out of scope.
- FR-143 Socket.IO (`SocketIOTab`): `name`, `url`, `headers`, compose `draft` and `eventName` (default "message"), both new optional tab fields for the same reason as FR-142 (today component-local `useState` in `src/components/request/tabs/SocketIOTabs.tsx`). Listener registration is not in the model and is out of scope. Relay never connects or emits; it only prepares the draft.
- FR-144 Each schema is validated per kind; invalid input returns structured `{ok:false, error}` for model self-correction. A new read tool `get_tab_request({tabId})` returns kind-specific fields (redacted, `messageLog` capped to the last 20). Changes keep Undo behaviour from the relay-agent spec.
- FR-145 The system prompt/tool descriptions explain the kinds so the model picks correctly.

### F. History management
- FR-150 The history panel header gets a "⋯" overflow menu with "Export history" (submenu: JSON, HAR) and "Clear all history" (destructive red styling).
- FR-151 "Clear all history" opens a confirm dialog stating the count and that it cannot be undone; it only clears on confirm. Export triggers a browser download named `requestr-history-<date>.json|.har`.
- FR-152 HAR export follows HAR 1.2 and includes only HTTP and GraphQL history entries. WebSocket and Socket.IO entries are excluded and the UI shows a note with the exact excluded count (e.g. "3 WebSocket/Socket.IO entries were not included"; no note when 0). JSON export includes every entry. Repo fact: `HistoryEntry` currently models HTTP only (`request: HttpTab`), so today the count is 0; the filter keys off the entry's request `type` so it stays correct if other types are added. Exports are the user's own data and are not redacted; the menu description says so.
- FR-153 Tools `clear_history` (destructive, ConfirmCard) and `export_history({format: "json"|"har"})` (auto, triggers download) use the same functions as the menu (single implementation in a `src/lib/history` utility).

### G. Breadcrumb fix
- FR-160 `transform`, `json-compare`, `json-visualize` pages: the Home breadcrumb links to `/app` and its label uses the same `t("breadcrumbHome")` i18n pattern as the chain page (keys added to en/fr/ja where absent).

### H. Voice dictation
- FR-170 Mic button in the composer using Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`). Feature-detected on mount; hidden entirely where unsupported (e.g. Firefox).
- FR-171 Interim results stream into the textfield; final text is committed. Never auto-send: the user reviews and presses send.
- FR-172 States: idle, listening (pulsing indicator, `aria-pressed`, respects reduced motion), error. Permission denied or other errors show a clear inline message with a next step (e.g. "Microphone access is blocked. Allow it in your browser settings.") and the button returns to idle. Stopping is available by clicking the mic again or pressing Esc.
- FR-173 First use shows a short note: in some browsers speech is processed by the browser provider's online service. No vendor names.
- FR-174 Language follows the app locale (en, fr, ja).

### I. Rich formatting in replies
- FR-180 Entity references use a markdown link scheme: `[Name](relay://request/<id>)`, also `collection`, `environment`, `chain`. RelayMarkdown renders these as clickable pills (method badge for requests + name, kind icon otherwise) that open the entity in a tab (via `open_item` logic). Unknown or deleted ids render as plain text of the label (not a link).
- FR-181 Pills and entity/file-like references use the accent colour (Cursor-style). HTTP method tokens and status codes in prose get colour-coded inline (method colours reuse existing method badge tokens; status 2xx/3xx/4xx/5xx colour map reused from the response viewer). Colour is never the only signal (text is always present); contrast meets WCAG AA in light and dark.
- FR-182 The system prompt instructs the model to reference entities with `relay://` links using ids from tool results. The `relay://` scheme is sanitized: only the four kinds and id-pattern are accepted; all other schemes keep existing link sanitisation (no raw HTML rendering).
- FR-183 Code blocks: syntax highlighting (lazy-loaded highlighter, JSON/JS/TS/GraphQL/bash/HTML/XML at minimum), copy button, and an "Apply as ..." action adapting to the active tab type: HTTP -> "Apply as body", GraphQL -> "Apply as variables" (must be valid JSON, else disabled with a reason), WebSocket/Socket.IO -> "Apply as message" (sets the tab `draft`; never sends). Confirm-gated in chat; disabled with a tooltip when no request tab is active.

### J. Quality of life
- FR-190 Stop: a stop control replaces send while streaming and aborts the stream and pending tool (extends FR-20 of the relay-agent spec).
- FR-191 Regenerate last answer; Edit & resend last user message (replaces it and drops later messages); Copy message (plain markdown).
- FR-192 Thumbs up/down on assistant messages, recorded via the existing telemetry sink only (event `relay_feedback`, no prompt contents, no persistence of message text). (Superseded by relay-polish RP-226 (removed))
- FR-193 Slash commands: typing `/` at the start of the composer opens a command list: `/explain`, `/assert`, `/curl`, `/docs`, `/clear`. They expand to prompts bound to the current tab (`/clear` starts a new conversation after confirm when the thread is non-empty). `@` mentions share the picker from FR-124. Keyboard: arrows, Enter, Esc; `aria-activedescendant` listbox.
- FR-194 New tools:
  - `generate_tests({requestId})` (auto): builds assertions from the last response and applies them to the request's tests (Undo available).
  - `generate_docs({collectionId})` (auto, read-only): returns markdown documentation for a collection from the capped summary (FR-127), presented in chat with copy.
  - `import_curl({curl, collectionId?})` (auto) creates a request; `export_curl({requestId})` (auto, read-only) returns a curl command with secrets redacted.
  - `diff_responses({requestId, a, b})` (auto, read-only): compares two stored responses (status, headers, body structural diff, capped).
  - `rename_environment`, `rename_chain`, `move_item` extended to environments and chains where the sidebar supports ordering/folders (otherwise rename only; see Assumptions).
- FR-195 Contextual empty-state suggestions based on current tab: 4xx/5xx last response gives "Why did this fail?"; no request open gives "Create a request"; request with response gives "Add assertions"; GraphQL/WS/Socket.IO tabs get kind-specific prompts.
- FR-196 Follow-up suggestion chips (max 3) appear after an assistant answer, generated client-side from the last tool/result kinds (e.g. after a failing send: "Fix the request", "Explain headers"), not by an extra model call. They disappear when the user types or sends.

## 4. Non-functional requirements
Security and redaction
- NFR-1 Secrets: all new tool results, chips and exports pass through `redact.ts`; env values obey FR-126; no env values in chips, logs or telemetry.
- NFR-2 `relay://` parsing and "Apply as body" never execute content; no `dangerouslySetInnerHTML` on model output.
- NFR-3 Brand guard: no vendor/provider/model names in any user-visible string (speech note, errors, tooltips); the existing banned-token spec must pass over the new strings and fixtures.
- NFR-4 Tool gating preserved: reads and clean edits auto, lossy actions confirm, deletes/bulk/clear destructive. New tools must declare `kind` in the registry; a spec asserts every registered tool has one.

Performance and bundle
- NFR-5 Relay remains lazy-loaded: no new imports of Relay code, syntax highlighter or speech code from the main bundle. Highlighter loads on first code block. Verify with a before/after build route-size comparison (no growth in main chunks).
- NFR-6 Picker with 5,000 items: open < 150 ms, typing latency < 100 ms (virtualized).
- NFR-7 Chip and suggestion derivation is memoized from store selectors; no re-render of the whole conversation on tab switch.

Accessibility
- NFR-8 Everything is keyboard operable (picker, slash menu, mic, pills, menu). Visible focus rings, accessible names for icon buttons, `prefers-reduced-motion` honoured, AA contrast, touch targets >= 36px at mobile sheet width.

i18n and state
- NFR-9 All strings in `messages/{en,fr,ja}/*.json`; parity specs pass.
- NFR-10 Per repo CLAUDE.md, shared UI state (attached items, picker open, voice state if shared) lives in `useRelayStore` or a new `src/stores/use<Name>Store.ts`; component-local ephemeral state (slash-menu index) stays local. Persisted payloads contain no functions.

## 5. Testing strategy
- Vitest unit: tool schemas per kind (FR-140..144), close tab dirty/clean logic, bulk delete confirm gating, redact/env attach (FR-126), collection summary cap (FR-127), relay:// parser and sanitizer (FR-180/182), step-label map, suggestion derivation, HAR/JSON export builders, brand-guard and registry-kind specs.
- Component tests (Testing Library): composer layout/send inline, picker virtualization and search, chip reset on new thread and tab switch, jump-to-latest styles, speech states with a mocked `SpeechRecognition`, hidden when absent.
- Playwright (targeted specs only, never the full suite): loading phases, picker attach, close tabs confirm flow, history menu export/clear, breadcrumb links on three pages, pill click opens tab. Use agent-browser for visual checks.
- Skip tests for `src/components/reactbits/` per repo rule.
- Coverage policy: specs are written by dedicated `Unit:` tasks (unit-test-engineer, max 5 logic source files per batch). Every touched logic file reaches >= 80% lines/branches/functions/statements, target > 95%; the `vitest.config.ts` thresholds (global lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95) also gate scoped runs. `src/lib/historyExport.ts` is coverage-excluded and is covered by its own spec only. Component specs start with `// @vitest-environment happy-dom`.
- E2E tagging: each `E2E:` task owns one `e2e/qa/relay/relay-improvements-<area>.spec.ts` paired with its `e2e/scenarios/relay/<same>.feature.md`; test titles start with `[REL-…]` and carry exactly one priority tag via Playwright's tag option: `@critical` (core flow / data safety), `@high` (main AC behaviour), `@medium` (edge, empty, error, persistence cases).

## 6. Acceptance criteria
- AC-01 (FR-101..104) Sending a prompt shows shimmer "Thinking…", then labelled tool steps ("Reading <name>…") with a pulsing dot; with reduced motion emulated there is no animation; the region is announced politely.
- AC-02 (FR-110) With a long thread scrolled up, the Jump pill has an opaque background, border, shadow and no text shows through it in light/dark; screenshot check.
- AC-03 (FR-111) Send is in the same row as the textfield at 320px, 400px and mobile sheet widths; "+" left, mic and send right.
- AC-04 (FR-112) Footer line visible at all times under the composer; onboarding mentions AI can make mistakes once.
- AC-05 (FR-120, 121) Open request A: chip reads "Using: A · current tab" with tooltip. Switch to B: chip updates to B without user action.
- AC-06 (FR-122, 123) After "new conversation", attached items are gone, the chip reflects the current tab, and suggestions are for the current tab.
- AC-07 (FR-124, 125) "+" and `@` open the same picker; with 5,000 seeded requests it opens and filters within NFR-6 limits and renders a bounded number of DOM rows.
- AC-08 (FR-126) Attaching an env with Share off sends only names + has-value flags (assert on request payload); with Share on, non-secret values are sent and secret-type values are `[redacted]`; picker shows "values hidden" when off.
- AC-09 (FR-127) Attaching a 500-request collection sends at most 50 entries plus "…and 450 more — use search".
- AC-10 (FR-130, 131) Closing clean tabs is silent; `close_all_tabs` keeps tabs of pinned requests open and reports the kept count, closing them only when the user's message names pinned tabs; with one dirty tab the ConfirmCard lists it; Save all & close saves then closes, Discard & close closes without saving, Cancel leaves all tabs open.
- AC-11 (FR-132) `delete_requests_in_collection` always renders a destructive ConfirmCard with the count; nothing is deleted until confirmed; declining leaves data unchanged.
- AC-12 (FR-140..145) Asking for a GraphQL request opens a graphql tab with query/variables/operationName populated; likewise WebSocket (url, headers, draft) and Socket.IO (url, eventName, draft) tabs; `update_tab_request` edits only given fields; invalid variables JSON is rejected with a structured error; HTTP `create_request` is unchanged.
- AC-13 (FR-150..153) The history header ⋯ menu has Export (JSON, HAR) and a red Clear all; Clear needs dialog confirmation; exported HAR validates as HAR 1.2 JSON and, when WS/Socket.IO entries exist, omits them and shows the excluded count (JSON export keeps them); `clear_history` via chat requires ConfirmCard; `export_history` downloads a file.
- AC-14 (FR-160) On `/transform`, `/json-compare`, `/json-visualize` the Home breadcrumb href is `/app` and uses `breadcrumbHome`.
- AC-15 (FR-170..174) In a browser with SpeechRecognition the mic appears; speaking streams interim text to the textfield and nothing is sent automatically; denying permission shows the error message and resets; in a browser without it (or stubbed absent) no mic is rendered; the privacy note contains no vendor names.
- AC-16 (FR-180, 181) A reply containing `[GET users](relay://request/<valid id>)` renders a coloured pill with method badge that opens that request on click; an unknown id renders plain text; `javascript:` and unknown `relay://` kinds are not linkified; GET/POST and 404/500 tokens are colour-coded with text still present.
- AC-17 (FR-183) A fenced `json` block shows highlighting and Copy. The action reads "Apply as body" on HTTP, "Apply as variables" on GraphQL, "Apply as message" on WS/Socket.IO; each confirms, then updates only that field and never sends; invalid JSON disables the GraphQL action; no request tab disables it with a tooltip.
- AC-18 (FR-190, 191) Stop halts streaming mid-reply; Regenerate replaces the last answer; Edit & resend replaces the last user message and drops later messages; Copy puts markdown on the clipboard.
- AC-19 (FR-192) Thumbs click emits a `relay_feedback` event with rating and no message text; nothing is persisted. (Superseded by relay-polish RP-226 (removed))
- AC-20 (FR-193) Typing `/` shows five commands navigable by keyboard; `/explain` fills an explain prompt for the current tab; `/clear` starts a new conversation after confirm.
- AC-21 (FR-194) Each new tool is registered with a `kind`; `import_curl` on a sample curl creates the correct request; `export_curl` output contains no secret values; `diff_responses` reports status/header/body differences; `generate_tests` adds assertions (Undo restores).
- AC-22 (FR-195, 196) A tab with a 500 response shows "Why did this fail?"; an empty workspace/no tab shows "Create a request"; after an answer up to 3 follow-up chips appear and clear on typing.
- AC-23 (NFR-3, 9) Brand-guard and i18n parity specs pass for en/fr/ja including all new strings.
- AC-24 (NFR-5) Build route sizes show no main-bundle growth versus baseline; highlighter and speech code are in the lazy Relay chunk.
- AC-25 (NFR-8) Full keyboard walkthrough (picker, slash menu, mic, pills, history menu) is possible without a mouse; axe check on the panel reports no serious violations.

Traceability: A: FR-101..104 -> AC-01. B: FR-110 -> AC-02; FR-111 -> AC-03; FR-112 -> AC-04. C: FR-120..123 -> AC-05, AC-06; FR-124..128 -> AC-07..09. D: FR-130..133 -> AC-10, AC-11. E -> AC-12. F -> AC-13. G -> AC-14. H -> AC-15. I -> AC-16, AC-17. J: FR-190..192 -> AC-18, AC-19; FR-193 -> AC-20; FR-194 -> AC-21; FR-195..196 -> AC-22. NFRs -> AC-23..25.

## 7. Boundaries
Always
- Gate every new tool with `kind`; confirm anything lossy or bulk-destructive in chat.
- Redact via `redact.ts`; keep brand-guard clean; add en/fr/ja strings together.
- Keep Relay code lazy; specs come from each phase's Unit:/E2E: tasks; use bun.
Ask first
- Adding dependencies (syntax highlighter, virtual list library) beyond what is already installed.
- Changing the IndexedDB schema or the persisted `useRelayStore` shape.
- Adding optional `draft`/`eventName` fields to `WebSocketTab`/`SocketIOTab` (persisted tab shape).
- Changing system prompt structure or the chat route contract.
Never
- Send env values without Share on; send secret values at all; send whole large collections.
- Auto-send dictated text; render raw HTML from model output.
- Commit outside the /build-phases orchestrator (it commits once per phase after verifier PASS, user-confirmed); run the server or the full e2e suite; use npm.
- Name vendors/models in UI.

## 8. Assumptions
1. "Current tab" for non-request tabs (chain, tools pages) attaches the chain or nothing; pure utility pages attach no chip.
2. Syntax highlighting uses a lightweight lazy-loaded library; if one is already in the repo (e.g. CodeMirror/lowlight) it is reused (ask-first otherwise).
3. Virtualization uses an existing dependency if present, else a small hand-rolled windowing in the picker (ask first before adding a package).
4. "Save all & close" saves via the existing tab save path; tabs without a target collection use the existing save-as flow, and the card reports any that still need a destination.
5. Environments and chains have no folders/ordering in the sidebar, so `move_item` support for them is limited to reorder if present, else rename only.
6. `/docs` and `/curl` map to `generate_docs` and `export_curl` prompts on the current tab; `/assert` maps to `generate_tests`.
7. Feedback telemetry uses the existing no-op pluggable sink; nothing is stored. (Superseded by relay-polish RP-226 (removed))
8. HAR export maps HTTP/GraphQL history entries to HAR 1.2 `log.entries` (FR-152).
9. Speech language mapping: en-US, fr-FR, ja-JP.
10. Follow-up chips are static per result kind (no extra model call) for cost and latency.
11. GraphQL, WebSocket and Socket.IO requests stay tab-only (not saved to collections) because `RequestModel` has no kind.
12. Secrecy uses the existing `EnvVariable.isSecret` flag; dirty state is `TabState.isDirty`.
13. "Save all" reuses the existing tab save path; `useTabsStore` has none, so the implementer must locate it, and tabs without a `requestId` need a destination reported on the card.
14. Existing multi-step cap, rate limits and thread retention are unchanged.

## 9. Decisions
- D-1 `close_all_tabs` skips pinned tabs (requests in `pinnedRequestIds`) unless the user explicitly names them (FR-130, AC-10).
- D-2 The code-block apply action adapts to the active tab type: body / variables / message, confirm-gated (FR-183, AC-17).
- D-3 HAR export includes only HTTP and GraphQL entries with an excluded-count note; JSON export includes everything (FR-152, AC-13).

## 10. Open questions
None. Sign-off items are under Boundaries > Ask first.
