# Spec: relay-v2

Source of truth for intent: `agent_docs/relay-v2/CONTEXT.md` (confirmed restate, interview answers, code findings). STT reference: `agent_docs/relay-v2/grok-stt-docs.md`. This is a planning document. It contains no feature code.

Audit note (2026-10-26): an independent audit revised this spec against CONTEXT.md. It verified code facts read-only, resolved the open items with defaults, added edge cases, and appended IDs CONV-11, COMP-07, BAK-08, BAK-09, TOOL-07, STT-08 and XC-01. Existing IDs were not renumbered.

## Objective

One phased epic that fixes Relay's broken features and cluttered UX, then adds workspace backup, tools with full parity to the manual UI, and Grok speech-to-text.

- **User:** the developer who uses Requestr daily, and anyone moving their workspace to a new browser.
- **Why now:** relay-polish left confusing UX and several broken pieces (Enable/Position, attachments, picker).
- **Success:**
  1. The user always understands what Relay is doing and how long it took.
  2. A backup round-trips identically into a fresh browser.
  3. Every item below is covered by unit and/or e2e tests.
- **Constraints:** keep the DeepSeek model and server-key setup unchanged (`src/lib/relay/server/model.ts`). Design work uses these skills:
  - ui-ux-pro-max for the export/backup UI design, then impeccable + layout for the final output.
  - impeccable + layout for the popover, empty state, conversation and method dropdown.
  - layout for the tool cards.
- **Out of scope (user-stated):** live/streaming STT (WebSocket); LLM provider choice or user-entered keys; cloud sync; multi-collection Postman export (native backup format only; the existing per-collection Postman export stays); Relay changing its own approval mode.
- **Out of scope (audit defaults, not requested):**
  - Backup encryption or password protection.
  - Scheduled or automatic backups.
  - Importing Requestly-original or other foreign formats through the backup flow.
  - Command-palette entries for backup.
  - Sniffing backup files dropped onto the generic importer.
  - Redacting response bodies in history.
  - Relay reading backup file contents.
  - A level meter for the Browser speech engine.
  - Persisting sidebar width across reloads (not persisted today).

## Assumptions and resolved defaults

1. **Backup file:** extension `.json`, file name `requestr-backup-YYYYMMDD-HHmm.json`.
2. **Grok capture format:** 16 kHz mono PCM16 WAV, encoded on the client with Web Audio. Grok does not list webm, and MediaRecorder support for ogg/mp4 varies by browser, so WAV is the only deterministic choice. Recordings are capped at 120 s, which is about 3.8 MB of WAV. The server body cap is 8 MB.
3. **No IDB_VERSION bump.** The backup adds no new stores, and timing data lives inside existing `relay_threads` message metadata. `RELAY_WORKSPACE_ID` is the constant `"local"` (`src/lib/relay/constants.ts:52`), so restored threads stay visible without a rewrite.
4. **Step cap:** the "Step N of 12" counter is replaced by a single inline notice, shown only when `RELAY_MAX_STEPS` (12) is reached. Without it the user could not tell that Relay stopped at its limit.
5. **Backup UI location:** a new "Data" section in Settings (before Relay), plus a link card on the Import page.
6. **Locales:** whatever exists under `messages/`, currently en, fr, ja. Every new key is added to all of them.
7. **Rich editor:** Tiptap. The user agreed to "a lightweight rich editor (e.g. Tiptap)" (Q4), so this dependency is pre-approved. Use `@tiptap/react` with minimal extensions (doc, paragraph, text, hard break, placeholder, undo/redo) plus the suggestion utility and custom atomic nodes. Confirm the exact package names against the installed major version. Do not use StarterKit. React is 19.2.3; confirm the Tiptap version supports it at install time with `bun add`.
8. **Sidebar sizes** (react-resizable-panels 4.11.1 supports `"px"` units):
   - Sidebar: `minSize="240px"`, `maxSize="50%"`, `defaultSize="20%"`.
   - Main panel: `minSize="50%"`.
   - Values are named constants (`SIDEBAR_MIN_SIZE`, `SIDEBAR_MAX_SIZE`).
9. **Chat API contract:** the metadata additions required by BUG-01, CONV-01 and COMP-05 are pre-approved. The route's `messageSchema` is a `looseObject`, so extra `metadata` passes. Any other contract change needs approval.
10. **Duration rule:** a turn's displayed duration is active time. It runs from send to the end of the last step, minus time spent waiting for the user (approval card or question card).

## Commands

```
Install:   bun install            (add deps: bun add <pkg>)
Unit:      bun run test           (vitest run; target: bun run test -- <path>)
Typecheck: bun run typecheck      (tsc --noEmit; only after a full phase is complete)
Lint:      bun run lint:check     (biome check)
E2E:       PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test <spec path>
```

- Never run the dev server; it is always running.
- Never run npm.
- Never run the full e2e suite (`test:e2e` or `test:qa` without a path).

## Project structure (touch points)

```
src/components/relay/        conversation, composer, popover, empty state, cards
src/lib/relay/               tools/, server/systemPrompt.ts, capabilities.ts, threadDb.ts, changeLog.ts, timing.ts (new), attachments.ts (new)
src/hooks/                   useRelayChat.ts, useSpeechDictation.ts, new useGrokDictation.ts, new useSttConfigured.ts
src/stores/                  useRelayStore.ts (speechEngine; remove position)
src/lib/backup/              NEW: schema.ts, exporter.ts, importer.ts, validate.ts, secrets.ts, remap.ts
src/components/settings/     DataSection.tsx (new), RelaySection.tsx
src/app/api/relay/stt/       NEW: route.ts (POST transcribe), status/route.ts (GET configured)
src/app/settings/            constants.ts (Data section)
messages/{en,fr,ja}/         all new copy (relayDock.json, relay.json, settings.json, common.json, errors.json)
e2e/qa/relay/                targeted e2e specs per phase
```

The backup dialog state is ephemeral and local to the dialog subtree, so it uses React local state or Context, not a new Zustand store (CLAUDE.md store vs Context rule). The speech engine preference is persisted and cross-cutting, so it lives in `useRelayStore`.

## Code style

Follow CLAUDE.md and the code-style / typescript-best-practices skills:
- Named constants, no magic numbers.
- Functions under about 30 lines, with early returns.
- An options object past 3 parameters.
- No swallowed errors.
- shadcn rules in `.claude/skills/shadcn-component-rules/SKILL.md`.
- Zustand for cross-component persisted state (`src/stores/use<Name>Store.ts`).
- bun only.

## Boundaries

- **Always:**
  - Write unit tests alongside logic.
  - Add copy to every locale.
  - Assert effects, not just writes.
  - Keep prompts and labels free of internal tool names.
  - Run the existing specs a change touches (XC-01).
- **Ask first:**
  - Any dependency other than Tiptap.
  - An IDB version bump.
  - Changing the chat API contract beyond Assumption 9.
- **Never:**
  - Expose `XAI_API_KEY` to the client or the logs.
  - Write tests under `src/components/reactbits/`.
  - Commit unless told to.
  - Run the dev server or the full e2e suite.
  - Add an LLM tool for the deny-list actions.

---

# Phase 1: Quick bug fixes

### BUG-01 Attachments are per-turn and persisted on the message
**Root cause:**
- `useRelayChat.ts:477` sends `{text}` only.
- Chips ride on every request body (`:338-357`, `contextBuilder.ts:110`) and live in the system-prompt snapshot (`route.ts:198`, `systemPrompt.ts:50-75`) as names and ids only.
- `RelayComposer.tsx:307-311` clears only the text, and `attachedItems` is reset only in `newThread()` (`useRelayStore.ts:358`).
- `useSlashCommandRunner.buildPrompt` also appends `\n\nAttached: <labels>` to the draft text.

**Behaviour:**
- The sent user message carries its attachments in `message.metadata.attachments`: `[{id, kind, label, method?}]`, persisted with the thread.
- At send time, a resolved-detail text part is built for the latest user message only. It reuses the same serializers as the get_request/get_collection/get_environment/get_chain read tools, so `shareValues` redaction is identical.

**AC:**
- After send, the composer has no chips.
- A second turn sent without re-attaching carries no attachments, and turn 1's attachments are not resent as context.
- A request attachment resolves to `{id, name, method, url}` plus headers, params, body and auth type. Auth secret values follow `shareValues` exactly as `get_request` does.
- The resolved request detail is included in that turn's content, so "export this as cURL" is answered without a discovery tool call. The e2e mock asserts that the outgoing request body contains the detail.
- Other kinds resolve as follows:
  - Collections: name, id, and the request list (names and methods).
  - Environments: variable keys, with values only when `shareValues` is on and never for `isSecret`.
  - Chains: a node summary.
- **Body budget:** the chat route caps the body at 256 KB (`MAX_BODY_BYTES`). Only the latest user message carries resolved detail; older user messages keep only `metadata.attachments` refs. The per-turn detail is capped by `RELAY_ATTACHMENT_DETAIL_MAX_CHARS`. On overflow it degrades to ids and names with a note ("detail truncated, ask for more"), and the turn is never dropped. A unit test shows 10 large attachments plus 50 prior turns stay under 256 KB.
- **Deleted item:** if an attached item no longer exists at send time, its pill renders as "deleted" (muted) and the model receives "<label> no longer exists". In a sent bubble, an attachment whose entity was later deleted renders muted, with the tooltip "No longer exists" and no navigation.
- `capToolResult` (`tokenBudget.ts:75-82`) truncation no longer produces a shape the route `contextSchema` (`route.ts:43-46`) rejects. A unit test checks that a truncated summary passes the schema.
- The `buildPrompt` "Attached:" suffix is removed. A unit test checks the draft never contains the attachment labels list.
- System prompt `ATTACHED_CONTEXT_RULES` is updated: the current message's attachments are authoritative, and the model must not ask which item the user means.
- The user bubble shows the attachment pills (a neutral pill row under the text) in this phase. COMP-05 later moves them inline.

**Tests:**
- Unit: the metadata builder, the detail builder (redaction parity with the read tools), history stripping, schema acceptance, chips cleared after submit.
- E2E: attach a request and send. Then:
  - The composer is empty.
  - The bubble shows the pill.
  - The mocked `/api/relay/chat` request body has the resolved detail on the last user message only.
  - The rendered reply references the request with no question card.

### BUG-02 Picker filters as you type; header names the real action
**Root cause:** `RelayComposer.tsx:340` passes `query=""` in starter/slash mode, and the picker has no input of its own. The header key `slash.hint.${requiresTarget}` (`useCapabilityStarter.ts:39`, `useSlashCommandRunner.ts:36`) is the generic "Pick a request to run".
- In starter and slash mode, the picker (`MentionMenu.tsx`) has its own autofocused search input, which survives the Phase 4 editor swap. The list narrows live by name and URL (case-insensitive substring).
  - Arrow keys and Enter select an item; Escape closes the picker and returns focus to the composer.
  - No match shows "No requests match "<query>"".
- The header comes from the action, e.g. "Pick a request to export as cURL". Keys are per action id (`slash.hint.<actionId>`) and fall back to a generic per-target string.
- The footer "Keep typing to narrow results" is removed. The search input's placeholder replaces it.

**Tests:**
- Unit: query filtering, and header key resolution for every `CAPABILITY_ACTIONS` entry that needs a target (each resolves to an existing key in all locales).
- E2E: the "Export a request as cURL" starter shows the correct header, and typing "user" narrows the list to matching items only.

### BUG-03 Relay never names internal tools
- Add a rule block to `buildSystemPrompt`: never mention tool names, function names, snake_case identifiers or tool-call mechanics in user-facing text; describe actions in plain language.
- Remove tool names from user-facing phrasing examples in the prompt, e.g. "Tell me the name (or use ask_user to pick)". Instructions to the model may still reference tools by name.
- Leak sweep: tool error messages that reach the UI, ConfirmCard titles and bodies, ToolRow labels, DeclinedNote, and the relay i18n values.

**Tests (unit only; model output cannot be tested deterministically):**
1. The prompt contains the ban rule.
2. No string in `messages/*/relayDock.json` or `relay.json` contains a registered tool name.
3. ToolRow, ConfirmCard and the tool error formatter render no registered tool name for every tool in the registry.
4. The prompt's quoted user-facing examples contain no tool names.

### BUG-04 Choice questions use the question card (pick or type, then Send)
- System prompt rule: whenever the agent needs the user to choose among options (collections, requests, environments, etc.), it must use the question card with options, never a plain-text list. The `ask_user` schema description is updated to match.
- Card behaviour is defined in CONV-09 and delivered in this phase, as the restate requires: select or type, then confirm with Send. Only CONV-09's stale-card placement inside the "Worked for" group waits for Phase 3.

**Tests:**
- Unit: the prompt contains the rule, and the CONV-09 state machine.
- E2E (mocked model emits an `ask_user` call):
  - Select an option, then Send.
  - Type your own answer, then Send.
  - The tool result sent back equals the chosen or typed value.

### BUG-05 Relay "Enable" truly disables Relay
**Root cause:** `useRelayStore.enabled` (`rq_relay_enabled`) is read only by `OpenInRelayButton.tsx:43` and `openInRelay.ts:19`, and `RelayRoot.tsx:92` gates only on the env flag.

A single selector, `useRelayAvailable()`, returns env flag AND `enabled`. When it is false:
- The dock is not mounted.
- `RelayToggleButton` and the launcher are hidden.
- The keyboard shortcut is not registered.
- Command palette Relay entries are absent.
- Open-in-Relay buttons are hidden and `openInRelay()` is a no-op.

The Settings → Relay section stays visible so Relay can be re-enabled.

**AC:**
- Toggle off, then reload: none of the surfaces above appear.
- Toggle on: they come back without a reload.
- Disabling while the dock is open and a turn is running:
  - The in-flight turn is aborted (stamped "Stopped", CONV-11).
  - Any recording is stopped and discarded.
  - The thread is persisted and the dock unmounts.
  - Re-enabling restores the last active thread.

**Tests:**
- Unit: the selector truth table; the shortcut handler is a no-op; the command palette item list excludes Relay entries when disabled (assert the effect, not the store write); disabling aborts the active turn.

### BUG-06 Remove "Position" setting
**Root cause:** nothing consumes `useRelayStore.position`.
- Remove the control from `RelaySection.tsx`, remove `position` from the store, and remove the copy keys in all locales.
- On store hydrate, call `localStorage.removeItem("rq_relay_position")` once as cleanup.
- Unit: the key is removed after hydrate, and the section renders no position control.

### BUG-07 Relay settings tests assert effects
- Replace the write-only assertions in `RelaySection.spec.tsx` with effect checks:
  - Enable hides the dock, toggle, shortcut and palette entries.
  - Share values reaches the request body.
  - Permission mode changes approval behaviour.
- New e2e `e2e/qa/relay/relay-settings.spec.ts`:
  - With Enable off, the dock, toggle, launcher, palette entry and Open-in-Relay are hidden, and the shortcut does nothing.
  - Turning it on restores them.
  - No Position control is present.

### BUG-08 Env dropdown "..." menu
**Root cause:** the SubTrigger at `dropdown-menu.tsx:124` always appends `ChevronRightIcon ml-auto`, and `EnvSelector.tsx:79-92` uses a SubTrigger as the "..." button.
- Replace it with a standalone nested `DropdownMenu` triggered by the "..." icon button. Do not modify the shared SubTrigger.
- AC: no chevron icon inside the row; the hover and click target is exactly the "..." button; clicking "..." does not select the environment.
- Unit: no chevron is rendered in the row, and clicking "..." does not call the select handler.
- E2E: open the env menu; "..." has no arrow and opens the actions.

### BUG-09 Method dropdown fits badges
**Root cause:** the trigger is `w-[110px]` (`UrlBar.tsx:546-566`); in `select.tsx` the content is `min-w-36`, items have `pr-8`, and the check is `absolute right-2`.
- The menu content is wide enough for the longest `HttpMethod` badge (OPTIONS) plus the check mark, with no clipping or overlap.
- E2E (layout needs a real browser): open the method menu at 100% and 125% zoom. For every badge `scrollWidth <= clientWidth`, and no badge bounding box intersects the check mark's box.
- Design pass: impeccable + layout.

### BUG-10 History "..." button and Export submenu
- The button gets a wider hit target of at least 28x28 (`size="icon"`) at `HistoryActionsMenu.tsx:71`.
- Export submenu: a separator between the JSON / HAR / CSV group and the "Exports are not redacted..." note.
- Unit: the separator element is present in the submenu.
- E2E: the button's bounding box is at least 28 px in both dimensions.

### BUG-11 Chevron convention
- Everywhere: closed = chevron right, open = chevron down. This covers:
  - Sidebar section headers (`SidebarMainTab.tsx`, `accordion.tsx` `chevronLeft` variant).
  - `CollectionTree.tsx` and `CollectionRequestTree.tsx`.
  - Every other accordion or collapsible found by grepping for `ChevronUp|ChevronDown|AccordionTrigger|CollapsibleTrigger`.
  - The "Worked for" row (CONV-03).
- Unit: the accordion trigger renders ChevronRight when `data-state=closed` and ChevronDown when `open`.

### BUG-12 Folder icons reflect state
- `CollectionTree.tsx:241` and its subfolders use `Folder` when closed and `FolderOpen` when open, matching `CollectionRequestTree.tsx:124`.
- Unit: the icon swaps on toggle.

---

# Phase 2: Sidebar

### SB-01 Min width 240px
- `MainLayout.tsx:147-169`: the sidebar panel uses `minSize="240px"` (react-resizable-panels 4.11.1 supports px). It cannot be dragged narrower.
- AC (e2e): drag the handle fully left; the sidebar width is 240 ± 1 px; no tab has a horizontal scrollbar (`scrollWidth <= clientWidth` on each tab's scroll container).

### SB-02 Reachable max width
**Root cause:** main panel `minSize="80%"` caps the sidebar at 20%, below its own `maxSize="90%"`.
- Sidebar `maxSize="50%"`, main panel `minSize="50%"`, sidebar default `20%`. When 20% is below 240 px, the min wins.
- AC (e2e at a 1440 px viewport): dragging the handle fully right puts the sidebar width within 2 px of 50% of the layout width; the main panel stays usable (URL bar visible).

### SB-03 Rows truncate or stack at min width (all three tabs)
The three tabs are Collections, History and Hub (`LeftPanel.tsx` values `collections`, `history`, `hub`).
- Collections: name cells use `min-w-0 flex-1`.
- History (`HistoryItem.tsx:49-64`): replace JS `truncateUrl(...,40)` with CSS truncation; the time never clips the badge; no `pr-8` collision.
- Hub: the `HubProviderCard.tsx:128` footer wraps via `flex-wrap`.
- AC (e2e at 240 px, seeded long names and URLs):
  - Every row's text element has `text-overflow: ellipsis` with `scrollWidth > clientWidth` (it truncates).
  - Method badges and action buttons are fully visible and do not intersect each other's bounding boxes.
  - The panel has no horizontal scroll.

---

# Phase 3: Conversation redesign

### CONV-01 Per-turn timing persisted
- Timing is stamped on the client, because tools run client-side and span several HTTP requests.
- The assistant message's `metadata.turn` holds `{ startedAt, endedAt?, status: "running"|"done"|"stopped"|"error", steps: [{ id, kind: "thinking"|"tool"|"text"|"waiting", toolName?, startedAt, endedAt? }] }`, as epoch ms, persisted in `relay_threads`.
  - `toolName` is internal data and is never rendered.
  - `waiting` steps cover approval and question cards.
- Older messages sent to the server do not need timing. Strip `metadata.turn` from the outgoing body to respect the 256 KB cap.
- A legacy message without `metadata.turn` is tolerated (CONV-11).
- AC: reload the thread and the "Worked for" values are identical to before the reload.
- Unit: the stamping helper, the serialisation round-trip, legacy tolerance, and stripping from the outgoing body.

### CONV-02 Live "Working for Ns" header
- While a turn runs, the header "Working for Ns" replaces the "Thinking..." shimmer as the primary status. Step rows stream beneath it as they happen.
  - It ticks every second.
  - Format: `Ns` under 60 s, `Nm Ns` under 1 h, `Nh Nm` above. The formatter is a single pure function shared with CONV-03.
- While a confirm or question card is pending, the header reads "Waiting for you" and the timer pauses (Assumption 10).
- Unit: the duration formatter at boundaries (0, 59, 60, 3599, 3600 s); the ticking component with fake timers, including the pause and resume.

### CONV-03 Collapsed "Worked for Ns >" group
- On completion, every step, narration, tool row and per-change card folds into one collapsed row, "Worked for Ns", with a right chevron when closed and down when open.
  - Expanded, it shows every step in order with its narration.
  - A per-step duration is shown on thinking steps and on any step lasting 1 s or more (e.g. "Thought 1s").
  - Thinking rows appear only if the model emits reasoning parts.
- Visible after the fold: the final answer text, then the changes summary (CONV-05). Nothing else.
- AC: a turn with no tool steps shows no "Worked for" row, only the answer.
- AC: the group is collapsed by default; toggling it is keyboard accessible (`aria-expanded`).

### CONV-04 Grouped step summaries
- Inside the expanded group, consecutive read steps of the same class collapse into one line, e.g. "Read 3 requests, searched 2 times" or "Explored 2 collections". Write steps stay as individual lines.
- The counting logic is a pure function, `summariseSteps(steps)`. Labels use plural-aware i18n keys in all locales. No raw tool names.
- Unit: grouping across mixed sequences, ordering, pluralisation.

### CONV-05 Single compact changes summary
- After the final answer, one compact summary of this turn's changes, e.g. "Created 2 requests, 1 chain, updated 1 environment".
  - One row per changed entity, each with an Open button.
  - "Undo all" reuses the `TurnChangeBar` logic, now shown when at least one change is un-undone, via `log.undoTurn(turnId)`.
  - Per-change cards (ChangeCard) live only inside the "Worked for" group.
- Open is supported for request, chain, collection and environment. A folder opens its collection, and a settings change opens Settings at its section.
  - Extend `OPENABLE` (`ChangeCard.tsx`) and use the `openEntity` routes (`/chain/${id}`, env, collection).
- Deleted or undone entities show a disabled Open with a tooltip reason ("Deleted" or "Undone").
- Unit: the summary model built from the change log, and openable resolution per kind.
- E2E: create a request, chain, collection and environment via the mocked agent; each Open navigates to the right route; Undo all reverts them and the summary shows them as undone.

### CONV-06 Remove Show details tables and "Step N of 12"
- Delete:
  - The `ChangeDetails` and `buildChangeDiff` UI usage (`ChangeCard.tsx`, plus `changeDiff.ts` if it has no other consumer).
  - The step counter (`RelayConversation.tsx` ~252-259, `RELAY_STEP_INDICATOR_AFTER`, the `step` i18n key).
- Replacement signal: when `RELAY_MAX_STEPS` stops a turn, show one neutral inline notice under the answer: "Relay reached its step limit for one message. Say 'continue' to keep going." No notice otherwise.
- Server `remainingSteps` and client `shouldContinueToolLoop` are unchanged.
- AC: no "Show details" or "Step N of" text appears anywhere in the conversation; the limit notice appears only on the cap.
- Unit: the cap notice is shown if and only if the cap is hit.

### CONV-07 Neutral entity pills
**Root cause:** `EntityPill.tsx` sets `ENTITY_ACCENT_CLASS = "text-primary"` on `bg-muted`, and file-like inline code does the same (`RelayMarkdown.tsx:108`).
- Pills and inline code use `text-foreground` (`text-muted-foreground` for secondary text) on `bg-muted` with a subtle border.
- Colour appears only on method badges (`METHOD_BADGE_CLASSES`).
- This applies to request pills, folder and collection pills, inline code URLs, ChangeCard rows, summary rows and user-bubble pills.
- Unit: class assertions (no `text-primary` on pill or inline code).
- E2E: in light and dark themes, the computed `color` of every `[data-relay-pill]` and inline code element differs from the computed colour of a probe element styled `color: var(--primary)` (compare computed rgb values, not the raw variable), and contrast against its background is at least 4.5:1.

### CONV-08 Chains: no auto-open, live updates
- Verified: today's code has no chain auto-open. The only `/chain/` navigations are `ChainList`, `SidebarSearch`, `OnboardingTour` and click-driven `openEntity`.
- Requirement: `create_chain` and the chain write tools have no navigation side effect, and the system prompt does not instruct the model to open chains.
- An Open button appears in the live step row as soon as the chain exists (mid-turn), and in the changes summary afterwards.
- If the chain page for that id is already open, it re-renders as Relay adds, updates or connects nodes, without a manual refresh.
  - Verify that the store write path used by `add_chain_node`, `update_chain_node` and `connect_chain_nodes` notifies the open editor.
  - If the editor keeps a stale local copy, fix it.
- Unit: no router call from the chain tools; a store update propagates to the editor selector.
- E2E: open a chain page, run the mocked agent adding 3 nodes; the nodes appear without a reload.

### CONV-09 Question-card behaviour (behaviour ships in Phase 1 with BUG-04; stale placement in Phase 3)
- The card shows the options. Clicking an option highlights it and enables "Send"; nothing is sent on the option click.
- A text field lets the user type their own answer. Typing deselects the options, and vice versa.
- "Send" submits the chosen or typed answer as the tool result and as the visible user reply. Empty input with no selection keeps Send disabled.
- **The user types in the main composer while a card is pending:** the composer message becomes the card's answer.
  - The card shows "Answered: <text>".
  - The user bubble still renders, with its pills. The tool result is the message's plain `text`.
  - No dangling tool call is left.
- **The user sends a composer message while a confirm (approval) card is pending:** the confirm is auto-declined and shown as the muted "Skipped because the chat moved on" line (inside the Worked group from Phase 3). Nothing is executed.
- **Stale card** (turn stopped, errored or interrupted by reload): the card becomes a compact, muted, non-interactive line, "Skipped because the chat moved on".
  - In Phase 3 that line renders inside the "Worked for" group, not as dangling text under an assistant message.
- Answered cards show the chosen answer.
- Unit: the state machine (idle / selected / typed / sent / answered-via-composer / skipped).
- E2E:
  - Select an option and Send.
  - Type your own answer and Send.
  - Send a composer message while a card is pending: it is recorded as the answer.
  - Stop the turn while a card is pending: it shows as skipped inside the group.

### CONV-10 User-bubble rendering
- In Phase 3: the bubble's attachment pills (BUG-01 row) use the neutral pill styling (CONV-07). Plain text layout is unchanged.
- Inline positioning arrives in COMP-05.

### CONV-11 Timing edge cases (new)
| Case | Label |
| --- | --- |
| Aborted by Stop or by disabling Relay | "Stopped after Ns" |
| Errored | "Failed after Ns" (the error message stays visible) |
| `status` still `running` after a reload (tab closed mid-turn) | "Interrupted after Ns", using the last step's `endedAt` (or `startedAt` when there are no steps) |
| Legacy message without `metadata.turn` | Collapsed group labelled "Worked" with no duration; steps derived from parts |

- Unit: each case renders the expected label from fixtures.

---

# Phase 4: Composer

### COMP-01 Rich inline editor
- Replace the plain textarea in `RelayComposer.tsx` with a Tiptap editor (Assumption 7) that supports inline atomic pills.
- It keeps:
  - Enter to send, Shift+Enter for a newline.
  - IME composition safety: Enter during composition does not send.
  - Paste as plain text.
  - Autosize up to the existing max height.
  - Accessibility: `role="textbox"`, labelled, pills with accessible names.
  - The existing `@` mention and `/` slash triggers (via `@tiptap/suggestion`).
- SSR-safe: `immediatelyRender: false`, client-only mount.
- Serialisation: editor → `{ text, segments[], attachments[], commands[] }`. `text` keeps readable tokens (`/command`, `@name`) for the model.
- Unit: Enter/Shift+Enter, IME guard, paste sanitisation, serialisation.

### COMP-02 Attachment pills inline
- Attaching (via an @ mention or the picker) inserts an atomic pill at the caret. This replaces the `@label` text insertion and the separate `ComposerPills` row.
  - Backspace deletes the whole pill.
  - Pill content: an icon or method badge plus the name, in neutral colours (CONV-07).
- `attachedItems` is derived from the editor content, which is the single source of truth. Removing a pill removes the attachment, and stale chips cannot occur.
- Unit: insert, delete and derive.

### COMP-03 Slash-command pills inline
- Selecting a slash command inserts a highlighted command pill inline (Cursor style: `commit the code [/commit-push]`). The command may appear mid-sentence.
- If the command needs a target, the BUG-02 picker opens and the chosen target is inserted as an attachment pill right after the command pill.
- The command resolves at send.

### COMP-04 Clear on send
- After send, the editor empties: text, pills and derived attachments.
- If a draft exists (e.g. via `openWithDraft`), it stores segments rather than flat text, so pills survive. Combined with BUG-01.

### COMP-05 Sent bubble renders identical pills
- Message metadata stores the structured segments (text runs, attachment pills, command pills). The bubble at `RelayConversation.tsx:126` renders them in order with the same Pill component.
- Legacy messages (text only) render as before.
- Segments are stripped from older messages in the outgoing body (BUG-01 budget).
- Unit: the serialise → render round-trip and the segment builder.
- E2E: type text, insert an attachment and a slash command, send. The bubble shows the pills inline in the same order, and the composer is empty.

### COMP-06 Turn-scoped attachments
- Defined in BUG-01: the attachments sent with a turn are exactly the pills in that message. The agent receives resolved detail, so it does not call discovery tools to find them.

### COMP-07 Editor edge cases (new)
- A pill whose entity is deleted while still in the composer renders as "deleted" and is sent as a note, not as detail (BUG-01).
- Dictation (STT) text is inserted at the caret as plain text without disturbing pills.
- Composer content of only whitespace or pills is not sendable unless at least one pill is present.
- Unit: each case.

---

# Phase 5: Empty state and popover

### EMPTY-01 Context-aware suggestions
- `EmptyState.tsx` shows 3-4 suggestion buttons chosen from context:
  - Request open: "Explain <request name>".
  - Chain open: chain-oriented suggestions.
  - Environment open: env-oriented suggestions.
  - Nothing open: generic starters (create a request, import cURL, explore workspace).
- A pure function, `pickSuggestions(context)`, returns an ordered list (max 4) with ids.
- Clicking a suggestion with a known target inserts the command plus a target pill and sends. A generic starter opens the BUG-02 picker.
- Unit: `pickSuggestions` for each context, plus the max-4 rule.

### EMPTY-02 Quiet "See everything Relay can do" link
- A text-style link under the suggestions opens the capabilities popover. No large grids.

### EMPTY-03 Single-list capabilities popover
- In `CapabilitiesPanel.tsx`, remove the tabs and render one calm scrollable list:
  - An icon and one short sentence per capability area (from `CAPABILITY_CATEGORIES`).
  - A small "asks first" marker, only on areas where approval applies (derived from `capabilityBadge`).
  - A footer, "What Relay can see": a short privacy note that reflects the `shareValues` wording.
  - The "Change approval mode" action is retained.
- Phase 7 adds new capability areas (TOOL-07).
- AC: no `role="tablist"` in the popover; it scrolls inside a max height; every row and action is keyboard reachable; the marker appears only where approval applies.
- Unit: the category → row model and the marker rules.
- E2E: the popover has no tabs, the privacy footer is visible, and "Change approval mode" still opens the mode selector.
- Design pass: impeccable + layout.

---

# Phase 6: Workspace backup

### BAK-01 File format (versioned envelope)
```
{
  "app": "requestr-backup",          // identifier, must match
  "schemaVersion": 1,                // integer, bump on breaking change
  "idbVersion": 6,                   // IDB_VERSION at export, informational
  "exportedAt": "ISO-8601",
  "appVersion": "x.y.z",             // informational
  "includesSecrets": false,
  "sections": ["collections","environments","chains","history","settings","preferences","relayThreads"],
  "data": {
    "collections": [], "folders": [], "requests": [],
    "environments": [],
    "chains": [], "chainConfigs": [],
    "history": [], "chainRuns": [],
    "settings": {},
    "preferences": {},
    "relayThreads": [], "relayChanges": []
  }
}
```
**Section → stores:**

| Section | Stores |
| --- | --- |
| collections | collections, folders, requests, chainConfigs (keyed by `collectionId`) |
| environments | environments |
| chains | chains |
| history | history, chainRuns |
| settings | the `settings` "app" record |
| preferences | localStorage prefs; written automatically whenever settings is selected, never offered as its own checkbox |
| relayThreads | relay_threads, relay_changes |

- `sections` lists only the included sections, and `data` has keys only for those.
- Raw IDB records are exported unchanged (ids, timestamps, ordering) so a restore is identical. Chain data uses the current persisted shape (after `migrateChainsToV5`).
- `data.preferences` (when the settings section is selected) holds:
  - `requestly_active_env_id`, `rq_collapsed_folders`, `rq_sidebar_open_sections`.
  - `requestly_imported_hub_slugs`.
  - The relay user prefs `rq_relay_enabled`, `rq_relay_permission_mode`, `rq_relay_share_values` and `rq_relay_speech_engine`.
- **Excluded:**
  - `rq_anon_id`.
  - `rq_onboarding_complete` (set to true on import).
  - Volatile Relay state (`rq_relay_open`, `width`, `active_thread`, `onboarded`, `recent`, `mention_request`).
  - `rq_chain_*` UI prefs.
  - The tabs store (ephemeral).
- Relay threads and changes are optional and off by default in the picker. When ticked, the UI notes that "Conversations may contain values you shared with Relay."
- **Large data:** the export is assembled as Blob parts per section (no single giant string). The export dialog shows an estimated size before download.

### BAK-02 Secrets handling
- The export option "Include secret values" is OFF by default and shows a warning: "Anyone with this file can read your secrets. Store it securely."
- **OFF:** every field in the BAK-08 secret list is exported as `""`. Keys and names are retained, and the file has `includesSecrets: false`.
- **ON:** values are included, the file has `includesSecrets: true`, and the warning stays visible while the toggle is on.
- Unit: with OFF, a property test over fixtures seeded with sentinel secret strings checks that no sentinel appears anywhere in the serialised JSON. With ON, all sentinels are present.

### BAK-03 Selective export
- The UI offers "Everything" or "Choose".
  - "Choose" shows section checkboxes (collections, environments, chains, history, settings, Relay threads).
  - For collections, environments and chains it adds a searchable list for picking individual items.
- Selecting a collection auto-includes its folders, its requests and its `chainConfigs` record.
- Selected items that reference an unselected environment, chain or request keep their references. Dangling references are allowed and listed as a count in the export summary.
- The Export button shows per-section counts before download.
- Unit: selection → subset extraction, including the folders, requests and chainConfigs of selected collections, plus the dangling-reference count.

### BAK-04 Restore modes
The import flow: choose a file → validate → preview (counts per section, `exportedAt`, `includesSecrets`) → choose a mode.

**Merge (default):**
- If a record's id does not exist, add it.
- If the id exists and the content is deep-equal (ignoring `updatedAt`), skip it. Re-importing the same file is a no-op.
- If the id exists and the content differs, keep both. The incoming record gets a new id, named entities (collection, environment, chain, request) get the suffix " (imported)", and history entries are never renamed.
- References are remapped through an id-remap table:
  - folder → collection; request → collection/folder.
  - chain node → request; chainConfigs keyPath `collectionId`; chainRuns → chain.
  - `settings.pinnedRequestIds`, `rq_collapsed_folders`, the active env id.
- Existing data is never overwritten.
- Settings and preferences: existing values are kept; only keys absent locally are added.
- Merged `relay_changes` are marked not undoable.

**Replace:**
- Clears the sections present in the file, then writes the incoming data. Sections not in the file are untouched.
- Requires a confirmation dialog that states the counts to be deleted per section, with a destructive "Replace workspace" button. It never applies silently.
- Atomic: one readwrite IDB transaction spans every affected store. On failure it aborts and nothing changes. localStorage preferences are written only after the commit.

**After restore:** a full page reload so every store rehydrates.
- Unit: merge with colliding ids (remap integrity, no new orphan references), identical-record skip, replace atomicity (an injected failure rolls back), counts.

### BAK-05 Validation and errors
| Condition | Message |
| --- | --- |
| JSON parse failure | "This file is not valid JSON." |
| `app !== "requestr-backup"` (foreign file, e.g. a Postman collection) | "This is not a Requestr backup. Use Import for Postman, Insomnia or OpenAPI files." with a link to `/import` |
| `schemaVersion` > supported | "This backup was made by a newer version of Requestr (v{n}). Update the app to restore it." |
| `schemaVersion` < supported with no migration | "This backup version is no longer supported." |

- When `schemaVersion` < supported and a migration exists, run the migration.
- Structural validation uses zod (already a dependency). An invalid section produces "The backup is damaged: {section} is invalid." and nothing is written.
- Files over 100 MB (`BACKUP_SIZE_WARN_BYTES`) show a non-blocking warning ("Large backup, restore may take a while").
- Unit: each error path with fixtures; every message exists in all locales.

### BAK-06 Round-trip criterion
- Export (all sections, secrets ON) → fresh browser profile (empty IDB) → import with Replace. A deep comparison of every exported IDB store (ids, fields, ordering) and of the `data.preferences` keys equals the source.
- E2E uses two Playwright contexts:
  - Seed data in context A via fixtures, then export and capture the download.
  - Import it in context B, then compare store dumps via `indexedDB` evaluation.
- With secrets OFF, the only differences are the blanked BAK-08 fields.
- Unit: `export(import(export(x)))` equals `export(x)` for fixtures, with `exportedAt` excluded from the comparison.

### BAK-07 UI placement
- Settings gets a new "Data" section (`constants.ts`) with:
  - "Export backup", which opens the export dialog with the BAK-02/03 options.
  - "Import backup", with file pick or drop, preview and mode.
- The Import page (`src/app/import/page.tsx`) gets a "Restore a Requestr backup" card that links to the same flow.
- Design: ui-ux-pro-max first, then impeccable + layout for the final output.
- The existing per-collection Postman export is unchanged.

### BAK-08 Secret field list (new; `src/lib/backup/secrets.ts`, single source of truth)
These fields are blanked when secrets are OFF:
- `EnvVariable` with `isSecret: true`: `initialValue` and `currentValue`.
- `AuthConfig`: `bearer.token`, `basic.password`, `api-key.value`. This applies everywhere a request snapshot lives:
  - requests
  - `history[].request` (embeds `HttpTab`)
  - chain node requests
  - chainRuns
- Header values whose name (case-insensitive) is `authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key` or `x-auth-token`. This applies in:
  - request headers
  - `settings.globalHeaders`
  - history request and response headers
  - chain node requests and chainRuns
- The password component of a `settings.proxyUrl` with credentials (`user:pass@host` → `user:@host`).

Exceptions and limits:
- Values that are a pure variable reference (`{{name}}`) are kept, because they are not secrets.
- Response bodies are not redacted (out of scope; the warning says "secret values in saved responses are not removed").
- Unit: each field path is blanked, including `history[].request` and response `Authorization`/`Cookie`/`Set-Cookie` values. `{{var}}` references are kept. (User-confirmed.)

### BAK-09 Post-restore reconciliation (new)
- After Replace (or Merge), tabs in the tabs store whose request id no longer exists are closed.
- Chain nodes that reference a missing request render a missing-request placeholder and do not crash. Review note (2026-10-26): no such placeholder exists today (`useChainRequests` computes `missingIds` but nothing renders them, so the node is silently dropped). The placeholder is new work in TASKS T6.9 and T6.10 and reuses the `NodeShell` broken-reference state that `SubChainNode` uses. The restore summary reports a count of dangling references.
- Other open Requestr browser tabs: after a restore, a `BroadcastChannel` message tells them to reload, so they cannot write stale state back.
- Unit: tab reconciliation and the dangling count.
- E2E: Replace with a backup missing a request that a chain node references; the chain page renders the placeholder.

---

# Phase 7: Relay tools

Tool kinds:
- **read:** no approval.
- **auto:** runs without a confirm, subject to the permission mode.
- **confirm:** asks first.

Every tool is registered in `registry.ts` and `schemas.ts`, with `relay.tools.<name>.running/done` labels in all locales (plain language, no tool names). The capability list is updated (TOOL-07).

### TOOL-01 App settings (a)
- `get_app_settings` (read) returns:
  - theme, language (`locale`), accent colour.
  - Proxy config (`proxyUrl` credentials masked, `sslVerify`, `followRedirects`).
  - Global base URL and global headers (BAK-08 header values masked unless `shareValues`).
  - Relay prefs (enabled, shareValues, speechEngine). The permission mode is reported read-only.
- Write tools:
  - `set_theme` (auto), `set_language` (auto), `update_proxy_settings` (auto).
  - `set_global_variables` (auto): `globalBaseUrl` and `globalHeaders`, matching `GlobalSection.tsx`.
  - `set_relay_preferences` with fields shareValues, speechEngine and enabled. It is auto for shareValues and speechEngine. It needs confirm when it sets `enabled: false`, and that change applies after the current turn ends. It rejects `permissionMode`, and `speechEngine: "grok"` when STT is not configured.
- AC: each tool mirrors the Settings UI store action (same store method). Changes are recorded in the change log with Undo (restore the previous value) and appear in the CONV-05 summary with "Open Settings".

### TOOL-02 Navigation (b)
- `open_item` is extended (`OPEN_ITEM_KINDS`) to request, chain, environment, collection and folder (a folder opens its collection and expands it).
- `open_page` (auto) covers the real routes under `src/app` (no `basePath`): `/app` (workspace home, the same target `openEntity` uses for collections; `/` is the landing page and is not a target), `/settings` (optional section), `/import`, `/environments`, `/json-compare`, `/json-visualize`, `/transform`. Path prefixes are aligned with `src/lib/relay/openEntity.ts`.
- `show_sidebar_tab` (auto) switches the left panel to collections, history or hub. History is a sidebar tab, not a route.
- Add the new navigation tools to `NAVIGATION_TOOLS` (`schemas.ts:729`) so the permission mode never gates them.
- Unit: the route mapping for every enum value, plus rejection of unknown values.

### TOOL-03 Backup (c)
- `export_backup` (confirm): sections, selected ids, `includeSecrets` (default false). The confirm card always lists the sections and counts. When `includeSecrets: true`, it also shows the BAK-02 warning. Approval triggers the download.
- `import_backup` (confirm): the confirm card contains a "Choose file" button. The file chooser needs a user gesture, so the tool cannot open it itself.
  - After the file is picked, the card shows the BAK-04 preview.
  - Relay imports run Merge only. Replace remains a user action in Settings → Data, because it is close to the wiping deny-list item.
  - Relay imports never apply `rq_relay_permission_mode` from the file.
  - Relay never reads the file text. The tool result is the summary counts only (or "cancelled").
- Unit: the schemas, merge-only enforcement, permission mode not applied, and that the result contains no file content.

### TOOL-04 Remaining entity ops (d)
- `duplicate_collection` (auto), `duplicate_chain` (auto), `duplicate_environment` (auto).
- `create_folder` (auto), `rename_folder` (auto), `delete_folder` (confirm). Verify existing folder coverage via `move_item` first and add only what is missing.
- `export_postman` (auto): per collection, using the existing exporter; triggers the download.
- `import_api_catalog` (confirm): imports a hub/API catalog provider by slug (`src/lib/hub.ts`) and updates `requestly_imported_hub_slugs`.
- Every write op is recorded in the change log with Undo and appears in the CONV-05 summary with Open.
- Do not invent tools for actions that are absent from the manual UI.

### TOOL-05 Deny-list
- No tool exists for these, and the system prompt states Relay cannot: change the approval/permission mode, or wipe or clear all data.
- A registry unit test asserts:
  - No tool name or schema targets the permission mode or a wipe-all operation.
  - `set_relay_preferences` rejects `permissionMode`.
  - `import_backup` cannot select Replace.
- When asked to do either, Relay replies in plain language that the user must do it in Settings.

### TOOL-06 Tool cards
- Tool step rows and change cards use the layout skill, with consistent compact rows and plain-language labels.
- Unit: every registered tool has running/done labels in all locales (the test iterates the registry).

### TOOL-07 Capability list and prompt update (new)
- Add capability areas for settings, navigation and backup to `CAPABILITY_CATEGORIES` and `CAPABILITY_ACTIONS`, with "asks first" markers per tool kind (EMPTY-03).
- Update the system prompt's capability description without tool names in user-facing examples (BUG-03).
- Unit: every new tool maps to a capability area.

---

# Phase 8: Grok STT

### STT-01 Server route
- `POST /api/relay/stt` (`src/app/api/relay/stt/route.ts`) accepts multipart with `audio` (WAV) and an optional `language`.
- It forwards to `https://api.x.ai/v1/stt` with `Authorization: Bearer ${process.env.XAI_API_KEY}`:
  - Option fields come before `file`, which is the last field.
  - `model` = the `GROK_STT_MODEL` constant, `grok-voice-transcribe-2.0`.
  - `language` is sent when mapped.
  - `format=true` only when `language` is in Grok's formatting list (ar, zh, en, fr, de, ja, pt, ru, es, sv, vi).
- It returns only `{ text, language, duration }`.
- Guards, in order:
  1. Same-origin check (reuse the chat route's origin helper).
  2. Relay env flag on.
  3. Key configured.
  4. Content type `audio/wav`.
  5. Size ≤ 8 MB (`STT_MAX_UPLOAD_BYTES`).
- It never logs or returns the key. Request ids are logged without audio.
- Env: `XAI_API_KEY` in `.env` and documented in `.env.example`.

### STT-02 Configured status
- Delivery: pulled forward and built in Phase 7 (TASKS T7.4, PLAN slice S7.1), because `set_relay_preferences` (TOOL-01) must reject `grok` when STT is not configured. Phase 8 consumes it.
- `GET /api/relay/stt/status` returns `{ configured: boolean }` (`Boolean(process.env.XAI_API_KEY)`), with no key material and `Cache-Control: no-store`. It has the same origin and env-flag guards.
- The client hook `useSttConfigured()` fetches once per session. A failed fetch is treated as `configured: false`.

### STT-03 Capture format
- The client records via Web Audio: an `AudioWorklet`, or `ScriptProcessorNode` as fallback. It resamples to 16 kHz mono PCM16 and packs a WAV in the browser. Never send webm.
- If neither capture API is available, the Grok option is disabled with a message.
- The pure encoder `encodeWav(samples, rate)` is unit tested: header bytes, length, clipping.
- Max length is 120 s (`STT_MAX_RECORDING_MS`). At the cap, recording auto-stops, a toast says "Recording limit reached", and the audio is transcribed (not discarded).

### STT-04 Language
- `language` comes from the app locale via the existing `SPEECH_LANG_BY_LOCALE` map, reduced to ISO-639-1 (en, fr, ja).
- An unmapped locale omits `language` (auto-detect) and omits `format`.

### STT-05 Errors
| Upstream / condition | Route response | Client message |
| --- | --- | --- |
| 400 | 400 `bad_audio` | "Audio could not be processed." |
| 401 | 502 `upstream_auth` | "Grok transcription isn't set up correctly. Switch to Browser dictation in Settings → Relay." |
| 413 | 413 `too_large` | "Recording too long." |
| 429 | 429, `Retry-After` passed through | "Voice service is busy. Try again in a moment." |
| 502/503 | 503 `unavailable` | "Voice service unavailable." |
| Missing key | 503 `not_configured` | (Grok option disabled) |
| Network failure | n/a | "Couldn't reach the voice service." |

- Every message exists in all locales.
- The recording is not lost on error: a Retry button keeps the WAV blob in memory until dismissed or until the next recording.
- Unit: the route handler with mocked fetch per status; the key never appears in the response body; the field order puts `file` last.

### STT-06 Engine picker in Settings → Relay
- New setting `speechEngine: "browser" | "grok"`, persisted in `useRelayStore` (localStorage `rq_relay_speech_engine`), default `browser`. The store field is built in Phase 7 (TASKS T7.4); the picker UI and fallback are Phase 8.
- When `configured` is false, the Grok option is disabled with the hint "Set XAI_API_KEY on the server to enable".
- If the stored engine is grok but STT is not configured, fall back to browser at runtime without overwriting the stored value.
- Unit: the default, the fallback logic, the disabled state.

### STT-07 Mic behaviour
- MicButton shows the active engine with a small label or tooltip, "Browser" or "Grok".
- With the Grok engine, recording shows a live level meter: RMS from an `AnalyserNode`, about 10 updates per second (`STT_LEVEL_UPDATE_MS = 100`), 5 bars (`STT_LEVEL_BARS`). The Browser engine keeps its existing listening indicator, because Web Speech exposes no stream.
- Clicking again stops recording. The Grok path then shows "Transcribing...", and the text is inserted at the composer caret (not auto-sent).
- The `SpeechPrivacyNote` variant for Grok says audio is sent to xAI for transcription.
- Unit: level computation and the hook state machine (idle / recording / transcribing / error).
- E2E (route mocked via Playwright `page.route`, Chromium fake audio device flags):
  - Grok engine: record, stop, and the text lands in the composer.
  - The engine label is visible.
  - The Grok option is disabled when status reports unconfigured.

### STT-08 STT edge cases (new)
- **Mic permission denied** (`NotAllowedError`) for either engine: show an inline error, "Microphone access is blocked. Allow it in your browser's site settings." No request is sent.
- **No microphone** (`NotFoundError`): "No microphone found."
- **Recording under 0.5 s** (`STT_MIN_RECORDING_MS`): it is not uploaded; the message is "Didn't catch that."
- While transcribing, the mic button is disabled.
- If the dock closes, the thread switches, or Relay is disabled during recording or transcription, the stream stops, the request is aborted, and nothing is inserted.
- Unit: each case in the hook state machine.

---

# Cross-cutting

### XC-01 Existing tests updated, not deleted (new)
These existing specs assert behaviour this epic changes. Each phase updates the ones it affects and includes them in its targeted run:
- `src/components/relay/RelayConversation.spec.tsx`: declined note, step counter.
- `src/components/relay/ConfirmCard.spec.tsx`: "Skipped".
- `src/components/settings/RelaySection.spec.tsx`.
- `src/stores/useRelayStore.spec.ts`: position.
- The ChangeCard, AskUserCard, MentionMenu, RelayComposer, CapabilitiesPanel and EnvSelector specs, where they exist.
- e2e `e2e/qa/relay/relay-chat.spec.ts`, `relay-polish-shield.spec.ts` and `relay-privacy.spec.ts`.

A spec may be rewritten to the new behaviour, but must not be weakened to pass.

# Testing strategy

- **Unit (Vitest):** colocated `*.spec.ts(x)` files next to the source.
  - Cover all the pure logic named above: timing, summaries, backup export/import/validate/merge/replace/secrets, the WAV encoder, the route handler, `pickSuggestions` and the selectors.
  - Assert effects, not only store writes.
  - No tests under `src/components/reactbits/`.
- **E2E (Playwright):** base URL `https://requestly.localhost/app` via `PLAYWRIGHT_TEST_BASE_URL`.
  - One targeted spec per phase in `e2e/qa/relay/`: relay-v2-bugs (plus relay-settings), relay-v2-sidebar, relay-v2-conversation, relay-v2-composer, relay-v2-empty, relay-v2-backup (two contexts for the round trip), relay-v2-tools, relay-v2-stt.
  - Run only the specs for the phase being verified, plus the XC-01 specs it touches. Never the full suite.
  - Model responses are mocked at the `/api/relay/chat` boundary for determinism.
- Typecheck (`bun run typecheck`) runs once after each phase is complete, not mid-task.
- **Per-phase DoD:**
  - Unit tests green.
  - Phase e2e green.
  - `bun run lint:check` clean.
  - i18n parity: a unit test diffs the key sets of every namespace across `messages/*`.

## i18n

- All new copy is added to every locale under `messages/` (en, fr, ja) in the matching namespace file (`relayDock.json`, `relay.json`, `settings.json`, `errors.json`, `common.json`). That covers labels, errors, tooltips, step summaries with plural forms, timing labels, backup messages and STT messages.
- Removed features (Position, Step N, Show details, the picker footer hint) have their keys removed from all locales.
- The parity test enforces this.

## Success criteria (epic)

1. Every requirement ID has at least one passing unit and/or e2e test mapped in the plan.
2. The BAK-06 round trip passes.
3. No pill or inline code has a computed colour equal to `--primary` (CONV-07). There is no "Show details" and no "Step N of 12", and no registered tool name appears in any relay i18n string or rendered card (BUG-03).
4. With Enable off, every Relay surface listed in BUG-05 is hidden, and Position is gone.
5. The Grok engine works end to end against a mocked upstream and falls back to Browser when unconfigured.

## User-confirmed decisions (2026-10-26, after audit)

1. **Merge collisions (BAK-04):** skip deep-equal records; when the same id has different content, keep both, with the incoming record renamed " (imported)". Incoming data never overwrites existing data.
2. **Secrets OFF (BAK-02/BAK-08):** blank every field in the BAK-08 list everywhere it occurs, including history. That covers `Authorization`, `Cookie` and the other sensitive header values, plus auth values. `{{var}}` references are kept.
3. **Composer message while a card is pending (CONV-09):** text typed in the composer while a question card is pending answers that card. A pending approval card is declined automatically.

## Open questions

None.

## Requirement index (61)

BUG-01..12 (12), SB-01..03 (3), CONV-01..11 (11), COMP-01..07 (7), EMPTY-01..03 (3), BAK-01..09 (9), TOOL-01..07 (7), STT-01..08 (8), XC-01 (1). Total 61.
