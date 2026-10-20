# Phase 8 verifier a4 (re-verify of a3 blockers): PASS

Scope: P8.8, P8.10, P8.11 (P8.1-P8.7 and P8.9 passed in a3; regression spot-checked through the P8.11 commands). Tasks were loaded with `dashboard.mjs scope` (P8.8 L1489-1498, P8.10 L1516-1543, P8.11 L1545-1561). Every command below was run by this verifier on 2026-10-20 against the running :3000 server. The fix report phase-8-fix-a4.md was treated as a claim only.

## a3 blockers re-checked
1. **Zero-assertion tests: FIXED.** RelayLauncher.spec.tsx L526-553 now query `relay-mention-option` and assert `expect(options.length).toBeGreaterThan(0)` unconditionally before the forEach. There are no `relay-picker-row` queries outside the direct `describe("RelayPickerRow")` unit block (L150-195).
2. **aria-activedescendant test: RETITLED, NON-BLOCKING.** L390-405 is now titled "moves the selected mention option with ArrowDown and gives it a DOM id". It asserts that the aria-selected option exists, has a non-empty id and has aria-posinset=2.
   - The fixer's source-bug claim is CONFIRMED in `node_modules/cmdk/dist/index.mjs`. The Input renders `{ref:o,...u, ..., "aria-activedescendant":p, ...}`, so the cmdk value written after the props spread overrides the `inputA11y` spread at `RelayLauncher.tsx:142-145`.
   - The P8.8 Acceptance ("Covers RP-214, RP-215, RP-216 at unit level; unit conventions hold") and RP-214 (keyboard Up/Down/Enter/Esc) do not require aria-activedescendant on the launcher input. So this is non-blocking.
   - Follow-up: `inputA11y` in RelayLauncher.tsx is effectively dead. Fix it in source by setting the attribute after cmdk (ref effect or wrapper), or remove it. The SPEC Accessibility NFR (role/aria for the launcher) makes this worth a ticket.
3. **stub-run-command wiring: FIXED.**
   - The stub at RelayComposer.spec.tsx L36 now calls `props.onRunCommand(runCommand)`, where `runCommand` is the real SLASH_COMMANDS "run" entry (L13).
   - The test at L378-387 opens `+`, clicks the stub and asserts that:
     - the stub launcher is gone;
     - `relay-mention-menu` is visible;
     - `slash.hint.request` is shown;
     - `box.value === "/run"`.
   - So it exercises the composer's real `onRunCommand={handleSlashSelect}`.
4. **Tab-redundancy dedup branch: FIXED.** The new test at L360-376 seeds tab t1 with requestId r1, picks the tab, then picks request r1. It expects 1 pill, attachedItems = [tab only] and 2 recents. coverage-final.json no longer lists 161#1 as uncovered (see the coverage section).
5. **Unused locals: FIXED for the a3-cited ones.** L318 and L409 no longer destructure `launcher`, and `cmdkRoot` is gone. One leftover remains (nit below).
6. **LAUNCHER-09 drag: FIXED.**
   - Spec L298-327: 1024x800 viewport, then `dragDockToWidth(page, NARROW_DOCK_WIDTH_PX)`, `expectDockWidth`, a loop over all rows asserting `scrollWidth <= clientWidth+1`, and a check that the panel has no horizontal scroll.
   - `grep -nE '\bDOCK\b|RESIZE_HANDLE|style\.width|page\.evaluate'` on the launcher spec: no hits (exit 1).
   - `dragDockToWidth` is defined exactly once (`e2e/fixtures/relayE2eHelpers.ts:76`, exported). The launcher, mention, composer and slash specs import it.
   - The TASKS P8.10 Log (L1535) now accurately describes the drag, the shared helper, the per-row overflow check and the panel scroll check.
7. **IA11Y-06 wording: FIXED.**
   - feature.md L27-31: "Esc from the launcher..." / "When I open the launcher with "+"" / "the launcher closes and focus returns to the + trigger".
   - spec L92 title matches.

## P8.8 Unit: launcher component: PASS
Command (Verify, plus `--coverage.reporter=json`): `bunx vitest run src/components/relay/RelayLauncher.spec.tsx src/components/relay/RelayComposer.spec.tsx --coverage --coverage.include=... --coverage.reporter=text`
- Result: Test Files 2 passed, **Tests 109 passed**, exit 0.

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| RelayComposer.tsx | 99.31 | **95.14 (lowest)** | 100 | 100 |
| RelayLauncher.tsx | 100 | 94.44 | 100 | 100 |
| RelayPickerRow.tsx | 100 | 100 | 100 | 100 |

- RelayPickerRow.tsx is omitted from the text table because it is fully covered.
- The proof is the `All files` row: Funcs 100% (61/61), Lines 100% (202/202), Statements 233/234 (the one miss is Composer statement 253). coverage-final.json also lists 0 uncovered branches for it.

- Uncovered branches from coverage-final.json:
  - RelayComposer 253#0, 295#1, 304#1, 305#1, 319#1;
  - RelayLauncher 118#1, 138#1.
- These now match the fix report's justification list exactly, with real numbers. Each is a defensive or unreachable arm, and the reasons hold on reading.
- 161#1 is covered.
- Marker grep `test\.fail|it\.fails|\.skip|\.only|\.fixme` over both specs: no hits (exit 1).

## P8.10 E2E: launcher: PASS
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3`: **60 passed (1.8m)**, exit 0. There are 0 flaky/retry/failed lines.
- `test -z "$(grep -nE 'relay-picker' e2e/qa/relay/relay-polish-ctx.spec.ts)"`: exit 0.
- `bash e2e/scenarios/relay/check-ids.sh`: "OK: scenario IDs consistent" (launcher 10/10, ctx 10/10), exit 0.
- Marker/`waitForTimeout` grep over the launcher, ctx, mention, composer, slash and a11y-keyboard specs and relayE2eHelpers.ts: no hits (exit 1).

## P8.11 Checkpoint 8: PASS (all commands exit 0)
- `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n`: 135 files, **3888 passed** (a3 had 3886, plus the 2 new composer tests), exit 0.
- `... playwright test relay-polish-{launcher,mention,slash,ctx,composer}.spec.ts --repeat-each=2`: **112 passed (3.5m)**, exit 0, with 0 flaky/failed lines.
- `... playwright test relay-improvements-{picker,a11y-keyboard,a11y-layout}.spec.ts`: **10 passed (18.6s)**, exit 0. This also covers the P8.9 regression check.
- `bash e2e/scenarios/relay/check-ids.sh`: OK, exit 0.
- `bun run lint:check`: "Checked 733 files in 137ms. No fixes applied.", exit 0.
- `bun run typecheck`: exit 0.
- `bunx vitest run src/lib/relay/brandGuard.spec.ts`: 12 passed.
- `test -z "$(grep -rnE 'RelayPicker\b|relay-picker-kind-' src e2e)"`: exit 0.
- Regression of P8.1-P8.7 and P8.9: covered by the vitest scope above (the i18n parity, store, hook and launcherItems specs are green), lint, typecheck and the improvements specs. Nothing regressed.

## Additional sweep (dead names in files the fix touched)
A node script parsed the named imports and top-level const/function declarations, then counted word-boundary references, in:
- the mention, composer, slash, launcher and ctx specs;
- relayE2eHelpers.ts;
- RelayLauncher.spec.tsx;
- RelayComposer.spec.tsx.

Results:
- Only one hit: `openTab` in relay-polish-mention.spec.ts:9 is imported but unused.
- `git show HEAD:` shows the same single reference, so it predates this fix. Non-blocking.
- The fixer's removal of the local drag copies left no orphaned constants (the slash spec's local `RESIZE_HANDLE` was removed too).
- The `320` literal at slash spec L258 predates the fix (it does not appear in `git diff`).

## Non-blocking nits (for planning, not retry)
- LAUNCHER-09 Gherkin vs spec: the feature.md L71 Then step says "all row content ... is visible without truncation". The spec instead asserts row-level overflow and comments "Long labels truncate by design".
  - The 09-narrow-320px.png screenshot shows no truncated row at 320px (the Environment description wraps), so behavior currently matches the Gherkin.
  - Either reword the Then step ("no row overflows its panel; no horizontal scrollbar") or strengthen the assertion to the per-span check.
- `src/components/relay/RelayLauncher.spec.tsx:367`: `const { launcher, input } = setup(...)` destructures `launcher`, but that test never uses it. It is a leftover unused local of the kind a3 flagged. Drop `launcher`.
- `src/components/relay/RelayLauncher.tsx:142-145`: `inputA11y` (aria-activedescendant) is overridden by cmdk's Input and is therefore dead. This is a source a11y gap and should get a ticket (see blocker 2).
- `e2e/scenarios/relay/relay-improvements-a11y-keyboard.feature.md` L4, L11, L15 and L17 (REL-IA11Y-01) still say "picker" (carried over from a3).
- `e2e/qa/relay/relay-improvements-a11y-layout.spec.ts:46`, `relay-improvements-layout.spec.ts:111`, `relay-polish-panel.spec.ts:48` and `relay-shell.spec.ts:37` keep their own dock-drag code. This predates Phase 8 (unchanged in the diff); they could adopt the shared `dragDockToWidth` later.
- The a3 nits not re-checked as blockers still stand (the `inside composer integration` describe name, the LAUNCHER_CLOSE_TIMEOUT_MS redundancy, the `attachFromPicker` name, LAUNCHER-10 hermeticity and the P8.5 Log completeness).

## Fix report claims checked
- Confirmed:
  - 109 tests;
  - Composer 95.14 and Launcher 94.44 branch;
  - the 161#1 coverage;
  - the stub-run-command test;
  - the `seedOneRequest` extraction (used at L379, L613 and L631);
  - the drag helper move;
  - the removal of DOCK and RESIZE_HANDLE;
  - the Log correction;
  - the IA11Y-06 wording;
  - lint and typecheck;
  - check-ids.
- Confirmed: the cmdk aria-activedescendant override (from the cmdk dist source).
- Partially true: "unused launcher destructures removed". The two cited ones are gone, but one remains at L367.
