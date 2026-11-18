# Relay v2: Implementation Plan

Inputs: `SPEC.md` (reviewed, 61 requirements, authoritative), `CONTEXT.md` (code findings), `grok-stt-docs.md`. Planning only, no feature code. TASKS.md is a separate step.

House conventions (inherited from relay-polish): bun/bunx only, never npm; never start the dev server; no commits unless the build-phases flow commits after the verifier PASS; vitest `*.spec.ts(x)` beside source; Playwright e2e at `e2e/qa/relay/`, base URL `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app`, a Gherkin scenario file (`e2e/scenarios/relay/`) added together with each spec, model mocked at `/api/relay/chat` via `e2e/fixtures/relayRoutes.ts`; typecheck once per completed phase, not mid-slice; no tests under `src/components/reactbits/`; Zustand stores in `src/stores/use<Name>Store.ts`; browser checks via the agent-browser skill only.

## 1. Grounding (facts that shape the plan)

- Existing infra to reuse: `e2e/fixtures/{relayRoutes,relayE2eHelpers,relayImprovements,speechStub,qaSeed,qa}.ts`, i18n parity specs in `src/i18n/{messages,relayMessages,chainMessages}.parity.spec.ts`, 40+ relay e2e specs under `e2e/qa/relay/`.
- Tiptap is NOT installed (`package.json` has no `@tiptap/*`). It is pre-approved (Assumption 7) and is added at the start of Phase 4 only.
- `IDB_VERSION` stays 6; no new stores. `RELAY_WORKSPACE_ID = "local"`.
- Hot files touched by many slices (serialise edits in the order given): `useRelayChat.ts`, `RelayComposer.tsx`, `RelayConversation.tsx`, `MessageParts.tsx`, `systemPrompt.ts`, `schemas.ts`/`registry.ts`, `useRelayStore.ts`, `messages/{en,fr,ja}/relayDock.json`.
- Tools run client-side across several HTTP requests, so per-turn timing is stamped on the client, not the server.

## 2. Architecture decisions

1. **Phase order is fixed as confirmed** (1 bugs, 2 sidebar, 3 conversation, 4 composer, 5 empty/popover, 6 backup, 7 tools, 8 STT), plus a short Phase 0 for harness prerequisites.
2. **Single seams, introduced once and reused:** `useRelayAvailable()` (S1.1); `buildAttachmentMetadata` + `buildAttachmentDetail` (S1.3, reused by Phase 4 segments and Phase 7 prompt); `formatDuration` + `deriveTurnSummary` (S3.1/S3.2); `summariseSteps` (S3.3); `src/lib/backup/secrets.ts` single secret-field list (S6.1, reused by TOOL-01 masking in S7.1); one WAV encoder (S8.2).
3. **Question card state machine (CONV-09) ships behaviour in Phase 1, placement in Phase 3.** The pure reducer is written once in S1.4; S3.3 only moves the stale line into the Worked group.
4. **Pull-forward:** STT-02 (status route + `useSttConfigured`) and the `speechEngine` store field (the data part of STT-06) land in S7.1 (TASKS T7.4) because `set_relay_preferences` must reject `grok` when STT is unconfigured. S8.4 owns the picker UI and fallback logic. Traceability notes this.
5. **Backup is a pure library first, UI second** (`src/lib/backup/*` has no React). Dialog state is local React state/Context, not a store (CLAUDE.md rule). The speech-engine pref is the only new persisted store field.
6. **Chat contract changes are limited to `metadata`** (Assumption 9): `attachments`, `segments`, `turn`. Older messages are stripped to refs in the outgoing body (one `prepareOutgoingMessages()` helper, extended per slice, not forked).
7. **Design gates are explicit first steps** of the slices that need them (see section 5).
8. **No dependency except Tiptap**; ask first for anything else.

## 3. Dependency graph (between phases and slices)

```
P0 harness ─────────────────────────────────────────────────────────────┐
P1: S1.1 availability ──► S7.1 settings tools, S7.x (enabled gate)      │
    S1.2 prompt rules ──► S1.3 (ATTACHED rules edit), S7.6 (TOOL-07)    │
    S1.3 attachments ──► S1.4 (shared send path) ──► P3 (bubble), P4 (segments)
    S1.5 picker ──► P4 (slash/target), P5 (starter flow)                │
    S1.7 method dropdown / S1.8 chevrons ──► S3.3 (Worked chevron)      │
P2 sidebar (independent of P1 except S1.8 chevrons in same files)       │
P3: S3.1 timing metadata ──► S3.2 live header ──► S3.3 Worked group ──► S3.4 summary ──► S3.5
    S3.6 neutral pills (independent; needed before P4 pills, P5)        │
P4: S4.1 Tiptap shell ──► S4.2 inline attach pills ──► S4.3 slash pills ──► S4.4 segments+bubble
P5: S5.1 empty state (needs S4.3, S1.5) ──► S5.2 popover (needs S1.2? no; needs Phase 7 later for new areas)
P6: S6.1 secrets+exporter ──► S6.2 validate+merge ──► S6.3 replace+reconcile ──► S6.4 export UI ──► S6.5 import UI+round trip
P7: S7.1 settings tools (needs S1.1, S1.x settings fixes) ──► S7.2 nav ──► S7.3 backup tools (needs P6) ──► S7.4 entity ops ──► S7.5 cards ──► S7.6 deny-list+capabilities
P8: S8.1 route ──► S8.2 capture/WAV ──► S8.3 hook ──► S8.4 picker+mic UI (needs S7.1 store field, S4.4 caret insert)
```

Parallel-safe: S3.6 with S3.1-S3.5; Phase 2 with Phase 1 tail (different files); S6.1-S6.3 with Phase 5 (pure lib vs UI); S8.1-S8.2 with Phase 7 (server route and encoder are independent of tools).

## 4. Phase 0: Prerequisites (3 slices)

### S0.1 Relay-v2 e2e harness
- **Reqs:** XC-01 (foundation).
- **Work:** extend `relayRoutes.ts` with scripted-stream builders for: message `metadata`, `ask_user` call, multi-step tool turns with delays, step-cap hit; request-body capture helper (assert last user message detail). Add `downloadCapture` helper (backup/export), `twoContexts` helper (BAK-06), IDB dump helper (`indexedDB` evaluate, per-store), computed-colour/contrast helper, fake-audio launch flags + `page.route` STT mock (builds on `speechStub.ts`).
- **AC:** each helper has a self-test spec or is exercised by the first consuming slice; no change to product code.
- **Verify:** `bun run lint:check`; run one existing relay spec to prove nothing regressed.
- **Files:** `e2e/fixtures/relayRoutes.ts`, `relayE2eHelpers.ts`, new `relayV2Helpers.ts`, `speechStub.ts`. **Size:** M.

### S0.2 Baseline and registry test helper
- **Reqs:** XC-01, BUG-03/TOOL-06 enabler.
- **Work:** record the green baseline by running only the XC-01 specs (list in section 8) before any change; add a shared `getRegisteredToolNames()` test util (used by BUG-03, TOOL-05, TOOL-06, TOOL-07 tests); confirm the three i18n parity specs cover `relayDock.json`, `relay.json`, `settings.json`, `common.json`, `errors.json` and extend if not (new namespaces are a spec requirement).
- **AC:** baseline pass/fail list recorded in the slice notes; parity specs fail when a key is missing in fr or ja.
- **Verify:** `bun run test -- src/i18n`; targeted XC-01 unit specs. **Files:** `src/lib/relay/tools/testUtils.ts` (new), `src/i18n/*.parity.spec.ts`. **Size:** S.

### S0.3 E2E prod-server mode and gitignore
- **Reqs:** XC-01 (test infrastructure, required by `~/.claude/docs/task-conventions.md`).
- **Work:** `playwright.config.ts` selects the web server by `E2E_SERVER=dev|prod` (default `dev`, `PLAYWRIGHT_TEST_BASE_URL` shortcut unchanged); `prod` builds and runs `next start` on a named port with `reuseExistingServer: false`; `next.config.ts` honours `E2E_DIST_DIR` (`.next-e2e`); document in `e2e/README.md`; `.gitignore` gains `.next-e2e` and `.dashboard/*/reports/` (`test-results/`, `playwright-report/`, `coverage/` already present).
- **AC:** both modes parse with `playwright test --list`; default behaviour unchanged. **Files:** `playwright.config.ts`, `next.config.ts`, `e2e/README.md` (new), `.gitignore`. **Size:** S. **Depends:** S0.2 baseline.

### Checkpoint P0
- [ ] Baseline recorded; helpers lint clean; parity specs cover all namespaces.

## 5. Design gates (must run before implementation of the slice)

| Slice | Skills, in order |
|---|---|
| S1.7 method dropdown | impeccable + layout |
| S3.2/S3.3 live header and Worked group, S3.6 pills | impeccable + layout |
| S3.4 change summary | layout |
| S5.1 empty state, S5.2 popover | impeccable + layout |
| S6.4/S6.5 backup export and import UI | ui-ux-pro-max first, then impeccable + layout for final output |
| S7.5 tool cards | layout |

Each such slice's first task is "run the design skill(s), record the decision in the slice notes, then implement".

## 6. Phase 1: Quick bug fixes (8 slices)

### S1.1 Relay Enable truly disables Relay; remove Position; effect tests
- **Reqs:** BUG-05, BUG-06, BUG-07.
- **Work:** `useRelayAvailable()` (env flag AND `enabled`) as the single gate for dock mount (`RelayRoot.tsx`), `RelayToggleButton`, launcher, shortcut registration, command-palette Relay entries, `OpenInRelayButton`, `openInRelay()`. Disabling aborts the in-flight turn (stamped stopped, see S3.1), stops/discards recording, persists the thread. Remove `position` from the store and Settings (all locales); one-time `localStorage.removeItem("rq_relay_position")` on hydrate. Rewrite `RelaySection.spec.tsx` to assert effects (hides surfaces, share values reaches request body, permission mode changes approval behaviour).
- **AC:** per SPEC BUG-05/06/07 (toggle off then reload hides all; toggle on restores without reload; re-enable restores active thread).
- **Verify:** `bun run test -- src/components/settings/RelaySection src/stores/useRelayStore src/components/relay/RelayRoot`; e2e `e2e/qa/relay/relay-settings.spec.ts` (new), `relay-polish-shield.spec.ts`, `relay-privacy.spec.ts`.
- **Files:** `useRelayStore.ts`, new `useRelayAvailable.ts`, `RelayRoot.tsx`, `RelayToggleButton.tsx`, `OpenInRelayButton.tsx`, `openInRelay.ts`, shortcut hook, command palette, `RelaySection.tsx`+spec, `messages/*/settings.json`. **Size:** L (split into two PR-sized commits: gate wiring, then spec rewrite).
- **Depends:** S0.1.

### S1.2 System prompt: no tool names, choice questions use the card
- **Reqs:** BUG-03, BUG-04 (prompt half).
- **Work:** ban rule block in `buildSystemPrompt`; scrub user-facing example phrases; `ask_user` schema description + prompt rule "use the question card for choices". Leak sweep over tool error messages reaching UI, ConfirmCard text, ToolRow labels, DeclinedNote, relay i18n.
- **Tests (unit):** prompt contains ban rule and card rule; no registered tool name in `messages/*/relayDock.json` or `relay.json`; ToolRow/ConfirmCard/error formatter render no tool name for every registry tool (uses S0.2 util); quoted examples clean.
- **Files:** `server/systemPrompt.ts`+spec, `schemas.ts`, `ConfirmCard`, `ToolRow`, `DeclinedNote`, i18n. **Size:** M. **Depends:** S0.2.

### S1.3 Attachments are per-turn and persisted on the message
- **Reqs:** BUG-01 (COMP-06 contract defined here).
- **Work:** `message.metadata.attachments` (`{id, kind, label, method?}`); `buildAttachmentDetail` reusing the get_request/get_collection/get_environment/get_chain serializers (identical `shareValues` redaction); detail attached to the latest user message only; `prepareOutgoingMessages()` strips detail and `metadata.turn`/segments from older messages and enforces `RELAY_ATTACHMENT_DETAIL_MAX_CHARS` with graceful degrade; composer clears chips after send; remove `buildPrompt` "Attached:" suffix; fix `capToolResult` shape vs route `contextSchema`; deleted-item handling; update `ATTACHED_CONTEXT_RULES`; neutral pill row in the user bubble.
- **AC:** all BUG-01 criteria including the 10 large attachments + 50 prior turns under 256 KB test.
- **Verify:** unit (metadata builder, detail redaction parity, history stripping, schema acceptance, chips cleared, no label suffix); e2e `relay-v2-bugs.spec.ts` attach-and-send scenario (body assertion, empty composer, no question card).
- **Files:** `useRelayChat.ts`, `contextBuilder.ts`, `tokenBudget.ts`, `useRelayStore.ts`, `RelayComposer.tsx`, `useSlashCommandRunner.ts`, `route.ts`, `systemPrompt.ts`, `RelayConversation.tsx`, new `src/lib/relay/attachments.ts`. **Size:** L (single send-path change; keep to one slice, three internal tasks).
- **Depends:** S1.2 (prompt file ordering), S0.1.

### S1.4 Question card: pick or type, then Send
- **Reqs:** BUG-04 (UI half), CONV-09 (behaviour).
- **Work:** pure reducer (idle/selected/typed/sent/answered-via-composer/skipped); `AskUserCard` redesign (select highlights, text field, Send); composer message while a card is pending answers it (tool result = plain text; bubble still renders); pending confirm card auto-declined with muted "Skipped because the chat moved on"; stale card (stop/error/reload) becomes muted non-interactive line.
- **Verify:** unit reducer and `AskUserCard.spec`, `ConfirmCard.spec` (XC-01 "Skipped"), `RelayConversation.spec`; e2e: select+Send, type+Send, composer answers card, stop leaves skipped line.
- **Files:** `AskUserCard.tsx`, `MessageParts.tsx`, `useRelayChat.ts`, `RelayComposer.tsx`, `tools/ui.ts`, new `askUserState.ts`, i18n. **Size:** M. **Depends:** S1.3.

### S1.5 Picker filters as you type; header names the action
- **Reqs:** BUG-02.
- **Work:** autofocused search input in `MentionMenu` (starter and slash mode), keyboard model, empty state; per-action header keys `slash.hint.<actionId>` with generic fallback; remove footer hint. Input must be independent of the composer so it survives the Phase 4 editor swap.
- **Verify:** unit (filter, header key for every target-needing `CAPABILITY_ACTIONS` entry resolves in all locales); e2e cURL-starter header + "user" narrowing.
- **Files:** `MentionMenu.tsx`+spec, `useCapabilityStarter.ts`, `useSlashCommandRunner.ts`, i18n. **Size:** M. **Depends:** none (after S1.3 to avoid composer conflicts).

### S1.6 Env "..." menu and History "..." button/export separator
- **Reqs:** BUG-08, BUG-10.
- **Work:** standalone nested `DropdownMenu` for env row "..." (shared SubTrigger untouched); History button `size="icon"` (>=28x28) and separator before the redaction note.
- **Verify:** unit (no chevron, "..." does not select, separator present); e2e env menu and history button bounding box.
- **Files:** `EnvSelector.tsx`+spec, `HistoryActionsMenu.tsx`+spec. **Size:** S.

### S1.7 Method dropdown fits badges
- **Reqs:** BUG-09. **Design gate:** impeccable + layout first.
- **Work:** widen menu content to longest method badge (OPTIONS) + check mark without touching other Selects, via a variant/className on `UrlBar` usage.
- **Verify:** e2e at 100% and 125% zoom (scrollWidth <= clientWidth, no badge/check overlap). **Files:** `UrlBar.tsx`, `select.tsx` (only if a variant is needed). **Size:** S.

### S1.8 Chevron convention and folder icons
- **Reqs:** BUG-11, BUG-12.
- **Work:** closed = right, open = down in `accordion.tsx` (`chevronLeft` variant), `SidebarMainTab`, `CollectionTree`, `CollectionRequestTree`, plus every hit of the grep `ChevronUp|ChevronDown|AccordionTrigger|CollapsibleTrigger`; `FolderOpen` when open in tree and subfolders. The "Worked for" row follows the same convention in S3.3.
- **Verify:** unit (accordion data-state icons, folder icon swap); e2e sidebar spot check in the Phase 2 spec. **Size:** M (many small edits).

### Checkpoint P1
- [ ] Unit: all slice specs above plus XC-01 specs (RelayConversation, ConfirmCard, RelaySection, useRelayStore, ChangeCard, AskUserCard, MentionMenu, RelayComposer, CapabilitiesPanel, EnvSelector).
- [ ] E2E: `relay-v2-bugs.spec.ts`, `relay-settings.spec.ts`, plus `relay-chat`, `relay-polish-shield`, `relay-privacy`, `relay-polish-mention`, `relay-polish-slash`.
- [ ] `bun run lint:check`, then once `bun run typecheck`; i18n parity green.
- [ ] Review with human before Phase 2.

## 7. Phases 2 to 8

### Phase 2: Sidebar (2 slices)

**S2.1 Resizable bounds (SB-01, SB-02).** Named constants `SIDEBAR_MIN_SIZE="240px"`, `SIDEBAR_MAX_SIZE="50%"`, default `20%`, main panel `minSize="50%"` in `MainLayout.tsx`. E2E `relay-v2-sidebar.spec.ts`: drag fully left = 240 +-1 px, fully right = 50% +-2 px at 1440 px viewport, URL bar visible, no tab horizontal scroll. Size S.

**S2.2 Row truncation at min width (SB-03).** Collections `min-w-0 flex-1`; `HistoryItem` CSS truncation replacing `truncateUrl(...,40)`; `HubProviderCard` footer `flex-wrap`. Seed long names/URLs; e2e asserts ellipsis, no badge/button bounding-box overlap, no panel scroll on all three tabs. Unit for HistoryItem. Size M. Depends: S2.1.

**Checkpoint P2:** `relay-v2-sidebar.spec.ts` green; unit for HistoryItem/Hub card; existing `collections`, `history` qa specs touched by the rows still green; typecheck once.

### Phase 3: Conversation redesign (6 slices)

**S3.1 Per-turn timing persisted (CONV-01, CONV-11 data).** `src/lib/relay/timing.ts`: stamp `metadata.turn` (`startedAt/endedAt/status/steps[]` incl. `waiting`) from `useRelayChat` events; persist via `threadDb`; `deriveTurnSummary()` returns the CONV-11 label kinds (done/stopped/failed/interrupted/legacy) from fixtures; strip `turn` from outgoing body. Unit: stamping helper, round trip, legacy tolerance, stripping. Files: `timing.ts`, `useRelayChat.ts`, `threadDb.ts`, `prepareOutgoingMessages`. Size M. Depends: S1.3.

**S3.2 Live "Working for Ns" header (CONV-02).** Design gate. Shared `formatDuration` (0, 59, 60, 3599, 3600 boundaries); ticking header replacing "Thinking..." shimmer in `RelayActivityIndicator`; "Waiting for you" pauses the timer per the active-time rule. Unit with fake timers (pause/resume). Size M. Depends: S3.1.

**S3.3 Collapsed "Worked for Ns" group (CONV-03, CONV-04, CONV-11 render, CONV-09 placement).** Design gate. Group row (chevron right/down, `aria-expanded`, keyboard), per-step durations, no group for turns without tool steps, pure `summariseSteps()` with plural-aware i18n, edge labels from S3.1 (Stopped/Failed/Interrupted/legacy "Worked"), stale and auto-declined cards rendered inside the group. Visible after fold: final answer, then summary. Unit: `summariseSteps`, each CONV-11 label, group render; update `RelayConversation.spec` (XC-01). Files: `MessageParts.tsx`, `RelayConversation.tsx`, new `WorkedGroup.tsx`, `stepSummary.ts`, i18n. Size L (split WorkedGroup render from summariseSteps). Depends: S3.1, S3.2, S1.4, S1.8.

**S3.4 Compact changes summary (CONV-05; CONV-06 details removal).** Design gate: layout. Single summary after the answer, one row per entity with Open, Undo all via `log.undoTurn`, extend `OPENABLE` and `openEntity` for chain/collection/environment/folder/settings, disabled Open with reason for deleted/undone; ChangeCard only inside the group; delete `ChangeDetails` and `buildChangeDiff` usage (and `changeDiff.ts` if unused). Unit: summary model, openable resolution. E2E `relay-v2-conversation.spec.ts`: create request/chain/collection/environment, each Open routes correctly, Undo all reverts. Size L (two tasks: model+UI, deletion). Depends: S3.3.

**S3.5 Step-cap notice and live chain updates (CONV-06 step counter, CONV-08).** Remove "Step N of 12" and `RELAY_STEP_INDICATOR_AFTER`/`step` key everywhere; one neutral notice only when `RELAY_MAX_STEPS` is hit. Chain tools verified navigation-free and prompt does not tell the model to open chains; Open button appears in the live step row once the chain exists; verify (fix if stale) that the open chain editor re-renders on `add_chain_node`/`update_chain_node`/`connect_chain_nodes`. Unit: cap notice iff cap hit, no router call from chain tools, store update reaches the editor selector. E2E: chain page open, mocked agent adds 3 nodes, no reload. Size M. Depends: S3.3.

**S3.6 Neutral entity pills and user-bubble pills (CONV-07, CONV-10).** Design gate. `EntityPill`, `RelayMarkdown` inline code, ChangeCard rows, summary rows, bubble pills use `text-foreground`/`text-muted-foreground`, subtle border; colour only on method badges. Unit class assertions; e2e light+dark computed-colour differs from `var(--primary)` and contrast >= 4.5:1 via S0.1 helper. Size S-M. Depends: none (do early; independent).

**Checkpoint P3:** unit (timing, duration, summariseSteps, summary model, cap notice, pills + XC-01 specs ChangeCard/RelayConversation/AskUserCard); e2e `relay-v2-conversation.spec.ts` plus `relay-chat`, `relay-polish-msg`, `relay-confirm`, `relay-write`, `relay-improvements-pills`, `relay-improvements-loading`, `relay-improvements-smart-diff` (the latter is expected to need rewrite since Show details is removed; rewrite, not weaken); reload test proves "Worked for" values identical; typecheck once; human review.

### Phase 4: Inline-pill composer (4 slices)

**S4.1 Tiptap editor shell with textarea parity (COMP-01).** `bun add` Tiptap packages (verify React 19.2.3 support at install; no StarterKit; doc, paragraph, text, hard break, placeholder, history, `@tiptap/suggestion`). `immediatelyRender: false`, client-only mount. Keeps Enter/Shift+Enter, IME guard, plain-text paste, autosize to existing max height, `role="textbox"` + label. Serialiser to `{text, segments[], attachments[], commands[]}` (text-only paths first). Wrap behind a thin `PromptEditor` component so `PromptInput` consumers keep working. Unit: Enter/Shift+Enter, IME, paste, serialisation. Port `RelayComposer.spec` and relay-polish-composer e2e before adding features. Size L (keep to shell only). Depends: S1.3, S1.4, S1.5.

**S4.2 Inline attachment pills (COMP-02, COMP-04 clear, COMP-07 deleted/whitespace).** `@` suggestion node via `@tiptap/suggestion` driving the existing `MentionMenu`; atomic Pill node (neutral, S3.6 component), Backspace deletes whole pill; `attachedItems` derived from editor doc (single source of truth); remove `ComposerPills` row and `@label` insertion; clear on send; deleted entity pill shown muted and sent as note; whitespace-only not sendable unless a pill exists. Unit: insert/delete/derive, each edge case. E2E `relay-v2-composer.spec.ts` (mention then send). Size M. Depends: S4.1, S3.6.

**S4.3 Inline slash-command pills (COMP-03, COMP-04 drafts).** `/` suggestion inserts a command pill mid-sentence; target-needing commands open the S1.5 picker and insert the target pill right after; `openWithDraft` stores segments; command resolves at send via `useSlashCommandRunner`. Unit + e2e. Size M. Depends: S4.2, S1.5.

**S4.4 Sent segments and bubble parity (COMP-05, COMP-06, COMP-07 dictation, CONV-10 inline).** Persist segments in `message.metadata`; bubble renders segments in order with the same Pill component; legacy text-only messages unchanged; segments stripped from older messages in the outgoing body; dictation inserted at the caret as plain text without disturbing pills (speech hook insertion API reused by S8.4). Unit round trip; e2e: type, insert attachment and slash command, send, bubble shows pills in order, composer empty. Size M. Depends: S4.3, S1.3.

**Checkpoint P4:** unit for editor, serialiser, segment builder, stripping, plus XC-01 `RelayComposer`, `MentionMenu`, `ComposerPills` (deleted or replaced), `ChangeCard`; e2e `relay-v2-composer.spec.ts` plus `relay-polish-composer`, `relay-polish-mention`, `relay-polish-slash`, `relay-improvements-picker`, `relay-improvements-voice`, `relay-polish-a11y`; a11y axe spec for composer; check chat route stays under the 256 KB test; typecheck; lint; human review (largest-risk phase).

### Phase 5: Empty state and popover (2 slices)

**S5.1 Context-aware suggestions and quiet link (EMPTY-01, EMPTY-02).** Design gate (impeccable + layout). Pure `pickSuggestions(context)` (max 4, ordered ids); known-target suggestion inserts command + target pill and sends; generic starters open the picker; quiet "See everything Relay can do" text link. Unit per context; e2e `relay-v2-empty.spec.ts`. Size M. Depends: S4.3, S1.5.

**S5.2 Single-list capabilities popover (EMPTY-03).** Design gate. Remove tabs from `CapabilitiesPanel`, one scrollable list (icon + sentence per `CAPABILITY_CATEGORIES`), "asks first" marker derived from `capabilityBadge` only where approval applies, "What Relay can see" footer from `shareValues` wording, "Change approval mode" retained. Unit row model + marker; e2e no `tablist`, footer visible, mode selector opens. Update `CapabilitiesPanel.spec`, `relay-polish-caps`. Size M. Depends: S5.1 (link entry point).

**Checkpoint P5:** `relay-v2-empty.spec.ts`, `relay-v2-popover.spec.ts`, `relay-polish-caps`, `relay-polish-launcher`, `relay-polish-panel`, `relay-polish-perm` green (`relay-polish-ctx` is migrated with the composer in Phase 4); unit green; typecheck; human review.

### Phase 6: Workspace backup (5 slices)

**S6.1 Envelope, secrets and exporter core (BAK-01, BAK-02, BAK-03, BAK-08).** `src/lib/backup/{schema,secrets,exporter}.ts`: versioned envelope, section->store map, Blob-part assembly, preferences allow/deny lists, size estimate, per-section counts, selective extraction (collection pulls folders, requests, chainConfigs; dangling-reference count), secret blanking everywhere in BAK-08 (history and chainRuns included, `{{var}}` kept). Unit: sentinel property test OFF/ON, subset extraction, preference exclusions. Size L (secrets and selection are separate tasks). Depends: S0.1.

**S6.2 Validation and Merge import (BAK-05, BAK-04 merge).** `validate.ts` (zod, error table, migration hook, 100 MB warning), `importer.ts` + `remap.ts`: add-if-absent, skip deep-equal ignoring `updatedAt`, keep-both with new id and " (imported)" suffix, id-remap for every reference listed, settings/prefs add-only, merged `relay_changes` not undoable. Unit: collisions, remap integrity, idempotent re-import, every error message in all locales. Size L. Depends: S6.1.

**S6.3 Atomic Replace and reconciliation (BAK-04 replace, BAK-09, BAK-06 unit).** One readwrite IDB transaction across all affected stores, abort rolls back, localStorage written after commit; tab reconciliation (close tabs whose request id vanished), dangling counts, `BroadcastChannel` reload for other tabs; chain missing-request placeholder added (reviewer spot check: none exists today; `useChainRequests().missingIds` is unused and missing nodes are silently dropped), reusing the `NodeShell` broken-reference state. Unit: injected failure rolls back, `export(import(export(x)))` equality, reconciliation. Size M. Depends: S6.2.

**S6.4 Export UI (BAK-07 export, BAK-02/03 UI).** Design gate: ui-ux-pro-max, then impeccable + layout. Settings "Data" section (`constants.ts`, new `DataSection.tsx`, before Relay), export dialog: Everything/Choose, per-section checkboxes with searchable item pickers, secrets toggle OFF with warning, Relay-threads note, counts + estimated size, download name `requestr-backup-YYYYMMDD-HHmm.json`. Local state/Context only. Unit components; e2e download capture. Size L (split dialog and Data section shell). Depends: S6.1.

**S6.5 Import UI and round trip (BAK-07 import, BAK-04 UI, BAK-06 e2e).** Same design pass output. File pick/drop, validation errors, preview (counts, exportedAt, includesSecrets), mode choice with destructive Replace confirmation listing counts, reload after restore, Import page "Restore a Requestr backup" card. E2E `relay-v2-backup.spec.ts`: two contexts round trip with secrets ON deep-equals IDB dumps and preference keys; OFF differs only by blanked fields; chain placeholder after Replace. Size L. Depends: S6.3, S6.4.

**Checkpoint P6:** unit for entire `src/lib/backup/**` (>= 80% per file), `relay-v2-backup.spec.ts`, plus the touched Settings regression spec `e2e/settings.spec.ts` (the Import page card is covered by `relay-v2-backup-import.spec.ts`); no IDB version bump confirmed; i18n parity; typecheck; human review of the UI.

### Phase 7: Relay tools (6 slices)

**S7.1 App settings tools plus STT groundwork (TOOL-01, STT-02, STT-06 store field).** `get_app_settings` (secrets masked via `secrets.ts` unless `shareValues`), `set_theme`, `set_language`, `update_proxy_settings`, `set_global_variables`, `set_relay_preferences` (confirm on `enabled:false`, applied after the turn; rejects `permissionMode`; rejects `grok` when unconfigured). Same store methods as the Settings UI; change log with Undo; "Open Settings" in the summary. Pulls forward: `GET /api/relay/stt/status`, `useSttConfigured()`, `speechEngine` in `useRelayStore`. Unit: schemas, masking, each store action effect, rejections. Size L (two tasks: tools; STT groundwork). Depends: S1.1, S6.1, S3.4.

**S7.2 Navigation tools (TOOL-02).** Extend `open_item` kinds incl. folder; `open_page` (real routes only: `/app`, `/settings`, `/import`, `/environments`, `/json-compare`, `/json-visualize`, `/transform`); `show_sidebar_tab`; add to `NAVIGATION_TOOLS`. Unit route mapping and unknown rejection; e2e. Size M. Depends: S7.1.

**S7.3 Backup tools (TOOL-03).** `export_backup` (confirm lists sections and counts; secrets warning), `import_backup` (confirm card with Choose-file gesture, preview, Merge only, never applies permission mode, result is counts only). Reuses the S6 lib and the S6.5 preview component. Unit: merge-only, no file content in result, permission mode ignored. Size M. Depends: S6.5, S7.1.

**S7.4 Remaining entity operations (TOOL-04).** `duplicate_collection/chain/environment`, folder CRUD (audit `move_item` coverage first, add only gaps), `export_postman`, `import_api_catalog` (updates `requestly_imported_hub_slugs`). Change log + Undo + summary Open. Unit; e2e. Size L (split duplicates / folders / export+hub). Depends: S7.2.

**S7.5 Tool cards and labels (TOOL-06).** Design gate: layout. Compact rows, plain-language `relay.tools.<name>.running/done` for every new tool in all locales; registry-iterating test. Size S-M. Depends: S7.1-S7.4 (can start after S7.1 and extend).

**S7.6 Deny-list and capability/prompt update (TOOL-05, TOOL-07).** Registry test (no permission-mode or wipe-all tool; `set_relay_preferences` rejects `permissionMode`; `import_backup` cannot select Replace); prompt states what Relay cannot do; new capability areas/actions/markers for settings, navigation, backup in `CAPABILITY_CATEGORIES`/`CAPABILITY_ACTIONS` feeding S5.2 popover; every tool maps to an area. Update `CapabilitiesPanel.spec`. E2E `relay-v2-tools.spec.ts` (mocked tool calls end to end for each family plus the refusal wording). Size M. Depends: S7.1-S7.5.

**Checkpoint P7:** unit (registry-wide tests), `relay-v2-tools.spec.ts`, plus `relay-write`, `relay-confirm`, `relay-polish-perm`, `relay-polish-caps`, `relay-improvements-kinds`; typecheck; human review.

### Phase 8: Grok STT (4 slices)

**S8.1 Server route (STT-01, STT-05 server).** `POST /api/relay/stt` with ordered guards (origin, env flag, key, `audio/wav`, 8 MB), multipart with `file` last, `format=true` only for supported languages, response only `{text, language, duration}`, status mapping table, `Retry-After` pass-through, key never logged or returned; `GROK_STT_MODEL`, `STT_MAX_UPLOAD_BYTES` constants; `.env.example`. Unit with mocked fetch per upstream status. Size M. Depends: S0.1.

**S8.2 WAV capture and language (STT-03, STT-04).** `encodeWav(samples, rate)` pure (header, length, clipping), 16 kHz mono PCM16 resampling, AudioWorklet with ScriptProcessor fallback, 120 s cap auto-stop (`STT_MAX_RECORDING_MS`), capability detection, locale to ISO-639-1 via `SPEECH_LANG_BY_LOCALE`. Unit encoder and language map. Size M. Depends: none.

**S8.3 `useGrokDictation` hook and error handling (STT-05 client, STT-08).** State machine idle/recording/transcribing/error; permission denied, no mic, under-0.5 s ("Didn't catch that"), disabled button while transcribing, abort and discard on dock close/thread switch/Relay disabled, retry keeping the WAV blob, network failure message, all copy in all locales. Unit each case. Size M. Depends: S8.1, S8.2, S1.1.

**S8.4 Engine picker, mic UI and e2e (STT-06, STT-07).** Settings -> Relay engine picker (Grok disabled with hint when unconfigured; runtime fallback without overwriting stored value), `MicButton` engine label, 5-bar level meter at 100 ms, "Transcribing...", insert at caret (S4.4 API), Grok privacy note variant. E2E `relay-v2-stt.spec.ts` with fake audio device flags and `page.route` mock: record, stop, text lands; label visible; disabled when status unconfigured. Size M. Depends: S8.3, S7.1, S4.4.

**Checkpoint P8 (epic done):** `relay-v2-stt.spec.ts` plus `relay-improvements-voice`, `relay-improvements-a11y-mic`, `relay-polish-a11y`, `relay-privacy`; unit for route, encoder, hook; final typecheck, lint, i18n parity; final targeted sweep of all `relay-v2-*` specs (never the full suite); verify epic success criteria 1 to 5.

## 8. XC-01: existing specs and where they are touched

| Spec | Updated in |
|---|---|
| `RelayConversation.spec.tsx` | S1.3, S1.4, S3.3, S3.4, S3.5 |
| `ConfirmCard.spec.tsx` ("Skipped") | S1.4, S3.3 |
| `RelaySection.spec.tsx`, `useRelayStore.spec.ts` | S1.1, S7.1, S8.4 |
| `ChangeCard`, `AskUserCard`, `MentionMenu`, `RelayComposer`, `CapabilitiesPanel`, `EnvSelector` specs | S3.4, S1.4, S1.5/S4.2, S4.1, S5.2/S7.6, S1.6 |
| e2e `relay-chat.spec.ts`, `relay-polish-shield.spec.ts`, `relay-privacy.spec.ts` | run at every Phase checkpoint that touches chat, settings, or privacy; rewritten (never weakened) in S1.1, S1.3, S3.x |

Each slice's verification names the XC-01 specs it can affect and runs only those.

## 9. Traceability (every requirement to slice)

| Req | Slice(s) | Req | Slice(s) |
|---|---|---|---|
| BUG-01 | S1.3 | BAK-01 | S6.1 |
| BUG-02 | S1.5 | BAK-02 | S6.1, S6.4 |
| BUG-03 | S1.2 | BAK-03 | S6.1, S6.4 |
| BUG-04 | S1.2, S1.4 | BAK-04 | S6.2, S6.3, S6.5 |
| BUG-05 | S1.1 | BAK-05 | S6.2, S6.5 |
| BUG-06 | S1.1 | BAK-06 | S6.3 (unit), S6.5 (e2e) |
| BUG-07 | S1.1 | BAK-07 | S6.4, S6.5 |
| BUG-08 | S1.6 | BAK-08 | S6.1 |
| BUG-09 | S1.7 | BAK-09 | S6.3 |
| BUG-10 | S1.6 | TOOL-01 | S7.1 |
| BUG-11 | S1.8, S3.3 | TOOL-02 | S7.2 |
| BUG-12 | S1.8 | TOOL-03 | S7.3 |
| SB-01 | S2.1 | TOOL-04 | S7.4 |
| SB-02 | S2.1 | TOOL-05 | S7.6 |
| SB-03 | S2.2 | TOOL-06 | S7.5 |
| CONV-01 | S3.1 | TOOL-07 | S7.6 |
| CONV-02 | S3.2 | STT-01 | S8.1 |
| CONV-03 | S3.3 | STT-02 | S7.1 / T7.4 (pulled forward), S8.4 (consumed) |
| CONV-04 | S3.3 | STT-03 | S8.2 |
| CONV-05 | S3.4 | STT-04 | S8.2 |
| CONV-06 | S3.4 (details), S3.5 (step counter, notice) | STT-05 | S8.1, S8.3 |
| CONV-07 | S3.6 | STT-06 | S7.1 / T7.4 (store), S8.4 (UI, fallback) |
| CONV-08 | S3.5 | STT-07 | S8.4 |
| CONV-09 | S1.4, S3.3 | STT-08 | S8.3 |
| CONV-10 | S1.3 (pills), S3.6, S4.4 | XC-01 | S0.1, S0.2, S0.3, section 8 (every slice) |
| CONV-11 | S3.1, S3.3 | EMPTY-01 | S5.1 |
| COMP-01 | S4.1 | EMPTY-02 | S5.1 |
| COMP-02 | S4.2 | EMPTY-03 | S5.2, S7.6 (new areas) |
| COMP-03 | S4.3 | | |
| COMP-04 | S4.2, S4.3 | | |
| COMP-05 | S4.4 | | |
| COMP-06 | S1.3, S4.4 | | |
| COMP-07 | S4.2, S4.4 | | |

All 61 IDs are mapped.

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tiptap integration with existing `PromptInput`, mentions, slash runner, IME and autosize | High | S4.1 is a parity-only shell behind a thin `PromptEditor` before any pill work; port composer unit and e2e specs first; use `@tiptap/suggestion` to drive existing `MentionMenu` instead of rewriting it; verify React 19.2.3 compatibility at `bun add` and ask first if a peer conflict appears; `immediatelyRender:false` for SSR. Fallback: keep textarea behind a flag until S4.2 is green. |
| 256 KB chat route budget (`MAX_BODY_BYTES`) with attachments, segments and timing | High | Only the latest user message carries resolved detail; one `prepareOutgoingMessages()` strips `turn`, segments, detail from older messages; `RELAY_ATTACHMENT_DETAIL_MAX_CHARS` cap with graceful degrade; unit test with 10 large attachments + 50 turns; re-run in S3.1 and S4.4. |
| IDB restore atomicity (Replace/Merge) | High | Single readwrite transaction over all affected stores; abort on any failure; localStorage after commit; injected-failure unit test; no IDB version bump; reload and BroadcastChannel to stop stale tabs. |
| Secret leakage in backup or settings tools | High | Single `secrets.ts` list; sentinel property test; TOOL-01 masking reuses it; `XAI_API_KEY` never in client/log/response (route unit test). |
| WAV encoding/capture across browsers | Med | Pure `encodeWav` tested on header/length/clipping; AudioWorklet with ScriptProcessor fallback; Grok option disabled when neither exists; 120 s cap keeps uploads ~3.8 MB under 8 MB cap. |
| Breaking existing e2e specs (XC-01) | Med | Baseline in S0.2; each slice runs the specs it affects; rewrite to new behaviour, never weaken; hot-file edit order fixed in section 1. |
| Hot-file merge pressure (`useRelayChat`, `RelayComposer`, `systemPrompt`, `schemas`) | Med | Slice order serialises edits; helpers centralised (prepareOutgoingMessages, attachments.ts, timing.ts); parallelism limited to listed safe pairs. |
| Timing accuracy across multi-request tool loops and approval waits | Med | Stamp client-side from stream and tool events; `waiting` steps excluded from active time; reload/interrupted label tested from fixtures. |
| Live chain editor stale copy (CONV-08) | Med | Verify store write path early in S3.5; fix selector subscription if stale; e2e with 3 added nodes. |
| i18n drift across en/fr/ja | Low | Parity specs extended in S0.2; each slice adds keys to all locales in the same change; removed keys deleted. |
| Model-output nondeterminism for BUG-03/04 | Low | Unit-test prompt text and rendered strings only; e2e uses mocked stream. |

## 11. Definition of done (per slice and phase)

- Slice: unit tests colocated and green (>= 80% per new/changed file), slice e2e green when it has one, affected XC-01 specs green, i18n keys in all locales, named constants, functions under ~30 lines, `bun run lint:check` clean.
- Phase: checkpoint list above green (targeted specs only, e2e base URL `https://requestly.localhost/app`, never the full suite), `bun run typecheck` once after the last slice, human review before proceeding.
- Epic: success criteria 1 to 5 in SPEC verified; BAK-06 round trip passes.

## 12. Open questions

None (SPEC has none). Flag-to-human items surfaced during planning: (a) pulling STT-02 and the `speechEngine` store field into S7.1 is a deliberate deviation from phase ownership; (b) any dependency beyond Tiptap, any IDB bump, or any chat-contract change beyond `metadata` must be asked first.
