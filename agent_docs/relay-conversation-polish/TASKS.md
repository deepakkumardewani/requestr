# Tasks: relay-conversation-polish

Source: `SPEC.md` and `PLAN.md` in this folder. Format per `~/.claude/docs/task-conventions.md`.

Conventions for this file:
- Package manager is bun. Dev server is `https://requestly.localhost/app` and is always running; never start it. Run targeted specs only, never the full e2e suite.
- E2E base: `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app`. The project has the seeded QA harness (`e2e/fixtures/qa.ts`, `e2e/qa/relay/`), so browser Verify steps are `bunx playwright test e2e/qa/relay/<spec>`; `agent-browser` is used only for screenshots.
- Implementation tasks keep EXISTING specs green (update assertions their change breaks) but do not author new coverage; new coverage comes from the dedicated `Unit:` and `E2E:` tasks.
- One `bun run tsc --noEmit` and `bun run lint` only in the final gate (T6.1), never per phase.
- Do not commit unless told.
- Phase 0 is not needed: Playwright/Vitest exist, `playwright.config.ts` already supports `E2E_SERVER=dev|prod` (`E2E_PROD_PORT`, `reuseExistingServer: false` for prod), and `.gitignore` already covers `test-results`, `playwright-report`, `coverage/`, `.dashboard/*/reports/`, `.next-e2e`.
- E2E specs are split by area (`e2e/qa/relay/relay-conversation-polish-<area>.spec.ts`) so each has one author and one flow; T6.2 runs them all together as the Objective walkthrough.

---

## Phase 1: Chain tool, open_item text and scope prompt (R1, R2, R6)

**Adds:** Relay creates chains as standalone items (no collection is made to hold them), `open_item` describes every kind it can open, and the system prompt declines off-topic asks.
**Try in UI:** Ask Relay "create a sample chain with 3-4 nodes" ; Check the collections sidebar has no new collection ; Ask "create a chain and open it" and confirm you land on `/chain/<id>` ; Ask "what is 17*23" and confirm a polite decline with no tool calls.

### ✅ T1.1 ☐ Standalone-only `create_chain`
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/schemas.ts` (~445), `src/lib/relay/tools/chainWrite.ts` (~511), `src/lib/relay/tools/chainWrite.spec.ts`, `src/lib/relay/tools/schemas.spec.ts`, `src/lib/relay/tools/registryGuarantees.spec.ts`
- **Do:** Grep for every caller or fixture passing `collectionId` to `create_chain` first. Change the schema to `z.strictObject({ name })` with a description that says it creates an empty standalone chain and to add nodes with `add_chain_node` (no collection wording). In `createChain` drop the collection branches and the "already has a chain" check; `id = generateId()`, `scope` always `"standalone"`. Keep `ensureCollectionChain`, `Chain.collectionId` and the `/chain/[collectionId]` route untouched. Fix existing specs this breaks.
- **Acceptance:**
  - `create_chain {name:"X"}` makes one chain with a generated id, scope `standalone`, zero new collections (AC1.1).
  - `create_chain {name, collectionId}` fails schema validation (AC1.2).
  - Description mentions standalone and `add_chain_node`, never collections (AC1.3).
  - Existing collection chains still read, update, open and undo; `useChainStore.spec.ts` unchanged and green (AC1.4).
- **Verify:** `bun run vitest run src/lib/relay/tools/chainWrite.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/tools/registryGuarantees.spec.ts src/stores/useChainStore.spec.ts`

### ✅ T1.2 ☐ `open_item` description names every kind
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/schemas.ts` (~639), `src/lib/relay/tools/schemas.spec.ts`
- **Do:** Build the description from `OPEN_ITEM_KINDS` so it lists request (opens a tab), chain (opens its page), environment, collection, folder (reveals it in the sidebar). Do after T1.1 (same file).
- **Acceptance:**
  - Description contains `request`, `chain`, `environment`, `collection`, `folder` (AC2.1).
  - It is derived from or checked against `OPEN_ITEM_KINDS` (AC2.2).
- **Verify:** `bun run vitest run src/lib/relay/tools/schemas.spec.ts`

### ✅ T1.3 ☐ Standalone-chain rule and `SCOPE_RULES` in the system prompt
- **Kind:** implementation
- **Files:** `src/lib/relay/server/systemPrompt.ts`, `src/lib/relay/server/systemPrompt.spec.ts`
- **Do:** Add the line "Chains are standalone; never create a collection just to hold a chain." Add a `SCOPE_RULES` block next to `CAPABILITIES` and include it in the assembled array. It names the in-scope list (Requestr workspace features, general HTTP/API concepts, scripts and tests for requests) and the decline behaviour (brief friendly decline naming what Relay can help with, no partial answer, no tool calls).
- **Acceptance:**
  - Built prompt contains the scope block (in-scope list and decline behaviour) and the chain rule (AC6.1).
  - Grep of `systemPrompt.ts` and `schemas.ts` finds no text steering chains into collections (AC1.3).
  - Manual live-model checks AC1.6 and AC6.2 are noted for the final gate; they are not CI gates.
- **Verify:** `bun run vitest run src/lib/relay/server/systemPrompt.spec.ts`; `grep -n -i "collection" src/lib/relay/server/systemPrompt.ts` shows nothing that attaches chains to collections.

### ✅ T1.4 ☐ Unit: chain tool, open_item text, system prompt
- **Kind:** unit
- **Files:** `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/chainWrite.ts`, `src/lib/relay/server/systemPrompt.ts`
- **Do:** Cover AC1.1, AC1.2, AC2.1, AC2.2, AC6.1 and the collection-chain regression (read, update, open, undo of a seeded collection chain, AC1.4).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/lib/relay/tools/chainWrite.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/server/systemPrompt.spec.ts --coverage --coverage.include=src/lib/relay/tools/schemas.ts,src/lib/relay/tools/chainWrite.ts,src/lib/relay/server/systemPrompt.ts --coverage.reporter=text`

### ✅ T1.5 ☐ E2E: standalone chain and open it
- **Kind:** e2e
- **Scenarios:**
  - `@critical` stub model scripts `create_chain {name}` + 4x `add_chain_node`: collections list (count and ids) unchanged, new chain has no `collectionId` (AC1.5)
  - `@critical` "create a chain and open it" ends at `/chain/<id>` of the created chain (AC2.3)
  - `@high` an existing seeded collection chain is still editable and openable via Relay (AC1.4)
- **Spec:** `e2e/qa/relay/relay-conversation-polish-chain.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; no collection is created by the chain flow; the existing `relay-v2-chain-live` and `relay-v2-tools-entities` specs stay green.
- **Files:** none expected; fix `e2e/qa/relay/relay-v2-chain-live.spec.ts` and `relay-v2-tools-entities.spec.ts` if they pass `collectionId` or expect a collection.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-chain.spec.ts e2e/qa/relay/relay-v2-chain-live.spec.ts e2e/qa/relay/relay-v2-tools-entities.spec.ts --repeat-each=3`

🔶 **Checkpoint 1**: create_chain is standalone, open_item text lists all kinds, scope prompt present; listed vitest and e2e specs green.

---

## Phase 2: Open matrix and sidebar reveal (R3)

**Adds:** The dead disabled "Open" button is gone; Open appears only where it does something, and opening a collection or folder reveals, selects and scrolls to it in the sidebar.
**Try in UI:** Ask Relay to create a folder inside a collapsed nested collection, click Open on its card ; Confirm the folder row is expanded, selected and in view even when already on `/app` ; Ask Relay to delete a collection and confirm its card shows no Open button.

### ✅ T2.1 ☐ Drop the disabled `OpenState`; complete the matrix
- **Kind:** implementation
- **Files:** `src/lib/relay/changesSummary.ts`, `src/components/relay/ChangeCard.tsx`, `src/components/relay/TurnChangeBar.tsx`, `src/components/relay/ToolRow.tsx`
- **Do:** `OpenState = { target } | null`; remove `OpenDisabledReason`. `resolveOpen` returns `null` for deleted, undone, missing targets, navigation ("Opened X") and read-only/explore steps. Collection/folder created or updated yield a reveal target; chain created and chain node changes yield `/chain/<id>`; request yields its tab; environment and settings unchanged. Consumers render no Open control when `open` is null (not rendered, not disabled). Update existing specs these break.
- **Acceptance:**
  - Each matrix row yields the stated `open` value; no `{enabled:false}` anywhere in the type (AC3.1).
  - `ChangeCard`, `ChangesSummary`, `ToolRow` render no Open control for deleted/undone/tab rows (AC3.2).
- **Verify:** `bun run vitest run src/lib/relay/changesSummary.spec.ts src/components/relay/ChangeCard.spec.tsx src/components/relay/ChangesSummary.spec.tsx src/components/relay/ToolRow.spec.tsx src/components/relay/TurnChangeBar.spec.tsx`

### ✅ T2.2 ☐ Remove disabled-tooltip i18n keys
- **Kind:** implementation
- **Files:** `messages/en/relayDock.json`, `messages/fr/relayDock.json`, `messages/ja/relayDock.json`
- **Do:** Delete the keys only used by the disabled Open tooltip (confirm by grep that nothing references them after T2.1).
- **Acceptance:** Key sets identical across en/fr/ja; no orphaned key referenced in `src`.
- **Verify:** `bun run vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`

### ✅ T2.3 ☐ Reveal helper and sidebar reveal store
- **Kind:** implementation
- **Files:** `src/lib/relay/openEntity.ts`, `src/stores/useSidebarRevealStore.ts` (new), `src/components/layout/SidebarMainTab.tsx`, `src/components/relay/ChangeCard.tsx`, the tree-row component `SidebarMainTab.tsx` renders (confirm path)
- **Do:** First do one wider search for an existing selection/scroll mechanism (`SidebarMainTab.tsx`, relay pills, `useUIStore`); reuse it if found, else add a minimal transient `useSidebarRevealStore` the tree row subscribes to (select + `scrollIntoView`). Export the folder-expansion helper from `openEntity.ts` (collection via `openCollection`; folder expands itself and every parent). Wire `useOpenTarget` (exported from `ChangeCard.tsx`) for collection/folder: navigate to `WORKSPACE_HOME_ROUTE`, expand ancestors, select, scroll. Must work when already on `/app`.
- **Acceptance:**
  - Nested folder: all ancestors expanded and the collection opened in `useFolderExpandStore` (AC3.3).
  - Reveal works while already on `/app` (no navigation no-op bug).
- **Verify:** `bun run vitest run src/lib/relay/openEntity.spec.ts src/components/relay/ChangeCard.spec.tsx`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-tools-nav.spec.ts`

### ✅ T2.4 ☐ Unit: open model and reveal
- **Kind:** unit
- **Files:** `src/lib/relay/changesSummary.ts`, `src/lib/relay/openEntity.ts`, `src/stores/useSidebarRevealStore.ts`
- **Do:** Matrix rows (AC3.1) and nested-folder reveal helper (AC3.3), reveal store set/clear behaviour.
- **Acceptance:** Every file >=80% on all four metrics, target >95%; no `it.fails` unless real bug.
- **Verify:** `bunx vitest run src/lib/relay/changesSummary.spec.ts src/lib/relay/openEntity.spec.ts src/stores/useSidebarRevealStore.spec.ts --coverage --coverage.include=src/lib/relay/changesSummary.ts,src/lib/relay/openEntity.ts,src/stores/useSidebarRevealStore.ts --coverage.reporter=text`

### ✅ T2.5 ☐ Unit: Open control rendering
- **Kind:** unit
- **Files:** `src/components/relay/ChangeCard.tsx`, `src/components/relay/ChangesSummary.tsx`, `src/components/relay/ToolRow.tsx`, `src/components/relay/TurnChangeBar.tsx`
- **Do:** Component tests: no Open control (`queryByRole('button',{name:/open/i})` is null) for deleted, undone and tab rows; Open present for request, chain, collection, folder rows (AC3.2).
- **Acceptance:** Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/components/relay/ChangeCard.spec.tsx src/components/relay/ChangesSummary.spec.tsx src/components/relay/ToolRow.spec.tsx src/components/relay/TurnChangeBar.spec.tsx --coverage --coverage.include=src/components/relay/ChangeCard.tsx,src/components/relay/ChangesSummary.tsx,src/components/relay/ToolRow.tsx,src/components/relay/TurnChangeBar.tsx --coverage.reporter=text`

### ✅ T2.6 ☐ E2E: Open reveal and no dead Open
- **Kind:** e2e
- **Scenarios:**
  - `@critical` folder created in a collapsed nested collection: click Open, folder row visible, selected, in viewport, even already on `/app` (AC3.4)
  - `@critical` collection deleted via Relay: its row shows no Open (AC3.5)
  - `@high` undone change row shows no Open
  - `@medium` chain card Open navigates to `/chain/<id>`
- **Spec:** `e2e/qa/relay/relay-conversation-polish-open.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; no Open control is present on deleted or undone rows; the folder row is visible, selected and in the viewport after Open.
- **Files:** none expected (update `relay-v2-tools-nav.spec.ts` / `relay-v2-changes.spec.ts` assertions of the old disabled Open if they fail).
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-open.spec.ts e2e/qa/relay/relay-v2-tools-nav.spec.ts e2e/qa/relay/relay-v2-changes.spec.ts --repeat-each=3`

🔶 **Checkpoint 2**: `OpenState` has no disabled branch, no dead Open anywhere, reveal works from `/app`; vitest and e2e above green.

---

## Phase 3: Compact cards, grouping, summary threshold (R4)

**Adds:** Change cards become one compact row with icon-only Undo/Open, a sample chain build collapses into one grouped card ("Built chain X · 4 nodes"), and the end-of-turn summary appears only for 2+ changes.
**Try in UI:** Ask Relay "create a sample chain with 3-4 nodes" and see ONE grouped card ; Hover the icon Undo/Open buttons for tooltips ; Click group Undo and confirm all nodes are undone and Open disappears ; Make a single change and confirm no end-of-turn summary bar.

### ✅ T3.1 ☐ Grouping view-model
- **Kind:** implementation
- **Files:** `src/lib/relay/changesSummary.ts`, `src/lib/relay/changeGroups.ts` (new, only if `changesSummary.ts` would pass ~300 lines)
- **Do:** Pure grouping step: consecutive same-turn changes to the same chain (`create_chain`, `rename_chain`, `add_chain_node`, `update_chain_node`, `connect_chain_nodes`, `delete_chain_node`) collapse into a group holding ordered member changeIds, `created` vs `updated` kind, and node count = distinct nodes present after the group's own adds/deletes (connects and renames do not count). `delete_chain` never grouped; group of one is a plain card; chain deleted later in the turn means no Open; a different chain or intervening non-chain change breaks the group. Shared by inline cards and summary rows. No change-log mutation.
- **Acceptance:**
  - create_chain + 4 add_chain_node (+ connects) gives one group, count 4, order and ids retained (AC4.3).
  - Different chain or non-chain change between breaks the group; edge cases from R4 each behave as specified.
- **Verify:** `bun run vitest run src/lib/relay/changesSummary.spec.ts`

### ✅ T3.2 ☐ Group label i18n keys
- **Kind:** implementation
- **Files:** `messages/en/relayDock.json`, `messages/fr/relayDock.json`, `messages/ja/relayDock.json`
- **Do:** Add ICU-plural keys for `Built chain "X" · N nodes` and `Updated chain "X" · N changes`, translated naturally in fr/ja.
- **Acceptance:** Identical key sets in all three locales; plural forms valid.
- **Verify:** `bun run vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`

### ✅ T3.3 ☐ Compact `ChangeCard` with icon-only Undo/Open
- **Kind:** implementation
- **Files:** `src/components/relay/ChangeCard.tsx`, `src/components/relay/MessageParts.tsx`
- **Do:** One row at `h-7`, remove `my-1.5` and extra vertical padding; tool-group container gap to `gap-1` (`MessageParts.tsx` ~272 and ~313). Undo and Open become `Button size="icon"` with `ComposerTip` and `aria-label` from the existing i18n Undo/Open strings (no hardcoding); keep `RELAY_COARSE_TOUCH_CLASS`.
- **Acceptance:**
  - Card has no `my-*`/`p-2` classes; bounding box height <= 32px (AC4.1).
  - Undo/Open have an accessible name, no visible text, tooltip on hover/focus (AC4.2).
- **Verify:** `bun run vitest run src/components/relay/ChangeCard.spec.tsx src/components/relay/MessageParts.spec.tsx`

### ✅ T3.4 ☐ Grouped card and group Undo
- **Kind:** implementation
- **Files:** `src/components/relay/ChangeGroupCard.tsx` (new), `src/components/relay/ChangeCard.tsx`, `src/components/relay/MessageParts.tsx`
- **Do:** Render a group as one card using the T3.2 label. Group Undo undoes every member newest first; if some are blocked, undo the unblocked and show the existing partial-undo "N could not be undone" notice (Q3). Group Open goes to `/chain/<id>`; no Open if the chain was deleted later in the turn. Group of one renders as a normal card. Extract JSX into `ChangeGroupCard` rather than inlining.
- **Acceptance:**
  - Group Undo invokes undo for every member change; afterwards the card shows the undone state with no Open (AC4.4).
  - Partially blocked undo reports the blocked count via existing messaging.
- **Verify:** `bun run vitest run src/components/relay/ChangeCard.spec.tsx src/components/relay/ChangeGroupCard.spec.tsx`

### ✅ T3.5 ☐ Summary threshold and grouped summary rows
- **Kind:** implementation
- **Files:** `src/components/relay/TurnChangeBar.tsx`, `src/components/relay/ChangesSummary.tsx`, `src/components/relay/MessageParts.tsx` (~372)
- **Do:** Render `TurnChangeBar`/`ChangesSummary` only for 2+ distinct changes (navigation changes filtered out, group members counted individually) so "chain + 4 nodes" shows a summary with one grouped row. Summary rows use the same Open matrix and grouping.
- **Acceptance:** Nothing for 0 or 1 changes; "Undo all" bar for 2+; chain + 4 nodes shows one grouped row (AC4.5).
- **Verify:** `bun run vitest run src/components/relay/TurnChangeBar.spec.tsx src/components/relay/ChangesSummary.spec.tsx`

### ✅ T3.6 ☐ Unit: grouping model
- **Kind:** unit
- **Files:** `src/lib/relay/changesSummary.ts`, `src/lib/relay/changeGroups.ts` (if created)
- **Do:** AC4.3 plus each R4 edge case: no `create_chain` gives "Updated" label, `delete_chain` never grouped, single-member group, chain deleted later, connects/renames not counted, adds then deletes net count.
- **Acceptance:** Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/changesSummary.spec.ts src/lib/relay/changeGroups.spec.ts --coverage --coverage.include=src/lib/relay/changesSummary.ts,src/lib/relay/changeGroups.ts --coverage.reporter=text` (drop the `changeGroups` entries if the file was not created)

### ✅ T3.7 ☐ Unit: card and summary components
- **Kind:** unit
- **Files:** `src/components/relay/ChangeCard.tsx`, `src/components/relay/ChangeGroupCard.tsx`, `src/components/relay/TurnChangeBar.tsx`, `src/components/relay/ChangesSummary.tsx`
- **Do:** AC4.1 (classes), AC4.2 (names and tooltips), AC4.4 (group Undo, partial block), AC4.5 (threshold).
- **Acceptance:** Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/components/relay/ChangeCard.spec.tsx src/components/relay/ChangeGroupCard.spec.tsx src/components/relay/TurnChangeBar.spec.tsx src/components/relay/ChangesSummary.spec.tsx --coverage --coverage.include=src/components/relay/ChangeCard.tsx,src/components/relay/ChangeGroupCard.tsx,src/components/relay/TurnChangeBar.tsx,src/components/relay/ChangesSummary.tsx --coverage.reporter=text`

### ✅ T3.8 ☐ E2E: compact and grouped cards
- **Kind:** e2e
- **Scenarios:**
  - `@critical` sample chain with 3-4 nodes shows ONE grouped card with node count (AC4.6)
  - `@high` card bounding-box height <= 32px; consecutive cards ~4px apart (AC4.1)
  - `@high` group Undo undoes the whole chain build and removes Open
  - `@medium` single change shows no end-of-turn summary; 2+ changes show "Undo all" (AC4.5)
- **Spec:** `e2e/qa/relay/relay-conversation-polish-cards.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the sample chain flow renders exactly one grouped card; card height is 32px or less; the summary bar shows only for 2+ changes.
- **Files:** none expected (update `relay-v2-changes.spec.ts` and `relay-confirm.spec.ts` for compact cards, icon buttons and the threshold).
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-cards.spec.ts e2e/qa/relay/relay-v2-changes.spec.ts e2e/qa/relay/relay-confirm.spec.ts --repeat-each=3`

🔶 **Checkpoint 3**: cards are compact, chain builds group into one card, summary threshold correct; screenshots of compact and grouped card captured (agent-browser, session `requestly`, seeded with `--init-script e2e/fixtures/qa-seed.init.js`, then `agent-browser close`).

---

## Phase 4: Ask-user card (R5)

**Adds:** Ask-user options stack vertically and submit on click, and Send becomes a white paper-plane icon button.
**Try in UI:** Trigger an ask-user prompt ; Confirm options are one per line, full width ; Click an option and see it submit immediately ; Type in the input and confirm the plane Send button enables and Enter submits.

### ✅ T4.1 ☐ Simplify `askUserState`
- **Kind:** implementation
- **Files:** `src/lib/relay/askUserState.ts`, `src/lib/relay/askUserState.spec.ts`
- **Do:** Remove the unused `selected` phase for options in `reduceAsk`; keep `typed`, `sent`, `skipped`, `answeredViaComposer` and settled rendering.
- **Acceptance:** Reducer spec updated and green; a second choose after `sent` is a no-op.
- **Verify:** `bun run vitest run src/lib/relay/askUserState.spec.ts`

### ✅ T4.2 ☐ Vertical option rows, click-to-send, icon Send
- **Kind:** implementation
- **Files:** `src/components/relay/AskUserCard.tsx`, `src/components/relay/AskUserCard.spec.tsx`
- **Do:** Options as `flex flex-col` real `<button>`s, `w-full justify-start hover:bg-accent`, long text wraps. Click calls `onChoose(option)` once and settles the card; further clicks do nothing. Keep the free-text `Input`. Send becomes icon-only rendering a white paper-plane icon (lucide `Send`/`SendHorizontal`, matching the composer) with `text-white` on the primary background, `aria-label` = existing `send` string, disabled when blank (`canSend`). Enter submits with the `isComposing` guard. Focus order: options, input, Send.
- **Acceptance:**
  - Clicking an option calls `onChoose` once with that text, no Send needed; double-click still once (AC5.1).
  - Send has name "Send answer", contains the plane icon svg and no text, disabled when empty and enabled after typing; Enter submits; IME Enter does not (AC5.3).
- **Verify:** `bun run vitest run src/lib/relay/askUserState.spec.ts src/components/relay/AskUserCard.spec.tsx`

### ✅ T4.3 ☐ Unit: ask card logic
- **Kind:** unit
- **Files:** `src/lib/relay/askUserState.ts`, `src/components/relay/AskUserCard.tsx`
- **Do:** AC5.1, AC5.3, settled/skipped/answeredViaComposer rendering, long-text wrapping class.
- **Acceptance:** Both files >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/askUserState.spec.ts src/components/relay/AskUserCard.spec.tsx --coverage --coverage.include=src/lib/relay/askUserState.ts,src/components/relay/AskUserCard.tsx --coverage.reporter=text`

### ✅ T4.4 ☐ E2E: ask card layout and a11y
- **Kind:** e2e
- **Scenarios:**
  - `@critical` options stacked: same left edge and width, strictly increasing tops (AC5.2)
  - `@critical` clicking an option submits immediately
  - `@high` Send is icon-only "Send answer", disabled when empty (AC5.3)
  - `@high` focus order options, input, Send; axe clean (AC5.4)
- **Spec:** `e2e/qa/relay/relay-conversation-polish-ask.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; options are stacked with equal left edge and width; Send is icon-only and disabled when empty; axe reports no violations on the card.
- **Files:** none expected (update `relay-a11y.spec.ts`, `relay-improvements-a11y-axe.spec.ts` and `relay-confirm.spec.ts` if they assert the old "Send" text or select-then-send).
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-ask.spec.ts e2e/qa/relay/relay-a11y.spec.ts e2e/qa/relay/relay-improvements-a11y-axe.spec.ts e2e/qa/relay/relay-confirm.spec.ts --repeat-each=3`

🔶 **Checkpoint 4**: ask card behaves per AC5.x; ask-card screenshot captured.

---

## Phase 5: Dictation, automatic engine and no vendor names (R7)

**Adds:** Dictation picks its engine automatically (no picker), a waveform shows in browser dictation mode too, `speechEngine` is gone from settings and Relay tools, and no "Grok"/"xAI" text appears in the UI.
**Try in UI:** Open Settings, Relay section: no dictation engine dropdown ; Start dictation in a browser without server STT and see the waveform ; Search the UI and locales for "Grok"/"xAI": none ; Ask Relay to change dictation engine: not offered as a preference.

### ✅ T5.1 ☐ Engine resolver and shared analyser helper
- **Kind:** implementation
- **Files:** `src/lib/relay/speechEngine.ts`, `src/lib/relay/stt/audioCapture.ts`, `src/lib/relay/stt/createAnalyserFromStream.ts` (new)
- **Do:** Add `resolveDictationEngine({ sttConfigured, captureSupported, browserSupported }) -> "ai" | "browser" | null` (configured+capture gives ai; else browser if supported; else null; loading `null` status gives browser). Extract `createAnalyserFromStream` and use it in `audioCapture.ts`. Do NOT yet delete the old exports (callers migrate and the deletion happens in T5.5).
- **Acceptance:** Resolver returns the five AC7.1 outcomes (existing `speechEngine.spec.ts` stays green; new cases come in T5.8); `audioCapture.spec.ts` still green on the shared helper; old helpers still exported.
- **Verify:** `bun run vitest run src/lib/relay/speechEngine.spec.ts src/lib/relay/stt/audioCapture.spec.ts`

### ✅ T5.2 ☐ Remove `speechEngine` from store with one-time key migration
- **Kind:** implementation
- **Files:** `src/stores/useRelayStore.ts`, `src/stores/useRelayStore.spec.ts`
- **Do:** Remove `speechEngine` state, `setSpeechEngine` and `SPEECH_ENGINE_KEY` read/write. On store init, remove `rq_relay_speech_engine` once via `removePreference` in try/catch that logs with context; never re-write it.
- **Acceptance:** With `"grok"` seeded, the store loads without error and the key is gone afterwards (AC7.5). Consumers that referenced the removed fields are temporarily adjusted only if needed to compile and are finalised in T5.5 (MicButton, RelaySection).
- **Verify:** `bun run vitest run src/stores/useRelayStore.spec.ts`

### ✅ T5.3 ☐ Remove `speechEngine` from the preferences tool and change log
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/schemas.ts` (~773), `src/lib/relay/tools/settingsWrite.ts` (~180), `src/lib/relay/tools/appSettings.ts` (~41), `src/lib/relay/changeLog.ts` (~428-434), `src/lib/relay/tools/registryGuarantees.spec.ts`
- **Do:** Remove `speechEngine` from the `set_relay_preferences` schema, the `GROK_NOT_CONFIGURED` branch, the app-settings read and the change-log snapshot/undo; drop any engine mention from the tool description. Old change-log entries carrying `speechEngine` must be ignored, not crash (verify). Update `settingsWrite.spec.ts`, `changeLog.spec.ts`, `changeLog.zustand.spec.ts` as they break.
- **Acceptance:** `set_relay_preferences` rejects `speechEngine` (AC7.8); settingsWrite, registryGuarantees and changeLog specs green.
- **Verify:** `bun run vitest run src/lib/relay/tools/settingsWrite.spec.ts src/lib/relay/tools/registryGuarantees.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/changeLog.spec.ts src/lib/relay/changeLog.zustand.spec.ts`

### ✅ T5.4 ☐ `useMicLevel` hook
- **Kind:** implementation
- **Files:** `src/hooks/useMicLevel.ts` (new), `src/lib/relay/stt/createAnalyserFromStream.ts`
- **Do:** While `active` (listening, browser mode only), open `getUserMedia({audio:true})` plus `AudioContext`/`AnalyserNode` via the shared helper; return the analyser. Release (stop tracks, `context.close()`) on stop, unmount, error and permission denial. A denied stream degrades to no meter without breaking dictation; log with context, never swallow.
- **Acceptance:** Hook returns an analyser while active; every exit path releases tracks and context; denial returns null and does not throw.
- **Verify:** `bun run vitest run src/hooks/useMicLevel.spec.ts`

### ✅ T5.5 ☐ `MicButton` auto engine, waveform in both modes, picker removal
- **Kind:** implementation
- **Files:** `src/components/relay/MicButton.tsx`, `src/components/relay/LevelMeter.tsx`, `src/components/settings/RelaySection.tsx`, `src/lib/relay/speechEngine.ts`, `src/hooks/useSttConfigured.ts` (only if the signature changes)
- **Do:** `MicButton` always calls `useSttConfigured(true)`, resolves with `resolveDictationEngine` (browser while status is loading; switch to AI only when not listening), hides the mic when null, shows a generic AI error with no vendor name and no pointer to Settings, and renders `LevelMeter` while listening in either engine (browser meter via `useMicLevel`, never a duplicate stream in AI mode). Remove the engine `Select` from `RelaySection.tsx` (keep an optional privacy line). Delete `SPEECH_ENGINE_OPTIONS`, `isSpeechEngine`, `getEffectiveSpeechEngine` and their spec cases. Update `MicButton.spec.tsx`, `MicButton.grok.spec.tsx`, `RelaySection.spec.tsx`, `useGrokDictation.spec.ts`, `useSpeechDictation.spec.ts` as they break.
- **Acceptance:**
  - Browser mode shows `relay-mic-meter` while listening with a second `getUserMedia` call; tracks stopped and context closed on stop, unmount and rejection; AI mode uses one stream (AC7.6).
  - No `relay-mic` when neither engine is available (AC7.7); no engine combobox in settings (AC7.2).
  - Browser engine while status loads, no engine switch mid-listen, generic AI error text (AC7.9).
  - `grep -rn "SPEECH_ENGINE_OPTIONS\|isSpeechEngine\|getEffectiveSpeechEngine" src` is empty.
- **Verify:** `bun run vitest run src/components/relay/MicButton.spec.tsx src/components/relay/MicButton.grok.spec.tsx src/components/settings/RelaySection.spec.tsx src/hooks/useGrokDictation.spec.ts src/hooks/useSpeechDictation.spec.ts`

### ✅ T5.6 ☐ Settings locale cleanup
- **Kind:** implementation
- **Files:** `messages/en/settings.json`, `messages/fr/settings.json`, `messages/ja/settings.json`, `src/components/settings/RelaySection.tsx`
- **Do:** Delete the `speechEngine.*` group in all three `settings.json` files. If `RelaySection.tsx` keeps a privacy line, point it at a neutral key ("Dictation can send audio to a server for AI transcription.", natural fr/ja equivalents). Confirm by grep that no `t(...)` call still references a deleted key.
- **Acceptance:** No `speechEngine` key in any `settings.json`; no orphaned `t(...)` key in `RelaySection.tsx`; parity holds (AC7.4).
- **Verify:** `bun run vitest run src/i18n src/components/settings/RelaySection.spec.tsx`; `grep -rniE "grok|xai" messages/*/settings.json` is empty.

### ✅ T5.7 ☐ Relay dock locale rewrites and caller renames
- **Kind:** implementation
- **Files:** `messages/en/relayDock.json`, `messages/fr/relayDock.json`, `messages/ja/relayDock.json`, `src/components/relay/MicButton.tsx`, `src/components/relay/SpeechPrivacyNote.tsx`
- **Do:** In all three `relayDock.json` files rename `voice.engine.grok` to `voice.engine.ai` ("AI"), `grokPrivacyNote` to `aiPrivacyNote` ("With AI dictation, audio is sent to a server for transcription."), `grokErrors` to `aiErrors` with `upstreamAuth` = "AI transcription isn't available right now. Try again, or type your message." (no Settings pointer). Update the `t(...)` callers in `MicButton.tsx` and `SpeechPrivacyNote.tsx`. Translate naturally per locale; no vendor names.
- **Acceptance:** `grep -rniE "grok|xai" messages/` returns nothing; rendered `.tsx` strings contain no vendor names (identifiers may) (AC7.3); parity holds (AC7.4).
- **Verify:** `bun run vitest run src/i18n src/components/relay/SpeechPrivacyNote.spec.tsx src/components/relay/MicButton.spec.tsx`; `grep -rniE "grok|xai" messages/` is empty.

### ✅ T5.8 ☐ Unit: dictation engine and mic hooks
- **Kind:** unit
- **Files:** `src/lib/relay/speechEngine.ts`, `src/lib/relay/stt/createAnalyserFromStream.ts`, `src/lib/relay/stt/audioCapture.ts`, `src/hooks/useMicLevel.ts`, `src/stores/useRelayStore.ts`
- **Do:** AC7.1 (five resolver cases), analyser helper, `useMicLevel` release paths, store migration (AC7.5).
- **Acceptance:** Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/speechEngine.spec.ts src/lib/relay/stt/createAnalyserFromStream.spec.ts src/lib/relay/stt/audioCapture.spec.ts src/hooks/useMicLevel.spec.ts src/stores/useRelayStore.spec.ts --coverage --coverage.include=src/lib/relay/speechEngine.ts,src/lib/relay/stt/createAnalyserFromStream.ts,src/lib/relay/stt/audioCapture.ts,src/hooks/useMicLevel.ts,src/stores/useRelayStore.ts --coverage.reporter=text`

### ✅ T5.9 ☐ Unit: mic UI, settings and tool removal
- **Kind:** unit
- **Files:** `src/components/relay/MicButton.tsx`, `src/components/settings/RelaySection.tsx`, `src/lib/relay/tools/settingsWrite.ts`, `src/lib/relay/changeLog.ts`
- **Do:** AC7.2, AC7.6, AC7.7, AC7.8 (including an old `speechEngine` change-log entry ignored on undo), AC7.9; plus a locale-scan test (extend `src/lib/relay/brandGuard.spec.ts` or add a sibling) asserting `messages/**` contain no `grok|xai` (AC7.3).
- **Acceptance:** Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/components/relay/MicButton.spec.tsx src/components/settings/RelaySection.spec.tsx src/lib/relay/tools/settingsWrite.spec.ts src/lib/relay/changeLog.spec.ts src/lib/relay/brandGuard.spec.ts src/components/relay/MicButton.grok.spec.tsx src/lib/relay/changeLog.zustand.spec.ts src/lib/relay/changeLog.settings.spec.ts src/lib/relay/localeVendorNames.spec.ts --coverage --coverage.include=src/components/relay/MicButton.tsx --coverage.include=src/components/settings/RelaySection.tsx --coverage.include=src/lib/relay/tools/settingsWrite.ts --coverage.include=src/lib/relay/changeLog.ts --coverage.reporter=text`

### ✅ T5.10 ☐ E2E: dictation without picker or vendor names
- **Kind:** e2e
- **Scenarios:**
  - `@critical` browser-mode dictation (stubbed `speechStub.ts`, STT unconfigured) shows `relay-mic-meter` while listening (AC7.6)
  - `@critical` Settings Relay section has no dictation engine control (AC7.2)
  - `@high` no "Grok"/"xAI" text on the dock, settings and mic error states
  - `@high` mic hidden when no engine works (AC7.7)
  - `@medium` stale `rq_relay_speech_engine="grok"` in localStorage is cleared on load and the mic still works (AC7.5)
- **Spec:** `e2e/qa/relay/relay-conversation-polish-voice.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the meter appears in browser mode; no engine picker and no Grok/xAI text render; a stale localStorage key is cleared.
- **Files:** `e2e/fixtures/speechStub.ts` if a `getUserMedia` stub is needed (also update `relay-v2-stt.spec.ts`, `relay-improvements-voice.spec.ts`, `relay-improvements-a11y-mic.spec.ts` for no picker and no vendor strings).
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-voice.spec.ts e2e/qa/relay/relay-v2-stt.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-a11y-mic.spec.ts --repeat-each=3`

🔶 **Checkpoint 5**: no picker, waveform in both modes, `speechEngine` gone from store/tool/change log, grep shows no Grok/xAI; browser-mode waveform screenshot captured.

---

## Phase 6: Final gate and walkthrough

**Adds:** Nothing new for users; confirms all seven polish fixes work together and the codebase typechecks and lints clean.
**Try in UI:** Run the combined QA specs below ; Ask Relay for a sample chain, open it, and trigger an ask-user prompt ; Run `bun run tsc --noEmit` and `bun run lint` and expect no errors.

### ✅ T6.1 ☐ Gate: typecheck, lint, targeted suites
- **Kind:** gate
- **Files:** none
- **Do:** Run the single final `bun run tsc --noEmit` and `bun run lint`; run vitest over every touched spec; run the targeted e2e list only (no full suite).
- **Acceptance:**
  - `bun run tsc --noEmit` clean; `bun run lint` clean.
  - Every touched vitest spec green.
  - Every `relay-conversation-polish-*` spec plus the updated existing specs green with `--repeat-each=2`.
  - `grep -rniE "grok|xai" messages/` empty.
- **Verify:** `bun run tsc --noEmit`; `bun run lint`; `bun run vitest run src/lib/relay src/components/relay src/components/settings/RelaySection.spec.tsx src/hooks src/stores src/i18n`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-chain.spec.ts e2e/qa/relay/relay-conversation-polish-open.spec.ts e2e/qa/relay/relay-conversation-polish-cards.spec.ts e2e/qa/relay/relay-conversation-polish-ask.spec.ts e2e/qa/relay/relay-conversation-polish-voice.spec.ts --repeat-each=2`

### ✅ T6.2 ☐ Walkthrough: Objective flows end to end
- **Kind:** walkthrough
- **Files:** `e2e/qa/relay/relay-conversation-polish.spec.ts` (new), `agent_docs/qa/relay-conversation-polish/01-grouped-card.png`, `agent_docs/qa/relay-conversation-polish/02-compact-card.png`, `agent_docs/qa/relay-conversation-polish/03-undone-no-open.png`, `agent_docs/qa/relay-conversation-polish/04-ask-card.png`, `agent_docs/qa/relay-conversation-polish/05-no-vendor-names.png`, `agent_docs/qa/relay-conversation-polish/06-browser-waveform.png` (new proof shots)
- **Do:** Write the combined Objective spec, one `test()` per flow: sample chain creates no collection and shows one grouped card; "create a chain and open it" ends at `/chain/<id>`; no dead Open anywhere; ask card stacked; no Grok/xAI text; browser-mode waveform. Capture Agent Browser screenshots of the compact card, grouped card, ask card and browser-mode waveform (seeded with `--init-script e2e/fixtures/qa-seed.init.js`, `AGENT_BROWSER_SESSION=requestly`, end with `agent-browser close`).
- **Acceptance:** All six automatable Objective flows pass (the seventh, off-topic decline, is the manual AC6.2 check in T6.3); screenshots captured and reviewed; existing collection chains still work (read, update, open, undo).
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish.spec.ts --repeat-each=2`; plus T6.1 suite commands as evidence.

### ✅ T6.3 ☐ DoD: manual live-model checks and summary
- **Kind:** dod
- **Files:** none
- **Do:** Run the manual, non-CI live-model checks and report results: AC1.6 ("create a sample chain with 3-4 nodes" makes no `create_collection` call; inspect the tool-call log) and AC6.2 (chemistry equation, 17*23 and Rome essay are declined with zero tool calls; "what does a 429 mean", OAuth 2 setup and a request test script are answered). Produce the "Implementation Summary" with Verification Steps in the format required by CLAUDE.md.
- **Acceptance:** All AC items in SPEC.md pass; manual checks noted with outcome; summary produced.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish.spec.ts --repeat-each=2` green; T6.1 commands green.

🔶 **Checkpoint 6**: all AC items pass, typecheck and lint clean, targeted suites green, no user-visible Grok/xAI.
