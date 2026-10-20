# Phase 8 verifier a3 (final): FAIL

Scope: P8.1-P8.11. Loaded with `dashboard.mjs scope` (TASKS.md L1388-1563). Every command below was run by this verifier on 2026-10-20 against the running :3000 server. Each a2 issue is re-checked and marked [a2 fixed] or [a2 still open].

## Blockers (summary)
1. P8.8 `src/components/relay/RelayLauncher.spec.tsx` L527-553: two tests can never fail because they make zero assertions. [a2 still open]
2. P8.8 `RelayLauncher.spec.tsx` L390-406: the title promises an `aria-activedescendant` check that the test never makes. [a2 still open; the engineer renamed the test instead of fixing it]
3. P8.8 `RelayComposer.spec.tsx`: the `stub-run-command` stub button is never clicked, so the composer's launcher→action wiring is still unit-untested. [a2 still open]
4. P8.8: the coverage justification names the wrong lines. The "handles tab redundancy" test never takes the skip path it claims to cover.
5. P8.10 LAUNCHER-09: sets the dock width with a DOM style override instead of dragging, and the TASKS P8.10 Log falsely says "drag resize-handle". [a2 partly open]
6. Quality: dead names the a3 reports say were removed are still present (`DOCK` and `RESIZE_HANDLE` in the launcher e2e spec, plus unused locals in RelayLauncher.spec).

## Per-task results

### P8.1 Launcher strings: PASS
- `bunx biome check` on the 3 relayDock.json files and the P8 source files: "Checked 13 files … No fixes applied", exit 0.
- `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`, run together with the Composer and useRelayPickerItems specs: 4 files, 1056 passed, exit 0.
- The en `launcher.placeholder` is "Search actions, context, chats...", which matches the SPEC.

### P8.2 Launcher section model: PASS
- biome is clean.
- [a2 Q1 fixed] `RELAY_LAUNCHER_ROW_HEIGHT_PX` is gone. The new constants are all used:
  - LAUNCHER_ACTION_IDS: 8 refs
  - RELAY_LAUNCHER_LIST_MAX_HEIGHT_PX: 2 refs
  - RELAY_IMPORT_PREFILL: 3 refs
- The section order, disabled Current tab and attached-recent exclusion are all present in `launcherItems.ts`.

### P8.3 RelayLauncher panel: PASS
- biome is clean. `p8-launcher-*.png`: 7 files. The Log design note is present (L1431).

### P8.4 Launcher actions: PASS
- biome is clean. `p8-attach-*.png`: 12 files. The Log is present (L1445).

### P8.5 Swap + to launcher: PASS
- `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayPickerItems.spec.ts`: green (part of the 1056 above).
- `test ! -e RelayPicker.tsx -a ! -e RelayPicker.spec.tsx`: exit 0.
- `grep 'RelayPicker\b|relay-picker-kind-|relay-picker-list|relay-picker-search' src` is empty, exit 0.
- `p8-swap-*.png`: 8 files.

### P8.6 Remove picker strings: PASS
- biome and parity are green.
- `test -z "$(grep -rn 'picker.currentTab' src messages)"`: exit 0.

### P8.7 Unit: launcher logic: PASS
Command: the Verify command, plus a json-summary run.
- Result: 3 files, **118 passed**, exit 0.

| File | Lines | Branches | Functions | Statements |
|---|---|---|---|---|
| launcherItems.ts | 100 | 100 | 100 | 100 |
| useRelayRecentStore.ts | 100 | 100 | 100 | 100 |
| useRelayPickerItems.ts | 100 | **90.9 (lowest)** | 100 | 100 |

- [a2 fixed] The `launcherFilter` keywords branch is now covered. The suite "with keywords (cmdk integration)" includes a test proving the value is not searched when keywords exist (`launcherFilter("attach:request","attach",[...]) === 0`).
- useRelayPickerItems L76 (the `isChipKind` false branch) is justified (unreachable), the same as in a1 and a2.
- Marker grep (`test.fail|it.fails|.skip|.only|.fixme`) over all 5 unit specs: no hits (exit 1).

### P8.8 Unit: launcher component: FAIL
Command: the Verify command, plus a json run.
- Result: 2 files, **107 passed**, exit 0.

| File | Lines | Branches | Functions | Statements |
|---|---|---|---|---|
| RelayLauncher.tsx | 100 | 94.44 | 100 | 100 |
| RelayComposer.tsx | 100 | **94.17 (lowest)** | 100 | 99.31 |
| RelayPickerRow.tsx | 100 | 100 | 100 | 100 |

Uncovered branches, from coverage-final.json:
- RelayComposer: 161#1, 253#0, 295#1, 304#1, 305#1, 319#1. Statement 253.
- RelayLauncher: 118#1, 138#1.

[a2 fixed]:
- Keyboard Enter on the Request row (L491-513) now uses ArrowDown until `data-selected=true`, then Enter.
- The across-sections test now seeds "Run report" and asserts at least 2 sections.
- The duplicate Esc tests are removed.
- The fixture-only "+ button" test is removed.
- The mouseDown preventDefault test is added.
- The composer tab test now uses `stub-pick-tab`.
- `/run` + select covers 248-251, and `/run` + Escape covers 316-317.
- There is a real L115-116 reset test (L474-487).
- The unused `box` destructures are removed.

**Blockers:**
1. **`RelayLauncher.spec.tsx` L527-539 "renders each kind with correct label and detail" and L541-553 "shows aria-posinset and aria-setsize for accessibility" make zero assertions.**
   - Both loop with `forEach` over `screen.queryAllByTestId("relay-picker-row")` after entering the Request list.
   - No production component renders `RelayPickerRow`. Grep shows only `LauncherRowItem` and `CHIP_KIND_ICONS` are imported from `RelayPickerRow.tsx`. List view renders `MentionMenu`, whose rows are `relay-mention-option` (MentionMenu.tsx:302, 341).
   - So the array is always empty, and the tests pass whatever happens.
   - Fix: target `relay-mention-option` and start with an unconditional `expect(options.length).toBeGreaterThan(0)`, or delete both tests. The `describe("RelayPickerRow")` block at L126 already covers RelayPickerRow directly.
2. **L390-406 "search input aria-activedescendant reflects selected mention option" never asserts `aria-activedescendant`.**
   - It only checks `role=combobox` and that options exist.
   - The component sets it in `RelayLauncher.tsx:142-145` (`inputA11y`).
   - Fix: in list view, `fireEvent.keyDown(input, {key:"ArrowDown"})`, then `expect(input).toHaveAttribute("aria-activedescendant", <id of the option with aria-selected="true">)`.
3. **`RelayComposer.spec.tsx`: the stub button `stub-run-command` (L33) is never clicked** (grep count is 1, the definition only).
   - So `onRunCommand={handleSlashSelect}` (launcher→action, a Do case: "actions use the slash runner") is still not tested at composer level, and the stub button is dead.
   - Fix: seed one request, open `+`, click `stub-run-command`, then assert:
     - the stub launcher is gone;
     - `relay-mention-menu` is visible;
     - the `slash.hint.request` hint is shown;
     - the draft is `/run`.
4. **The coverage justification is inaccurate** (P8.8-unit-a3.md, "Remaining Uncovered Branches").
   - It lists "L95". L95 is fully covered; the number is the tail of the text reporter's truncated `...95,304-305,319` column, not a real line.
   - It omits 161#1, 253#0 and 295#1.
   - **161#1 is the `skipAttach === true` path.** The test "attaching a tab through the launcher handles tab redundancy" (L322-339) claims to cover redundancy, but it never reaches that branch. The second pick of the same tab is deduped by the store, not by `isRedundantTabAttach` and `isRedundantRequestAttach`.
   - Fix: seed `useTabsStore` with tab t1 whose `requestId` is "r1". Pick the tab (`stub-pick-tab`), then pick request r1 (`stub-pick`). Assert that only 1 pill exists and that recents recorded both. That covers 161#1.
   - Then list the remaining defensive branches (253#0, 295#1, 304#1, 305#1, 319#1; launcher 118#1, 138#1) by their real numbers, with a one-line reason each.
5. **Unused locals** (biome ignores spec files, so lint does not catch them):
   - `launcher` destructured but unused at RelayLauncher.spec.tsx L318 and L409;
   - `const cmdkRoot` at L498 is unused.

### P8.9 E2E: migrate picker and keyboard specs: PASS
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test relay-improvements-{picker,a11y-keyboard,a11y-layout}.spec.ts --repeat-each=3`: **30 passed** (55.1s), exit 0.
- `bash e2e/scenarios/relay/check-ids.sh`: "OK: scenario IDs consistent", exit 0.
- [a2 fixed] The REL-PICK-01 title (spec L72) now matches the Gherkin: "open the launcher; items are attached as pills".
- [a2 fixed] The REL-IA11Y-06 Then step reads "the launcher closes and focus returns to the + trigger".
- No marker or `waitForTimeout` hits in the touched specs or helpers.
- No dead picker ids in `e2e/qa` or `e2e/fixtures` (grep exit 1).

### P8.10 E2E: launcher: FAIL
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3`: **60 passed** (1.7m), exit 0.
- `test -z "$(grep -nE 'relay-picker' relay-polish-ctx.spec.ts)"`: exit 0. check-ids: exit 0.
- The spec has 10 tests with `@qa` (describe) and 5 @critical plus 5 @high, all using `seededPage`.
- [a2 fixed] The P8.10 Log line exists (L1535).
- [a2 fixed] LAUNCHER-02 seeds "Run report" and asserts at least 2 distinct `data-section` values.
- [a2 fixed] LAUNCHER-10 now selects a request and expects 1 pill before asserting `blocked` is empty.
- [a2 fixed] The local `openLauncher` was replaced by the helper. `closeLauncher` was renamed `expectLauncherClosed`. `LAUNCHER_LIST` was removed.

**Blockers:**
1. **LAUNCHER-09 (spec L302-312) does not resize the dock. It writes `dock.style.width = "320px"` from `page.evaluate`, inside a silent `if (dock)`.**
   - The TASKS P8.10 Log (L1535) says "fixed LAUNCHER-09 to use 1024px viewport, drag resize-handle to 320px". That statement is false.
   - P8.10-e2e-a3.md says the drag is blocked by "Playwright environment constraints (HTML smooth-scroll blocks pointer events during drag)". My own runs contradict this:
     - `relay-polish-mention.spec.ts:38-49` and `relay-polish-composer.spec.ts:43-54` both drag `relay-resize-handle` with `dragDockToWidth` (mouse down, move with steps:16, up, then `expectDockWidth`).
     - Both passed in the gate run below (112/112).
   - The Gherkin says "Given the Relay dock is resized to 320px width".
   - Fix:
     - Move `dragDockToWidth` into `e2e/fixtures/relayE2eHelpers.ts`. A third copy would break DRY.
     - Use it in LAUNCHER-09: 1024x800 viewport, open Relay, drag to 320.
     - Delete the `page.evaluate` override.
     - Correct the Log line if anything else differs.
2. **Quality: `DOCK` (L23) and `RESIZE_HANDLE` (L24) in `e2e/qa/relay/relay-polish-launcher.spec.ts` are declared and never used** (grep -w count is 1 each). P8.10-e2e-a3.md claims "Removed unused local constants: DOCK, RESIZE_HANDLE". `RESIZE_HANDLE` becomes used once the drag is in place; otherwise delete both.
3. Minor, but it should be fixed in the same pass: LAUNCHER-09's no-clipping check covers only `launcherRows(page).first()`, while the Gherkin says "all row content". Loop over all visible rows, or at least the longest-description row.

### P8.11 Checkpoint 8: commands PASS; blocked by P8.8 and P8.10
- `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n`: 135 files, **3886 passed**, exit 0.
- `... playwright test relay-polish-{launcher,mention,slash,ctx,composer}.spec.ts --repeat-each=2`: **112 passed** (3.6m), exit 0.
- `... playwright test relay-improvements-{picker,a11y-keyboard,a11y-layout}.spec.ts`: **10 passed**, exit 0.
- `bash e2e/scenarios/relay/check-ids.sh`: exit 0.
- `bun run lint:check`: "Checked 733 files … No fixes applied", exit 0.
- `bun run typecheck`: exit 0.
- `bunx vitest run src/lib/relay/brandGuard.spec.ts`: 12 passed.
- `test -z "$(grep -rnE 'RelayPicker\b|relay-picker-kind-' src e2e)"`: exit 0.

## Non-blocking nits
- `e2e/scenarios/relay/relay-improvements-a11y-keyboard.feature.md`: the L27 title and the L30 When step still say "picker" ("When I open the picker with "+"").
- `RelayLauncher.spec.tsx`:
  - The `describe("inside composer integration")` name does not match its content (a mouseDown test).
  - L225 "renders launcher rows with icon, name and description" only asserts `data-row` and `data-section`.
  - The `import { Command, CommandList }` block is not formatted the way biome would format it.
- `RelayComposer.spec.tsx`:
  - The `base` request seed is duplicated in the two `/run` tests (L565-580 and L598-613); extract a `seedOneRequest()`.
  - There is a stray blank line at L622.
- P8.8-unit-a3.md claims `act` and `waitFor` were removed from RelayComposer.spec. They are still imported, and correctly so, since L656 and L706 use them. The claim is false but there is no defect.
- `RelayPickerRow` (the component) is now production-dead; only `LauncherRowItem` and `CHIP_KIND_ICONS` are used. The task said to keep it, so this is left to planning.
- `e2e/fixtures/relayE2eHelpers.ts`:
  - `LAUNCHER_CLOSE_TIMEOUT_MS = 5000` equals Playwright's default expect timeout, so the explicit timeout is redundant.
  - The helper name `attachFromPicker` is stale.
- LAUNCHER-10 (like the already-committed MENTION-09 it copies, which the Do mandates) has no `installRelayRoutes`, so the post-Send step hits the real `/api/relay/chat`. This is a hermeticity concern inherited from the mandated pattern, not new to P8.10.
- P8.5 Log: the out-of-Files edits (`SlashMenu.tsx` and its spec, `relay-polish-shell` and `context-chip` specs, `relayE2eHelpers`) are still only partly recorded. This was non-blocking in a2.

## Engineer report claims checked
- builder a3: confirmed (the constant was removed; typecheck and lint are clean).
- P8.7 a3: confirmed (118 passed, keywords covered, 100/100/100/100 on launcherItems).
- P8.8 a3:
  - The test count and coverage numbers are confirmed.
  - False: "Fixed conditional if assertion … added assertion" (the two forEach tests have no assertion).
  - Misleading: "aria-activedescendant … verified the test setup is correct" (there is no such assertion).
  - Wrong line numbers in the justification (L95).
  - False: "Removed unused imports: act, waitFor" (still present and used).
- P8.9 a3: confirmed (30/30 at x3 in my run).
- P8.10 a3:
  - 60/60 is confirmed.
  - False: "Removed unused local constants: DOCK, RESIZE_HANDLE".
  - The LAUNCHER-09 environment-constraint claim is contradicted by sibling specs that drag successfully.
  - The TASKS Log misstates LAUNCHER-09 as a drag.
- gate a3: all numbers match my runs (3886, 112, 10, 733 files, 12).
