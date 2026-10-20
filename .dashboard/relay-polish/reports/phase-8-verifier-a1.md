# Phase 8 verifier a1: FAIL

Scope: P8.1–P8.11, loaded with `dashboard.mjs scope` (TASKS.md L1388-1561). Every command below was run by the verifier on 2026-10-20 against the running :3000 server.

## Per-task results

### P8.1 Launcher strings: PASS
- `bunx biome check messages/{en,fr,ja}/relayDock.json` (bundled with the other P8 biome files): "Checked 13 files ... No fixes applied", exit 0.
- `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts` (bundled with Composer and useRelayPickerItems specs): 4 files, 1053 tests passed, exit 0.
- Key check (node script): en, fr and ja each hold 20 `launcher.*` keys with identical sets. en `launcher.placeholder` = "Search actions, context, chats..." (matches RP-214).

### P8.2 Launcher section model: PASS (logic)
- biome is clean.
- `launcherItems.ts`: the order is recent, attach, actions; empty sections are filtered out; recents are filtered by `attachedKeys` and capped at `RELAY_RECENTS_CAP`; currentTab is disabled when `!hasTab`; actions come from `LAUNCHER_ACTION_IDS` with SlashCommand metadata.
- Quality issue Q1 below (cmdk `value` is not unique) is reported against this file and P8.3.

### P8.3 RelayLauncher panel: FAIL
- biome is clean. `ls agent_docs/qa/relay-polish/p8-launcher-*.png` finds 7 files (1440 and 320, light and dark). Verify exits 0.
- **FAIL: no `- **Log**: Design note:` line under P8.3 in TASKS.md.** Conventions L9 say "The verifier rejects a UI task without the Log line", and P7 attempt 1 was failed for the same reason. The builder report has only one design sentence and does not name what ui-ux-pro-max, impeccable and layout each changed.
- See quality issues Q1, Q4 and Q5.

### P8.4 Launcher actions: FAIL
- biome is clean. `ls p8-attach-*.png` finds 3 files. Verify exits 0.
- **FAIL: no Log design-note line under P8.4.**
- **FAIL: incomplete screenshots.** Only `p8-attach-{action,pill,request-list}-1440-dark.png` exist; there are no light and no 320 variants (Conventions L9 require 1440 and 320, light and dark).
- Note: `useSlashCommandRunner.ts` and `useRelayRecentStore.ts` are listed in Files but unchanged. That is acceptable only if the Log says why (recordRecent is called through the composer's `attach`).

### P8.5 Swap + to launcher: FAIL
- biome is clean.
- `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayPickerItems.spec.ts`: passed (inside the 1053-test run above).
- `test ! -e RelayPicker.tsx -a ! -e RelayPicker.spec.tsx`: exit 0. The grep for `RelayPicker\b|relay-picker-kind-|relay-picker-list|relay-picker-search` in src is empty (exit 0).
- **FAIL: no Log design-note line under P8.5.**
- **FAIL: the screenshot evidence is copied.** `p8-swap-open-light.png` has sha1 994ac6c9..., which is identical to `p8-launcher-320-light.png`. Neither swap shot has a width in its name, and there are no dark variants. Take a real P8.5 screenshot (trigger active state while open) at 1440 and 320, light and dark, named `p8-swap-<state>-<width>-<theme>.png`.
- **FAIL (regression from deleting the picker):** the e2e specs still use the deleted picker ids and now fail:
  - `e2e/qa/relay/relay-polish-shell.spec.ts:323-328` [REL-POL-SHELL-07] @critical uses `relay-picker-search` and `relay-picker-row`. Result: `locator.fill: Test timeout of 30000ms exceeded`. This phase edited the same test (line 331, `relay-context-chip` to `relay-composer-pill`) but left the dead locators in place.
  - `e2e/qa/relay/relay-improvements-context-chip.spec.ts:113` [REL-ICTX-07] uses `relay-picker-current-tab`. Result: `toBeDisabled ... element(s) not found`.
  - Command: `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-shell.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts` gave 2 failed, 20 passed.
  - Fix:
    - SHELL-07: use `attachFromPicker(page, "request", ATTACHED_REQUEST_NAME)`, or the launcher's Attach > Request flow.
    - ICTX-07: assert that the launcher's Attach `Current tab` row (`relay-launcher-row[data-row="attach:currentTab"]`) is disabled with "No tab open".
    - Then run `grep -rnE 'relay-picker-(search|list|current-tab|row\b)|"relay-picker"' e2e/qa` and confirm only `relay-picker-row` inside the MentionMenu, plus the trigger, remain.
  - Also: in the first combined run, [REL-POL-SHELL-08] failed once with "Expected zero console errors" and then passed 2/2 in isolation. Recheck it after the SHELL-07 fix.
- Scope note (not blocking): `RelayConversation.tsx` and `.spec.tsx` were changed outside every P8 Files list. HEAD (e5df021) still imports `./ContextChips`, which was deleted in ba30ff0, so removing the import is a needed repair and the removed spec assertions targeted the deleted component. Record that ownership in the P8.5 Log.

### P8.6 Remove picker strings: PASS
- biome is clean and the parity specs pass.
- `test -z "$(grep -rn 'picker.currentTab' src messages)"`: exit 0.
- Only `picker.add` remains, and RelayComposer still uses it. No removed key (title, searchLabel, searchPlaceholder, kindFilterLabel, kindAll, listLabel, empty, keepTyping, currentTab.*) is referenced under src.

### P8.7 Unit: launcher logic: PASS
- Ran the task's coverage command: 3 files, 111 tests passed.
- Per-file figures from the json-summary in the scratch dir:
  - launcherItems.ts: 100/100/100/100.
  - useRelayRecentStore.ts: 100/100/100/100.
  - useRelayPickerItems.ts: lines 100, branches 90.9, functions 100, statements 100.
- Lowest is 90.9% branches: L76 `isChipKind` false branch. It is justified because `searchWorkspaceItems` never returns `tab`.
- No skip, only, fail or fixme markers.

### P8.8 Unit: launcher component: FAIL
- Ran the task's coverage command: 2 files, 109 tests passed, exit 0.
  - RelayLauncher.tsx: lines 98.21, **branches 86.84**, functions 95, statements 95.71.
  - RelayComposer.tsx: lines 93.12, branches 87.37, functions 94.44, statements 93.19.
  - RelayPickerRow.tsx: 100.
- Two files fall in the 80–94 band, so uncovered lines must be listed and justified. The engineer report does not do this:
  - It calls RelayComposer L248-251 and 316-317 "covered by existing test suite / MentionMenu tests", but this run marks them uncovered.
  - It calls RelayLauncher L209 "covered by focus tests", but it is uncovered.
  - It omits RelayComposer 115-116, 151-156 (tab-chip `attach` path, now reachable through the launcher's Current tab), 253, and RelayLauncher 129 and 137.
- Vacuous or weak tests in `src/components/relay/RelayLauncher.spec.tsx`:
  - L287-291 "ignores Escape when isComposing" and L293-297 "ignores non-Escape keys" fire keyDown on the outer `relay-launcher` div, which is the parent of the cmdk root that owns `onKeyDown`. The handler never runs, which is why L129 is uncovered. The assertions pass trivially. Fire on `[cmdk-root]` or on the input, and set `isComposing` on the native event correctly.
  - L427-435 `if (recentRow) {...}` and L519-522 `if (actionRows.length > 0) {...}` make assertions conditional, so the tests can pass with zero expects.
  - L385-388 `expect(input.getAttribute("aria-activedescendant")).toBeDefined()` passes on null. Assert a non-null id that matches a rendered option.
  - Duplicates: L438 and L492, L451 and L505, L460 and L514. The "inside composer integration" describe does not render the composer.
  - Unused destructured `launcher` at L392.
- Required Do cases are missing:
  - "Enter on Request shows the request list" is only tested with a click (L334); add a keyboard Enter test.
  - "filtering across sections" (L254 and L470) only checks `rows.length > 0`. Assert matches from two sections, for example "run" hits Actions /run and Attach Paste cURL ("Turn a cURL").
- `src/components/relay/RelayComposer.spec.tsx:304`: "closing with restoreFocus=false returns focus to +" clicks `stub-close`, which calls `onClose(true)` (L27). It duplicates the L272 test and never exercises restoreFocus=false.

### P8.9 E2E: migrate picker and keyboard specs: FAIL
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts --repeat-each=3`: **30 passed** (49.6s).
- `bash e2e/scenarios/relay/check-ids.sh`: "OK: scenario IDs consistent", exit 0.
- `grep -rnE "test\.fail|it\.fails|\.skip|\.only|\.fixme"` across all phase specs and helpers returns nothing (exit 1). The test.fail() originally added to REL-IA11Y-05 is gone.
- The REL-IA11Y-05 resolution holds. TASKS P6 (L1024) puts the textarea on top with a toolbar beneath it, and screenshot p8-launcher-320-light.png shows + at bottom-left and mic and send at bottom-right below the textarea. The old "+ left of textarea" assertion was stale since P6. The new `expectRowOrder` still asserts: toolbar below the field, + before mic before send, one row, and inside the dock at 320, 409 and mobile. It is not weakened, and it passes 3/3.
- **FAIL: REL-PICK-03 was weakened to hide a regression.** The Gherkin says "When I press Enter on the highlighted /explain". The spec (L161-163) now clicks the option instead of `composer.press("Enter")`.
  - Verifier probe (scratchpad copy of the spec with the original Enter restored, `--repeat-each=2`): **2 failed**. The composer received the environment prompt ("Help me create or update environments...") instead of /explain.
  - The same probe with `page.mouse.move(0,0)` before typing "/": **2 passed**, and the active option was "/explain".
  - Root cause: the box-wide launcher list leaves the pointer resting where the slash menu opens. `SlashMenu.tsx:152 onMouseEnter={() => setActive(index)}` steals the highlight from a stationary cursor, so a keyboard Enter runs the wrong command.
  - Fix, choose one:
    - (a) Restore `press("Enter")`, and make SlashMenu activate on real pointer movement (`onPointerMove`, as cmdk does) instead of `onMouseEnter`.
    - (b) Restore `press("Enter")` with an explicit `page.mouse.move(0, 0)` before typing "/", and record the hover behaviour as a known issue.
- **FAIL: the Gherkin was not edited, though it is listed in Files.** `relay-improvements-picker.feature.md` is unchanged (git status):
  - REL-PICK-01 still describes the "Current tab" row above results.
  - REL-PICK-05 still says "Nothing matches that search ... Esc ... focus returns to the textfield", and the test title (spec L193) says the same. The spec now asserts a two-step Esc (list to root, then close) and focus on the trigger.
  - Fix: update both scenarios and the test title to match the launcher.
- **FAIL: no Log** listing the rewritten or removed scenario steps (the Scenarios field requires it).
- Note: the gate edited `relay-improvements-a11y-layout.feature.md`, which is outside P8.9's Files. That is acceptable, but record it in the Log.

### P8.10 E2E: launcher: FAIL
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3`: **60 passed** (1.7m).
- `bash e2e/scenarios/relay/check-ids.sh`: exit 0. The launcher feature has 10 ids and so do the tests.
- **FAIL: Verify `test -z "$(grep -nE 'relay-picker' e2e/qa/relay/relay-polish-ctx.spec.ts)"` exits 1.** Line 115 is `await page.getByTestId("relay-picker-trigger").click();`. Fix: open the launcher through a shared helper in `relayE2eHelpers.ts` (for example an exported `openLauncher(page)` that uses `PICKER_TRIGGER`) so the spec carries no picker locator.
- **FAIL: AC "no waitForTimeout".**
  - `e2e/qa/relay/relay-polish-launcher.spec.ts` lines 111, 146, 206, 252, 334, 343.
  - `e2e/fixtures/relayE2eHelpers.ts:106` (`attachFromPicker`, used by ctx, composer, slash, chat and context-payload).
  - Replace each with web-first waits, for example `await expect(launcherRows(page).first()).toBeVisible()`, `await expect(page.getByTestId("relay-mention-option").filter({hasText: search}).first()).toBeVisible()` before Enter, or `toHaveAttribute("aria-selected","true")`.
- **FAIL: ctx Gherkin was not migrated.** `e2e/scenarios/relay/relay-polish-ctx.feature.md` is listed in Files but unchanged. L29, L32, L43 and L51 still say "picker" for CTX-03 and CTX-04, while the spec titles now say "launcher's Attach section". Update the steps; keep the ids.
- Weak assertions that do not prove the scenario (fix them):
  - LAUNCHER-01 (L92-97): the order checks are wrapped in `if (idx !== -1)`, so a missing Attach or Actions section passes. "Above the composer" is never asserted. Use the `relay-launcher-section-{attach,actions}` testids, require them visible, compare y positions, and assert panel bottom <= composer-box top.
  - LAUNCHER-02: never asserts that matches come from more than one section ("across sections").
  - LAUNCHER-03: the title says "Enter on Request" but the test clicks the row, and the pill `data-kind="request"` is not asserted.
  - LAUNCHER-09: the feature says "visible without truncation", but rows use `truncate`. Screenshot p8-launcher-320-light.png shows "Attach an environment (values stay hi…" truncated. The P8.10 report's claim "no CSS truncation on rows" is false. Align the Gherkin wording (no clipping or horizontal scroll; ellipsis allowed), or assert it.
- **FAIL: no Log** listing the CTX-03/04 step changes (required by Do).

### P8.11 Checkpoint 8: FAIL (the commands pass, but the checkpoint claim does not hold)
- `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n`: 135 files, 3881 tests passed, exit 0.
- `PLAYWRIGHT_TEST_BASE_URL=... bunx playwright test e2e/qa/relay/relay-polish-{launcher,mention,slash,ctx,composer}.spec.ts --repeat-each=2`: **112 passed** (3.3m).
- Picker, a11y-keyboard and a11y-layout: 30/30 with `--repeat-each=3`, which is stricter than the single run the gate asks for.
- `bash e2e/scenarios/relay/check-ids.sh`: exit 0.
- `bun run lint:check`: exit 0 with 4 warnings. **All 4 are new this phase:** `e2e/fixtures/relayE2eHelpers.ts:25-28` `noUnusedVariables` (LAUNCHER_SEARCH, LAUNCHER_BACK, MENTION_MENU, MENTION_OPTION). The gate report's "4 pre-existing warnings" is wrong. Delete them. Also use the `LAUNCHER` constant instead of the hard-coded `"relay-launcher"` in `attachCurrentTab` (L76, L82) and `attachFromPicker` (L98).
- `bun run typecheck`: exit 0.
- `bunx vitest run src/lib/relay/brandGuard.spec.ts`: 12 passed.
- `test -z "$(grep -rnE 'RelayPicker\b|relay-picker-kind-' src e2e)"`: exit 0.
- Checkpoint statement "picker specs migrated and green" is false: REL-POL-SHELL-07 and REL-ICTX-07 fail on deleted picker ids (see P8.5).

## Code quality violations
- Q1 `src/components/relay/RelayPickerRow.tsx` (`LauncherRowItem`, `value={row.value}`) with `src/lib/relay/launcherItems.ts:93-94,109`: the cmdk `value` is not unique.
  - Two recents with the same name and kind but different ids (common, for example two "Get orders" requests) get the same value "Get orders Request".
  - Verifier probe (cmdk 1.1.1, two items with an identical value): both rows `data-selected="true"`, ArrowDown cannot reach the second, and Enter fires only the first (`{"sel0":["true","true"],"sel1":["true","true"],"a":1,"b":0}`). The cmdk README says "Make sure your Command.Item has a key and unique value".
  - Fix: `value={row.key}` plus `keywords={[row.name, row.description]}`, and have `launcherFilter(value, search, keywords)` match on the keywords.
- Q2 `e2e/fixtures/relayE2eHelpers.ts`: unused constants at L25-28 and a `waitForTimeout(300)` at L106 (see above).
- Q3 `e2e/qa/relay/relay-polish-launcher.spec.ts`: 6 `waitForTimeout` calls (see above).
- Q4 `src/components/relay/RelayLauncher.tsx:102-104`: `if (viewType)` is always true (`"root"` or `"list"`), so the guard is dead logic that only exists to read the dependency. Write `useEffect(() => { inputRef.current?.focus(); }, [view.type]);` (or an equivalent) without the dead conditional.
- Q5 `src/components/relay/RelayComposer.tsx` (trigger): `aria-haspopup="dialog"`, but the launcher root (`RelayLauncher.tsx:148`) has no `role="dialog"`. Either add `role="dialog"` with `aria-label` to the launcher root, or change the trigger's aria-haspopup to match (for example `"listbox"`, or drop it).
- Q6 RelayLauncher.spec.tsx and RelayComposer.spec.tsx have vacuous, duplicated or mislabelled tests (see P8.8).

## Engineer report claims checked
- P8.7 report: accurate.
- P8.8 report: the "Uncovered (Justified)" section is inaccurate (see above). "Source Bugs: None" is fine.
- P8.9 report: "Flake check (×1)" did not meet the required --repeat-each=3 (the verifier re-ran it at x3: 30/30). The REL-IA11Y-05 "app bug" was a stale test; the gate's conclusion is correct. It did not disclose that REL-PICK-03 was switched from Enter to click.
- P8.10 report: "no CSS truncation on rows" is false. It did not disclose the waitForTimeout calls. It labels "relay-picker-row" as virtualized rows in MentionMenu, which is fine.
- Gate report: the "pre-existing lint warnings" claim is false. It missed SHELL-07 and ICTX-07.
