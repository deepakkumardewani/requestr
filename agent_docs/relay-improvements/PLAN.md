# Relay Improvements: Implementation Plan

Spec: `agent_docs/relay-improvements/SPEC.md` (FR-101..196, NFR-1..10, AC-01..25, D-1..3). Extends `agent_docs/relay-agent/PLAN.md`. Plan only; no feature code. Package manager is bun. Targeted e2e only. Never run the server or the full e2e suite. Compile check: every implementation task runs `bun run typecheck` (`tsc --noEmit`); the full-gate `bunx tsc --noEmit` run with the whole vitest/e2e/lint sweep is TASKS P12.10. Lint is `bun run lint:check` (there is no `lint` script). The `T#.#` ids in section 3 are a phase outline; `TASKS.md` ids (`P#.#`) are authoritative for scope, files, ordering and dependencies.

## 1. Grounding (repo facts verified by grep/ls)
- Relay UI: `src/components/relay/{RelayComposer,ContextChips,EmptyState,RelayConversation,ConfirmCard,ToolRow,RelayMarkdown,RelayHeader,RelayOnboarding,TurnChangeBar,ChangeCard,AskUserCard}.tsx`, each with a `.spec.tsx`.
- Relay lib: `src/lib/relay/{chips,contextBuilder,redact,telemetry,storeAccess,changeLog,tokenBudget,constants,openInRelay}.ts`; tools in `src/lib/relay/tools/{schemas,registry,requestWrite,collectionWrite,environmentWrite,chainWrite,destructive,workspaceRead,network,ui}.ts`; server in `src/lib/relay/server/{systemPrompt,bannedTokens,guard,model}.ts`; brand guard spec at `src/lib/relay/brandGuard.spec.ts`; route at `src/app/api/relay/chat/route.ts`.
- Hook `src/hooks/useRelayChat.ts` already exposes `stop` and `regenerate`. FR-190/191 is wiring plus UI, not new plumbing. `useRelayChat.spec.ts` exists.
- Telemetry: `src/lib/relay/telemetry.ts` has `RelayEventMap` and a pluggable sink. `relay_feedback` is added to `RelayEventMap` (create the event; it does not exist yet). (Superseded by relay-polish RP-226 (removed))
- Stores in `src/stores`: `useTabsStore` (`closeTab`, `closeAllTabs`, `openTab`, `updateTabState`), `useSettingsStore` (`pinnedRequestIds`, `shareValues`), `useHistoryStore`, `useRelayStore`, `useEnvironmentsStore`, `useCollectionsStore`. Save path for tabs: `src/hooks/useSaveRequest.ts`; also `src/hooks/useCloseTabGuard.ts` (reuse for dirty-close logic; read it first).
- Dependencies already installed: `@tanstack/react-virtual` (picker virtualization), `cmdk` (picker/slash list), `codemirror` + `@codemirror/lang-{javascript,json,java,php,python}`. No GraphQL/HTML/XML grammar in package.json, so the highlighter either reuses CodeMirror with lazy imports plus a plain-text fallback for GraphQL/bash/XML, or needs an ask-first dependency (see Open Items).
- Breadcrumb: `src/app/{transform,json-compare,json-visualize}/page.tsx` hardcode `{ label: "Home", href: "/" }`. Chain page uses `t("breadcrumbHome")` with `/app` at `src/app/chain/[collectionId]/ChainPageHeader.tsx:100`; the key lives in `messages/{en,fr,ja}/chain.json`.
- Does NOT exist, must be created: `src/lib/history/` (export/clear utility), `get_tab_request`, all new tools, relay link parser, step-label map, voice hook, picker component, slash menu, `draft`/`eventName` tab fields, `relay_feedback` event. (Superseded by relay-polish RP-226 (removed))
- History panel: `src/components/history/HistoryList.tsx` (rendered by `src/components/layout/LeftPanel.tsx`), which already has an Export dropdown (CSV, JSON) built on `src/lib/historyExport.ts` (`exportHistoryAsCSV`, `exportHistoryAsJSON`, `downloadFile`, `buildExportFilename`, legacy prefix `requestly-history-`). The similarly named `src/components/chain/dialogs/picker/HistoryList.tsx` is the chain picker and is not touched. `HistoryEntry.request` is `HttpTab` today, so no WS/Socket.IO entries exist yet.
- Compose state: `src/components/request/tabs/WebSocketTabs.tsx` keeps `draft` in `useState`; `src/components/request/tabs/SocketIOTabs.tsx` keeps `eventName` (default "message") and `draft` in `useState`. `SocketIOTabs` has no spec yet.

## 2. Architecture by spec area

### A. Loading phases (FR-101..104)
- Pure function `deriveActivity(messages, status)` in `src/lib/relay/activity.ts` returns `thinking | {toolName, input}`. Labels via `src/lib/relay/stepLabels.ts` mapping tool name to an i18n key plus params (name from tool input). Unknown tool falls back to the generic key.
- New `RelayActivityIndicator.tsx` (role=status, aria-live=polite). Shimmer and dot are CSS classes gated by `motion-safe:`. Rendered by `RelayConversation` only when streaming with no assistant text. Completed steps stay in `ToolRow`.

### B. Layout (FR-110..112)
- `RelayComposer`: single flex row `[+] [textarea] [mic] [send]`, `min-w-0` on the textarea. Footer line is a separate muted element under the row (new i18n key). Jump pill gets opaque `bg-popover border shadow`, `z-20`, and is anchored to the scroll container's bottom gutter. Onboarding gets one added line in an existing step (no new step).

### C. Context (FR-120..128)
- Extend `chips.ts` / `ContextChips.tsx` (`useAvailableChips`, `computeContextChips` already exist; do not duplicate). The auto chip is derived live from `useTabsStore` via a selector (memoized, NFR-7) rather than captured. Manual attachments live in `useRelayStore` (shared UI state per NFR-10; non-persisted slice so the persisted shape is untouched, which avoids the ask-first item).
- `useRelayStore.newConversation` clears manual attachments (FR-122). Suggestions are computed from the current tab in `src/lib/relay/suggestions.ts` (pure; also used by FR-195/196).
- `contextBuilder.ts`: env attach emits names + has-value only unless `shareValues`; `isSecret` always redacted via `redact.ts`. Collection attach goes through a new `summarizeCollection(collection, cap=50)` (shared with `generate_docs`, FR-127/194). Constants (50, 20 log cap) in `constants.ts`.

### D. Tabs and bulk tools (FR-130..133)
- Tools in `src/lib/relay/tools/tabs.ts` (new, registered in `registry.ts`): `close_tab`, `close_all_tabs`. Pinned = tab whose `requestId` in `pinnedRequestIds`. Result includes `pinnedKept`. `includePinned` described in the schema as "only when the user explicitly names pinned tabs".
- Dirty targets raise a ConfirmCard variant (extend `ConfirmCard.tsx`, or a new `CloseTabsConfirmCard.tsx` if over ~20 lines) with three actions mapped to `save-all | discard | cancel`. Save path via `useSaveRequest`; tabs without `requestId` are reported on the card (Assumption 13).
- `delete_requests`, `delete_requests_in_collection` in `destructive.ts`; always destructive kind; ConfirmCard shows count + first N names. FR-133 behaviour is preserved and routed through the same dirty-confirm.

### E. Request kinds (FR-140..145)
- Schemas per kind in `schemas.ts` (zod discriminated by kind). Tools in new `src/lib/relay/tools/tabRequests.ts`: `create_graphql_request`, `create_websocket_request`, `create_socketio_request`, `update_tab_request`, read `get_tab_request` (redacted, `messageLog` last 20). All go through `openTab`/`updateTabState` and `changeLog` for Undo.
- Add optional `draft` (WebSocketTab, SocketIOTab) and `eventName` (SocketIOTab) to the tab types in `src/types/index.ts`; refactor `src/components/request/tabs/WebSocketTabs.tsx` (`draft`) and `src/components/request/tabs/SocketIOTabs.tsx` (`draft`, `eventName`) compose state from local `useState` to `updateTabState` (small, tested). This is an ask-first item (persisted tab shape).
- GraphQL `variables` validated as JSON; ws/wss URL validated. `systemPrompt.ts` gets a short kinds section (FR-145).

### F. History (FR-150..153)
- Reuse `src/lib/historyExport.ts` for JSON and download (`exportHistoryAsJSON`, `downloadFile`); `buildExportFilename` moves to the SPEC prefix `requestr-history-<date>.<ext>` and gains `har`. New `src/lib/history/{exportHar,exportHistory,clearHistory}.ts`: the HAR 1.2 mapper filters on entry request `type` and returns `{har, excludedCount}`; `exportHistory(format)` (`"json" | "har"`) is the single facade the menu and tools call (FR-153); the menu's kept CSV item calls the existing `exportHistoryAsCSV` directly (CSV is outside the SPEC).
- UI: `src/components/history/HistoryActionsMenu.tsx` replaces the existing Export dropdown in `HistoryList.tsx` (shadcn DropdownMenu with Export submenu JSON/HAR, existing CSV kept, red Clear) and `ClearHistoryDialog.tsx` (AlertDialog with count). Menu exports cover the full history, matching the tool. Tools `clear_history` (destructive) and `export_history` (auto) in new `tools/history.ts`.

### G. Breadcrumb (FR-160)
- Three pages use `useTranslations`, `href: "/app"`, `t("breadcrumbHome")`. The key lives in `chain.json` today. Decided (TASKS Decisions): add `breadcrumbHome` to `messages/{en,fr,ja}/navigation.json` and use `useTranslations("navigation")` in the three pages; the chain page is untouched.

### H. Voice (FR-170..174)
- `useSpeechDictation.ts` (hook, feature-detect in `useEffect` to avoid SSR/hydration mismatch) returns `{supported, state, start, stop, error}`. `MicButton.tsx` renders null when unsupported. Interim text kept in a ref and merged with the base draft; never auto-send. Esc stops. Language from the locale map (en-US, fr-FR, ja-JP). Privacy note shown once per session via component state (decided; no storage, no schema change).
- Code stays under the lazy Relay chunk (composer is already lazy); the hook uses no external lib.

### I. Rich replies (FR-180..183)
- `src/lib/relay/entityLinks.ts`: `parseRelayHref(href)` allows only `request|collection|environment|chain` + id regex; `resolveEntity(kind,id)` via stores. `RelayMarkdown` gets a custom `a` renderer: `EntityPill.tsx` for valid links; plain label for unknown ids or kinds; other schemes keep existing sanitisation. `openEntity` shares logic with `open_item` (extract to `ui.ts` helper).
- Colour: `tokenize.ts` rehype/text-node pass that wraps `GET|POST|...` and 3-digit status codes in spans reusing existing method/status colour tokens (grep for the existing method badge + response viewer maps; do not redefine).
- Code blocks: `CodeBlock.tsx` with `React.lazy` highlighter (CodeMirror static highlight, first block triggers load), copy button, `ApplyCodeAction.tsx` adapting to active tab type (HTTP body / GraphQL variables with JSON validation / WS+SIO `draft`). Apply goes through a ConfirmCard and `updateTabState`; never sends.
- `systemPrompt.ts`: instruct `relay://` usage with ids from tool results; update `systemPrompt.spec.ts`.

### J. QoL (FR-190..196)
- Composer shows Stop while `status` is streaming (calls `useRelayChat.stop`). Message actions bar `MessageActions.tsx`: copy, regenerate (last assistant only), thumbs (emits `relay_feedback` with rating only). Edit & resend on last user message: trim `messages` via `setMessages`, then `sendMessage`. (Superseded by relay-polish RP-226 (removed))
- `SlashMenu.tsx` + shared `RelayPicker` (Phase 3): listbox with `aria-activedescendant`. Command table `slashCommands.ts` (`/explain /assert /curl /docs /clear`) maps to prompt templates bound to the current tab. `/clear` uses confirm.
- New tools (FR-194) in `tools/smart.ts`: `generate_tests`, `generate_docs`, `import_curl`, `export_curl`, `diff_responses`; extend `rename_environment/rename_chain/move_item` in existing write files (rename only where no ordering exists, Assumption 5). Pure helpers in `src/lib/relay/curl.ts` (parse/export, redacted) and `responseDiff.ts`.
- Follow-up chips: `followUps.ts` pure map from last tool/result kinds to up to 3 chips; cleared on input/send.

## 3. Phases (vertical slices; each ends demoable and green)

### Phase 0: Quick wins (independent, parallelizable)
- T0.1 Breadcrumb: three pages use `/app` + `t("breadcrumbHome")`, i18n en/fr/ja. FR-160, AC-14. XS/S. Test: page-level spec asserting href; targeted e2e link check.
- T0.2 Jump-to-latest restyle (opaque, border, shadow, z-index, gutter). FR-110, AC-02. XS. Test: `RelayConversation.spec.tsx` class assertions + seeded QA spec computed-style and stacking checks in light/dark (agent-browser only for exploration, never evidence).
- T0.3 Inline composer row with send right and space for "+"/mic placeholders. FR-111, AC-03. S. Test: `RelayComposer.spec.tsx`, seeded QA spec bounding-box check at 320px/400px/mobile (full "+"/mic/send row re-checked in Phase 12).
- T0.4 AI mistakes footer + one-line onboarding mention. FR-112, AC-04. XS. Test: composer/onboarding specs, brand guard spec.
- Checkpoint 0: `bun run test` for touched specs, `bun run lint:check`, i18n parity spec, seeded QA spec (REL-LAYOUT).

### Phase 1: Loading and status feedback
- T1.1 `deriveActivity` + `stepLabels` + i18n + unit tests (unknown tool fallback). FR-101..103.
- T1.2 `RelayActivityIndicator` (shimmer, pulse, reduced motion, role=status) wired into `RelayConversation`. FR-104, AC-01. Test: component spec with mocked messages; reduced motion is asserted in the component spec via `motion-safe:` gating (TASKS P1.3); the seeded QA spec REL-LOAD covers the phased status line.
- Checkpoint 1.

### Phase 2: Live context chips, resets, contextual suggestions
- T2.1 Auto current-tab chip with tooltip, live from `useTabsStore`, removable per turn; manual attachments slice in `useRelayStore`; reset on new conversation. FR-120..122, 128, AC-05, AC-06.
- T2.2 `suggestions.ts` + `EmptyState` rewire (reset on tab switch/new thread; kind-aware prompts for GraphQL/WS/SIO). FR-123, 195, AC-06, AC-22 (empty/5xx part).
- T2.3 Context builder: env names-only unless `shareValues`, secrets always redacted, `summarizeCollection` cap 50. FR-126, 127, NFR-1, AC-08, AC-09. Test asserts the actual chat request payload.
- Checkpoint 2: redact corpus spec still green; new payload specs.

### Phase 3: Picker (+ / @) and slash commands
- T3.1 `RelayPicker` (Popover + cmdk + `@tanstack/react-virtual`, kind filter, cap 50, "values hidden" note) and `useRelayPickerItems` over the existing workspace index. FR-124..126, NFR-6, AC-07. Test: 5,000 seeded items, bounded DOM rows, timing assertions kept loose.
- T3.2 `@` trigger in composer inserting mention token + chip; "+" button wired. Keyboard access. FR-124, 128, NFR-8.
- T3.3 Slash menu and command table (`/explain /assert /curl /docs /clear`). FR-193, AC-20. `/assert`, `/curl`, `/docs` prompts reference tools delivered in Phase 11; they work as plain prompts earlier.
- Checkpoint 3: targeted e2e `picker attach`.

### Phase 4: Tab and bulk tools
- T4.1 `close_tab`/`close_all_tabs` with pinned skipping and `pinnedKept`. FR-130, D-1, AC-10 (clean/pinned).
- T4.2 Dirty-close ConfirmCard (Save all & close / Discard / Cancel) incl. destructive wiring for FR-133. FR-131, 133, AC-10.
- T4.3 `delete_requests`, `delete_requests_in_collection` destructive with count and names. FR-132, AC-11.
- Checkpoint 4: gating/registry specs (every tool has `kind`, NFR-4), targeted e2e `close tabs confirm`.

### Phase 5: GraphQL, WebSocket, Socket.IO tab tools
- T5.1 Tab model: optional `draft`/`eventName`; refactor `WebSocketTabs.tsx` to store draft in tab state. Ask-first sign-off needed before starting. FR-142, 143.
- T5.2 Schemas + `create_*_request` tools (opens tabs, Undo). FR-140, 141, 142, 143, 144.
- T5.3 `update_tab_request` and `get_tab_request` (redacted, last 20 messages); system prompt kinds section. FR-144, 145, AC-12. Test: invalid variables JSON returns `{ok:false,error}`; HTTP `create_request` unchanged.
- Checkpoint 5.

### Phase 6: Rich replies, part 1 (pills and colour)
- T6.1 `entityLinks.ts` parser + sanitizer; `RelayMarkdown` `a` renderer; `EntityPill`; unknown id falls back to text. FR-180, 182, NFR-2, AC-16. Test: `javascript:` and unknown kinds not linkified.
- T6.2 Method/status colour tokens in prose reusing existing tokens; accent colour for pills and file-like refs; AA contrast check. FR-181.
- T6.3 System prompt `relay://` instruction. FR-182. Test: `systemPrompt.spec.ts`, brand guard.
- Checkpoint 6: targeted e2e `pill click opens tab`.

### Phase 7: Rich replies, part 2 (code blocks)
- T7.1 Lazy `CodeBlock` with highlighter + copy; bundle-isolated. FR-183, NFR-5.
- T7.2 `ApplyCodeAction` per tab kind (body / variables / message), confirm-gated, disabled states with tooltips. FR-183, D-2, AC-17. Depends on Phase 5 (`draft`).
- Checkpoint 7: build route-size comparison vs baseline (AC-24 part).

### Phase 8: QoL: stop, regenerate, edit, copy, feedback, follow-ups
- T8.1 Stop control replaces send while streaming. FR-190, AC-18.
- T8.2 Message actions: copy markdown, regenerate, edit & resend last user message. FR-191, AC-18.
- T8.3 Thumbs + `relay_feedback` event in `RelayEventMap`. FR-192, AC-19. (Superseded by relay-polish RP-226 (removed))
- T8.4 `followUps.ts` chips. FR-196, AC-22.
- Checkpoint 8.

### Phase 9: History management
- T9.1 `src/lib/history` builders: JSON, HAR 1.2 with excluded count, clear, download. FR-152, 153. Test: HAR shape validated against required HAR 1.2 fields.
- T9.2 `HistoryActionsMenu` + `ClearHistoryDialog` in `src/components/history/HistoryList.tsx`. FR-150, 151, AC-13.
- T9.3 `clear_history` (destructive) and `export_history` tools. FR-153, AC-13.
- Checkpoint 9: targeted e2e `history menu export/clear`.

### Phase 10: Voice dictation
- T10.1 `useSpeechDictation` + `MicButton` (feature-detected, states, Esc, errors, locale). FR-170..172, 174, AC-15. Test with a mocked `SpeechRecognition`; absent case renders nothing.
- T10.2 Privacy note, first use (no vendor names). FR-173, NFR-3.
- Checkpoint 10: seeded QA spec with the `speechStub` fake `SpeechRecognition` (REL-VOICE); a real-browser dictation check is a manual user step logged in TASKS P10.6, not evidence.

### Phase 11: New smart tools
- T11.1 `curl.ts` + `import_curl`/`export_curl` (redacted). FR-194, AC-21.
- T11.2 `diff_responses` and `generate_tests` (Undo). FR-194, AC-21.
- T11.3 `generate_docs` (reuses `summarizeCollection`). FR-194.
- T11.4 `rename_environment`, `rename_chain`, `move_item` extensions. FR-194.
- Checkpoint 11: registry `kind` spec, redact corpus extended with curl cases.

### Phase 12: Hardening
- Full keyboard walkthrough and axe check (NFR-8, AC-25); en/fr/ja parity and brand guard sweep (AC-23); bundle comparison and lazy-chunk verification (NFR-5, AC-24); memoization/re-render audit (NFR-7); `@axe-core/playwright` is ask-first (Open item 5). `bun run lint:check` runs at every phase gate; every implementation task runs `bun run typecheck`, and the full-gate `bunx tsc --noEmit` runs at TASKS P12.10.

## 4. Dependency graph
```
P0 (independent) -> P1 -> P2 -> P3 -> P12
P2 -> P4 -> P12
P5 (tab model, ask-first) -> P7 (apply action)
P6 -> P7
P3 -> P11 (slash commands consume new tools)
P2 summarizeCollection (TASKS P2.5) -> P11 generate_docs (TASKS P11.7)
P8, P9, P10 independent of each other; any order after P0
```
Parallelizable in principle: P0 tasks; P9 and P10 with anything; P6 with P4/P5. TASKS.md deliberately serializes phases (each phase's first task depends on the previous checkpoint) so gates stay simple; that ordering is authoritative.

## 5. Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Bundle growth from highlighter, speech, picker | High | Lazy import in the Relay chunk only; no main-bundle import; before/after route sizes at Checkpoint 7 and P12 (NFR-5). Reuse CodeMirror and `@tanstack/react-virtual`; adding a package is ask-first. |
| Highlighter lacks GraphQL/bash/XML grammar | Med | Use available grammars plus plain-text fallback; request approval for a small lazy grammar if needed. |
| Env/secret leakage via chips, exports, `get_tab_request`, `export_curl` | High | All results pass through `redact.ts`; payload-level tests (AC-08); extend `redact.corpus.ts`. |
| Brand guard: vendor names in speech note, errors, tooltips | High | Write strings with the brand-guard spec running on en/fr/ja each phase; no provider names in fixtures. |
| Web Speech support and prefix differences (Firefox none; Safari prefixed) | Med | Feature-detect after mount; render nothing when absent; mocked-API tests for both global names. |
| Model emits wrong/unknown `relay://` ids or injection through link text | Med | Strict kind + id regex; resolve against stores; fallback to plain text; no HTML rendering (NFR-2). |
| Tab model change (draft/eventName) affects persisted tabs | Med | Optional fields only; ask-first sign-off; migration-free; spec for old persisted tabs without the fields. |
| Dirty-tab close flow loses work | High | Default Cancel focus; Save path reuses `useSaveRequest`; tests for each of the three outcomes; unsaved tabs without destination reported. |
| Picker slow with thousands of items | Med | Virtualize + cap 50 + memoized index; seeded 5,000 test (NFR-6). |
| Stop/regenerate leaves orphan pending tool calls | Med | Reuse existing `stopControllersRef` abort path in `useRelayChat`; test mid-tool abort. |
| Persisted `useRelayStore` shape change | Med | Keep new attachment/picker state in a non-persisted slice; if persistence is needed, ask first. |

## 6. Traceability (FR/NFR -> phase)
| Requirement | Phase |
|---|---|
| FR-101..104 | P1 |
| FR-110, 111, 112 | P0 |
| FR-120..122, 126..128 | P2 |
| FR-123 | P2 |
| FR-124, 125 | P3 |
| FR-130..133 | P4 |
| FR-140..145 | P5 |
| FR-150..153 | P9 |
| FR-160 | P0 |
| FR-170..174 | P10 |
| FR-180..182 | P6 |
| FR-183 | P7 |
| FR-190..192 | P8 |
| FR-193 | P3 (prompts finalized in P11) |
| FR-194 | P11 |
| FR-195 | P2 |
| FR-196 | P8 |
| NFR-1, 3, 4 | every phase; audited in P12 |
| NFR-2 | P6, P7 |
| NFR-5 | P7, P12 |
| NFR-6 | P3 |
| NFR-7 | P2, P12 |
| NFR-8 | every phase; audited in P12 |
| NFR-9 | every phase; parity in P12 |
| NFR-10 | P2, P3 |

AC mapping: AC-01 P1; AC-02..04 P0; AC-05, 06 P2; AC-07 P3; AC-08, 09 P2; AC-10 P4; AC-11 P4; AC-12 P5; AC-13 P9; AC-14 P0; AC-15 P10; AC-16 P6; AC-17 P7; AC-18, 19 P8; AC-20 P3; AC-21 P11; AC-22 P2 and P8; AC-23..25 P12.

## 7. Testing strategy
Per spec section 5. Specs are written by dedicated Unit:/E2E: tasks (unit-test-engineer / e2e-engineer); coverage >=80% per file, target >95%, plus the config thresholds. Implementation tasks only keep existing specs green (`bunx biome check` + touched specs); component specs use `// @vitest-environment happy-dom`; targeted seeded Playwright QA specs (`e2e/qa/relay/relay-improvements-<area>.spec.ts`) per checkpoint, never the full suite; these are the only browser evidence. agent-browser may be used for exploratory visual checks during implementation, never as evidence (planner convention; SPEC section 5's "agent-browser for visual checks" is read in that sense). Each checkpoint runs the touched specs, `registry`/`gating` specs, i18n parity and brand guard.

## 8. Open items needing sign-off before work starts
1. Add `draft`/`eventName` to persisted tab types (Phase 5.1).
2. Highlighter grammars beyond installed CodeMirror languages (Phase 7.1).
3. Resolved: Home breadcrumb key lives in `navigation.json` (TASKS Decisions).
4. Resolved: privacy-note "seen" flag is per-session component state, no schema change (TASKS Decisions).
5. `@axe-core/playwright` devDependency for the AC-25 axe check (TASKS P12.1).
