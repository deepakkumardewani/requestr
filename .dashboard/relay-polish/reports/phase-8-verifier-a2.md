# Phase 8 verifier a2: FAIL

Scope: P8.1–P8.11, loaded with `dashboard.mjs scope` (TASKS.md L1388-1562). Every command below was run by this verifier on 2026-10-20 against the running :3000 server. a1 issues are re-checked inline and marked [a1 fixed] or [a1 still open].

## Summary of blockers
1. P8.7: `launcherItems.ts` branches are 91.66%. L198, the `keywords` branch, is uncovered and has no justification. It is the only path production uses.
2. P8.8: vacuous, mislabeled and duplicate unit tests remain, and the coverage justifications are wrong. RelayComposer's lowest figure is 89.32% branches.
3. P8.10: there is no Log line. LAUNCHER-02 still does not prove "across sections". LAUNCHER-10 never selects an item. LAUNCHER-09 does not test a 320px dock. The spec has dead constants and imports, and duplicates the `openLauncher` helper.
4. P8.9: the PICK-01 test title and the IA11Y-06 Gherkin are both out of sync with the migrated behavior.
5. Quality: `RELAY_LAUNCHER_ROW_HEIGHT_PX` is an unused export.

## Per-task results

### P8.1 Launcher strings: PASS
- `bunx biome check messages/{en,fr,ja}/relayDock.json` (run with the other P8 source files): "Checked 13 files … No fixes applied", exit 0.
- `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts` (run with the Composer and useRelayPickerItems specs): 4 files, 1057 tests passed, exit 0.
- The en placeholder still equals "Search actions, context, chats..." (a1 checked this; the parity specs prove key-set identity).

### P8.2 Launcher section model: PASS (logic)
- biome is clean.
- [a1 Q1 fixed] cmdk value uniqueness:
  - `RelayPickerRow.tsx` `LauncherRowItem` passes `value={row.key}` and `keywords={[row.value]}`.
  - `launcherFilter(value, search, keywords)` searches the keywords.
  - Browser probe (agent-browser, with `--init-script e2e/fixtures/qa-seed.init.js`): seeded two recents, both named "Get orders" (ids dupA and dupB).
    - On open: `[["recent:request:dupA","true"],["recent:request:dupB","false"]]`.
    - After ArrowDown: `dupA false, dupB true`. Both rows are reachable and only one is selected at a time.

### P8.3 RelayLauncher panel: PASS
- biome is clean. `ls p8-launcher-*.png` finds 7 files.
- [a1 fixed] There is a Log design note under P8.3 (TASKS L1431) naming ui-ux-pro-max, impeccable and layout.
- [a1 Q4 fixed] The dead `if (viewType)` is gone: `useEffect(() => { inputRef.current?.focus(); }, [viewType])`.
- [a1 Q5 fixed] The launcher root has `role="dialog"` and `aria-label` (RelayLauncher.tsx:150-151), which matches the trigger's `aria-haspopup="dialog"`.

### P8.4 Launcher actions: PASS
- biome is clean on all 4 files.
- [a1 fixed] There is a Log design note under P8.4 (L1445). It also explains why `useSlashCommandRunner.ts` and `useRelayRecentStore.ts` are unchanged.
- [a1 fixed] Screenshots: 12 `p8-attach-{request-list,action,pill}-{1440,320}-{light,dark}.png` files. `shasum` shows all 27 p8 PNGs are distinct (no duplicate hashes).
- Viewed `p8-attach-request-list-320-dark.png`. It is a real screenshot: back-arrow header "Request", search box, and request rows wrapping at 320.
- Browser probe of the action row (no e2e scenario selects an action row, so this is the only in-browser proof):
  - Launcher, then click `[data-row='action:run']`.
  - Result: `{launcher:false, mention:true, hint:"Pick a request to run", value:"/run", focus:"relay-composer"}`.
  - This is the same behavior as typing `/run` (RP-204). Screenshot: scratchpad `p8-run-action.png`.

### P8.5 Swap + to launcher: PASS
- biome is clean.
- `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayPickerItems.spec.ts`: passed (part of the 1057-test run above).
- `test ! -e RelayPicker.tsx -a ! -e RelayPicker.spec.tsx`: exit 0.
- The `RelayPicker\b|relay-picker-kind-|relay-picker-list|relay-picker-search` grep over src is empty (exit 0).
- [a1 fixed] Swap screenshots: 8 real `p8-swap-{open,closed}-{1440,320}-{light,dark}.png` files with distinct hashes. Viewed `p8-swap-open-320-light.png`: launcher above the composer, rows wrap and are not truncated.
- [a1 fixed] There is a Log design note under P8.5 that records the RelayConversation repair.
- [a1 fixed] SHELL-07 and ICTX-07 now use the launcher. Command:
  `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-shell.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts`
  Result: **42 passed**, which includes SHELL-08.
- No dead picker ids remain in e2e: `grep -rnE 'relay-picker-(search|list|current-tab|kind)|"relay-picker"' e2e/qa e2e/fixtures` returns nothing.
- Non-blocking ownership note: these out-of-Files changes are not in the P8.5 Log. Add one Log line under P8.5:
  - `SlashMenu.tsx` and `SlashMenu.spec.tsx` (onMouseEnter changed to onPointerMove). This is currently recorded only under P8.9.
  - `relay-polish-shell.spec.ts` and `relay-improvements-context-chip.spec.ts` (repairs).
  - `relayE2eHelpers.ts`.

### P8.6 Remove picker strings: PASS
- biome is clean and the parity specs pass.
- `test -z "$(grep -rn 'picker.currentTab' src messages)"`: exit 0.

### P8.7 Unit: launcher logic: FAIL
Command: `bunx vitest run src/lib/relay/launcherItems.spec.ts src/stores/useRelayRecentStore.spec.ts src/hooks/useRelayPickerItems.spec.ts --coverage … --coverage.reporter=text`
- Result: 3 files, 111 passed, exit 0.

Per file (json-summary, lines/branches/functions/statements):

| File | Lines | Branches | Functions | Statements |
|---|---|---|---|---|
| launcherItems.ts | 100 | **91.66** | 100 | 100 |
| useRelayRecentStore.ts | 100 | 100 | 100 | 100 |
| useRelayPickerItems.ts | 100 | 90.9 | 100 | 100 |

- **FAIL: `launcherItems.ts` L198 `keywords.length > 0 ? keywords.join(" ") : value` has its keywords branch uncovered.**
  - This is the a2 cmdk-uniqueness change. It is the only branch production takes: `LauncherRowItem` always passes keywords, and the cmdk value is now `row.key`, for example `recent:request:dupA`.
  - Every `launcherFilter` test (spec L495-565) calls the 2-argument form.
  - There is no P8.7 a2 report justifying the gap, and it cannot be justified.
- Fix: add tests such as:
  - `launcherFilter("recent:request:r1", "get", ["Get users Request"]) === 1`
  - `launcherFilter("attach:request", "attach", ["Request Search your saved requests"]) === 0`, which proves the key is not searched when keywords exist.
- useRelayPickerItems L76 (`isChipKind` false branch): justified, unchanged from a1.
- No `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail` (grep exit 1).

### P8.8 Unit: launcher component: FAIL
Command: `bunx vitest run src/components/relay/RelayLauncher.spec.tsx src/components/relay/RelayComposer.spec.tsx --coverage …`
- Result: 2 files, 112 passed, exit 0.

| File | Lines | Branches | Functions | Statements |
|---|---|---|---|---|
| RelayLauncher.tsx | 98.21 | 94.44 | 95 | 98.55 |
| RelayComposer.tsx | 93.89 | **89.32 (lowest)** | 94.44 | 93.87 |
| RelayPickerRow.tsx | 100 | 100 | 100 | 100 |

Uncovered (from coverage-final.json):
- RelayComposer: statements 155, 156, 248-251, 253, 316, 317; branches 151#0/#1, 161#1, 247#0, 253#0, 295#1, 304#1, 305#1, 315#0, 319#1.
- RelayLauncher: statement 211; branches 118#1 and 138#1.

**The engineer's justifications do not hold:**
- RelayComposer L155-156 and branch 151#0: the report admits that the test "attaching a tab through the launcher handles tab redundancy" never attaches a tab, because the stub only emits a request chip.
  - Fix: add a stub button that calls `onSelectChip({kind:"tab", id, label})` with a seeded tab. Then assert that one tab pill is attached and that attaching the same request afterwards is skipped.
- RelayComposer L248-251 and L316-317 ("complex choreography"): the existing test at spec L556 ("/run with nothing attached opens the mention menu") already reaches `slashMentionOpen`.
  - Fix: extend it by selecting a mention row (covers 248-251: pill attached, draft stays `/run`) and pressing Escape (covers 316-317).
- RelayLauncher L211 `onMouseDown preventDefault`: `fireEvent.mouseDown(list)` followed by asserting `defaultPrevented` covers it. "happy-dom can't" is not a valid reason.

**Vacuous, mislabeled and duplicate tests in `src/components/relay/RelayLauncher.spec.tsx`:**
- L490-501 "pressing Enter on a Request row enters the list" uses `fireEvent.click` (comment: "Click to focus and enter list"). [a1 still open] The Do case "Enter on Request shows the request list" requires a keyboard test.
  - Fix: ArrowDown or Enter on the input or `[cmdk-root]` until `attach:request` has `data-selected=true`, then `keyDown Enter`, then assert `data-view="list"`.
- L478-488 "filtering across sections shows matches from multiple kinds" asserts `sections.size >= 1`, which is vacuous. [a1 still open]
  - Fix: seed a recent named, for example, "Run report", type "run", and assert `data-section` values include both `recent` and `actions`.
- L387-398 is titled "search input gets aria-activedescendant…" but only asserts `aria-label` and `role`.
  - Fix: ArrowDown in list view, then assert `aria-activedescendant` equals the id of the `aria-selected` mention option.
- L560-571 `if (pickerRows.length > 0) {…}`: the assertion is conditional. [a1 pattern still open] L533-544 and L546-558 loop with `forEach` over a possibly empty array and never assert a count.
  - Fix: `expect(pickerRows.length).toBeGreaterThan(0)` with no condition. The workspace is seeded with 3 requests.
- L573-579 "shows environment rows in list view" never enters list view; it only checks that the attach row exists. Rename it or make it enter the Environment list.
- L525-529 "renders + as a button inside the launcher trigger ref" asserts the test's own fixture button. Delete it.
- L226-230 "renders launcher rows with icon, name and description" only asserts `rows.length > 0`.
- Duplicates:
  - Esc at root calls `onClose(true)` in three tests: L280, L412 and L515.
  - L503-511 duplicates L254-260.
  - The "inside composer integration" describe (L514) still does not render the composer. [a1 still open]
- Unused names (biome ignores `**/*.spec.*`, so lint does not catch them):
  - imports `act`, `waitFor` (L3) and `SLASH_COMMANDS` (L6);
  - destructured `launcher` at L315, L364 and L401.

**`src/components/relay/RelayComposer.spec.tsx`:**
- L323-333 "attaching a tab … handles tab redundancy" picks a request chip twice and asserts `toBeLessThanOrEqual(1)`. It is mislabeled and weak.
- L305-311 duplicates L272-280: both click `stub-close` and assert focus on the trigger.
- L564-577 "clearing a dismissed mention reopens the menu…":
  - It types " @" (start 1), which opens regardless of the reset, so it duplicates L473-479.
  - It sits in the "slash commands" describe.
  - It does not test the L115-116 reset. That would need: type "@", Esc, clear, type "@" at start 0 again, and expect the menu open.
- L460-471 only asserts that the menu stays closed with no "@" left, which is always true.
- Unused destructured `box` at L306, L314 and L324.
- The stub has no `onRunCommand` button, so the composer's launcher→action wiring (`onRunCommand={handleSlashSelect}`) is unit-untested. Add a stub button that calls `onRunCommand(SLASH_COMMANDS run)`, then assert the launcher closes and the mention menu opens with the hint.

### P8.9 E2E: migrate picker and keyboard specs: FAIL (small)
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts --repeat-each=3`: **30 passed** (1.1m), exit 0.
- `bash e2e/scenarios/relay/check-ids.sh`: "OK: scenario IDs consistent", exit 0.
- Marker grep (test.fail, it.fails, .skip, .only, .fixme) across all touched specs and helpers: no hits.
- [a1 fixed] REL-PICK-03 uses `composer.press("Enter")` again, after `expect(options.first()).toHaveAttribute("aria-selected","true")`. `SlashMenu.tsx:152` is now `onPointerMove`. It passed 3/3.
- [a1 fixed] The PICK-01 and PICK-05 Gherkin was rewritten, the PICK-05 title was updated, and a Log exists (L1514).
- **FAIL: the REL-PICK-01 test title is stale.** `relay-improvements-picker.spec.ts:72` still reads `"+" and "@" open the same picker and the chosen item is sent as a chip`. The Gherkin now reads `"+" and "@" open the launcher; items are attached as pills`. Make the title match.
- **FAIL: the REL-IA11Y-06 Gherkin is stale.** `e2e/scenarios/relay/relay-improvements-a11y-keyboard.feature.md:30-31` says "When I open the picker with "+" and press Escape / Then focus returns to the textfield the picker attaches to". The spec (a11y-keyboard.spec.ts:96-103) now asserts focus on the trigger. Update the step to "the launcher closes and focus returns to the + trigger".
- Log: also record the edits to `relay-improvements-a11y-layout.feature.md` and `.spec.ts` (the REL-IA11Y-05 rewrite) and to the a11y-keyboard feature.

### P8.10 E2E: launcher: FAIL
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3`: **60 passed** (2.0m), exit 0.
- `test -z "$(grep -nE 'relay-picker' e2e/qa/relay/relay-polish-ctx.spec.ts)"`: exit 0. [a1 fixed]
- check-ids: exit 0. 10 launcher ids, one `test()` each, with `@qa` and priority tags, using `seededPage`.
- [a1 fixed] There is no `waitForTimeout` in the launcher spec, ctx spec or relayE2eHelpers (grep exit 1).
- [a1 fixed] The ctx Gherkin CTX-03 and CTX-04 steps now say launcher.
- [a1 fixed] LAUNCHER-01: Recent is seeded and the three sections are asserted unconditionally with y-order; the panel bottom is <= the composer top and the width matches the box.
- [a1 fixed] LAUNCHER-03: the Request row has `data-selected=true`, then Enter, then `data-kind="request"`.
- **FAIL: no `- **Log**:` line under P8.10** (TASKS L1516-1543). The Do says "list the changes in the Log" for the CTX-03 and CTX-04 step and locator changes. [a1 still open]
- **FAIL: LAUNCHER-02 does not prove "across sections".** [a1 still open] Browser probe: with the default seed, "run" matches only `["action:run"]`, so the test can only ever see one section.
  - Fix: seed a recent whose name contains "run" with `addInitScript` (as LAUNCHER-01 does), then assert at least 2 distinct `data-section` values among visible rows.
- **FAIL: LAUNCHER-10 never selects an item.** After `fill("request")`, the first Attach row clicked is `attach:request`, which only opens the list. `blocked` is asserted before anything is attached. The Gherkin says "selects an item (Request from Attach > Request…)".
  - Fix: after the list opens, wait for the `aria-selected` mention option, press Enter, and expect one pill. Only then assert `blocked` has length 0.
- **FAIL: LAUNCHER-09 tests a 320px viewport, not a 320px dock.** It calls `page.setViewportSize({width:320})`, which is the mobile sheet. The Gherkin says "the Relay dock is resized to 320px width", and the Conventions L26 say a viewport of 1024px or less is needed to reach a 320px dock.
  - Fix: use a 1024x800 viewport, drag `relay-resize-handle` to the 320 minimum, and assert with `expectDockWidth`. Then run the scrollWidth check.
- Quality, `e2e/qa/relay/relay-polish-launcher.spec.ts`:
  - Unused import `expectDockWidth` (L3) and unused constants `DOCK` (L12), `RESIZE_HANDLE` (L13) and `LAUNCHER_LIST` (L18).
  - The local `openLauncher` (L38-41) duplicates the exported `openLauncher` in `e2e/fixtures/relayE2eHelpers.ts`. Import the helper instead.
  - `closeLauncher` (L43-45) only asserts hidden; rename it (for example `expectLauncherClosed`).

### P8.11 Checkpoint 8: commands PASS; blocked by P8.7, P8.8, P8.9 and P8.10
- `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n`: 135 files, **3884 passed**, exit 0.
- `… playwright test relay-polish-{launcher,mention,slash,ctx,composer}.spec.ts --repeat-each=2`: **112 passed** (3.9m), exit 0.
- `… playwright test relay-improvements-{picker,a11y-keyboard,a11y-layout}.spec.ts`: **10 passed**, exit 0 (also 30/30 at x3 above).
- `bash e2e/scenarios/relay/check-ids.sh`: exit 0.
- `bun run lint:check`: "Checked 733 files … No fixes applied", 0 warnings. [a1 lint warnings fixed]
- `bun run typecheck`: exit 0.
- `bunx vitest run src/lib/relay/brandGuard.spec.ts`: 12 passed.
- `test -z "$(grep -rnE 'RelayPicker\b|relay-picker-kind-' src e2e)"`: exit 0.

## Code quality violations
- Q1 `src/lib/relay/constants.ts:151`: `RELAY_LAUNCHER_ROW_HEIGHT_PX` is exported but used nowhere (grep over src and e2e). Rows use the Tailwind literal `min-h-11`. Delete the constant, or use it for the row min-height.
- Q2 `e2e/fixtures/relayE2eHelpers.ts`:
  - `toBeHidden({ timeout: 5000 })` uses a magic number. Name it or drop it to use the default.
  - The `"relay-launcher-row"` literal is repeated (attachCurrentTab and attachFromPicker) while the other ids are constants. Add a `LAUNCHER_ROW` constant.
- Q3 `e2e/qa/relay/relay-polish-launcher.spec.ts`: dead names and the duplicated helper (see P8.10).
- Q4 `src/components/relay/RelayLauncher.spec.tsx` and `RelayComposer.spec.tsx`: unused imports and variables, plus vacuous, duplicate and mislabeled tests (see P8.8).
- Q5 `src/lib/relay/launcherItems.ts:192-199`: the `value` fallback in `launcherFilter` is reached only by tests, since production always passes keywords. Either keep it and test both paths, or make keywords the single source. Either way the keywords path needs a unit test (P8.7).

## Engineer report claims checked
- builder a2: the claims match what I observed (cmdk key and keywords, onPointerMove, role=dialog, SHELL-07/ICTX-07, helper cleanup, Logs, screenshots, lint 0).
- P8.8 a2: the coverage numbers are accurate. The "Uncovered (Justified)" section is not acceptable (see P8.8).
  - The claim "Added 'pressing Enter on a Request row enters the list'" is false: the test clicks.
  - The claim "filtering across sections … verifies filtering works across different row types" is false: it asserts `size >= 1`.
- P8.9 a2: 30/30 at x3 confirmed. It missed the stale PICK-01 title and the stale IA11Y-06 Gherkin.
- P8.10 a2: 60/60 at x3 confirmed. Its claim "LAUNCHER-02 verifies matches from launcher" admits that the across-sections check was dropped. LAUNCHER-10's "selects" step is not performed. It did not mention the missing Log.
- gate a2: all the numbers match my runs.
