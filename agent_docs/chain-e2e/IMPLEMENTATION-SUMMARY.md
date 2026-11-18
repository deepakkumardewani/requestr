# Chain E2E Coverage Implementation Summary

Source of truth: `e2e/scenarios/chain/*.feature.md` (285 Gherkin IDs, 285 tests, parity script green).
All commands assume `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` (dev server already running).
Evidence is the seeded QA specs only; agent-browser is not evidence.

## Per-phase results

| Phase | Result |
|---|---|
| 0 Foundation | Gherkin written; testids added to config panels, assertions panel, run filter tabs, node toolbar, context menu, deletable edge, arrow panel; mock endpoints and scoped 599 allowlist; `chainE2eHelpers.ts` and first seeds; vertical slice CHN-S-API-01; CHN-BUG-19 (React Flow warning #015) fixed. |
| 1 Simple per-node | API, Start, Delay, Condition, Display, Evaluate, Validate, Merge, Loop, Collect, Sub-chain specs plus extras, canvas interactions and graph validation banners. Files: `chain-e2e-simple-api-start-delay`, `-simple-logic`, `-simple-flow`, `-canvas`. |
| 2 Run log | States, filter tabs and search, step detail tabs, delete/undo/clear, cancel/re-run/dock, persistence, virtualisation, cap. File: `chain-e2e-runlog`. |
| 3 Medium | M-01..M-35: chaining and failure routing, combos, re-run subsets, cancel, reload persistence. File: `chain-e2e-medium`. |
| 4 Bugs | 25 bug scenarios in `chain-e2e-bugs` (BUG-19 in P0). Fixed with regression: BUG-01 (>= / <=), 02, 03, 04, 05, 07, 08, 09, 10, 11, 13, 14, 15, 16, 17, 18. Documented as intended: BUG-06, BUG-12. No `test.fixme` left. |
| 5 Complex | C-01..C-10 in `chain-e2e-complex`: auth pipeline, fan-out/in, partial loop failure, nested loops/subchain, recovery, gauntlet, undo/redo around a run, wide cancel stress, reload mid-history. |
| 6 Cross-cutting | X-01..X-06 (persistence and undo/redo of every block config, responsive, hardening); parity script (285/285); matrix audit; 4 overlapping tests removed from `chain.spec.ts` (SPEC 12.5). |
| 7 Gate | lint, tsc, seed no-drift, parity, full chain suite and repeat-each runs green (details below). |

## Decisions on ambiguous bugs (SPEC section 12 item 7)

- BUG-02: fix, `canDuplicate: true` for Condition and Delay so the context menu matches Mod+D.
- BUG-06: documented as intended (Loop passes with a warning when iterations fail).
- BUG-07: fix, forward `loopDepth` across the Sub-chain boundary (LOOP_DEPTH_EXCEEDED on the Sub-chain step).
- BUG-08: fix, an extraction miss marks the step failed and the run Failed (CHN-S-API-08, CHN-LOG-05 updated).
- BUG-09: fix, validation banner blocks Run for a Display with more than one inbound edge (CHN-S-DSP-07 rewritten).
- BUG-10: fix, `toast.warning` on a single-node run with injected inbound edges.
- BUG-12: documented as intended (in-flight Merge-any lane ends skipped, run Passed).
- BUG-18: fix, `nodesDraggable={!isRunning}` so arrow keys do not nudge during a run.

## Gate evidence (Phase 7)

- `bun run lint:check` (the project lint script; there is no `lint`): exit 0. `graphify-out` added to biome `files.includes` exclusions (generated artifact); chain files formatted; `useHookAtTopLevel` in `InputTab.tsx` fixed by moving `useTranslations` above the early return.
- `bunx tsc --noEmit`: exit 0.
- Seed drift: md5 of `e2e/fixtures/qa-seed.init.js` identical before and after `bun run qa:seed:build` (`dbb18b37c404ab9e063baecce1ff823a`); `bun test src/lib/qaSeedSchema.spec.ts`: 2 pass.
- No `waitForTimeout` in chain-e2e specs or helpers; no `test.fixme`/`test.skip` in chain-e2e-* files.
- `check-parity.sh`: 285/285, 0 missing/duplicated/unknown; `check-ids.sh`: OK.
- Final re-verification run (after the CHN-S-LOP-15 fix below; Playwright `--reporter=json` per-attempt durations; runtime varies with machine load, so earlier recorded figures of 945.7s/1553.0s differ from these):
  - Full chain suite (chain.spec.ts, chaining-ui-overhaul, parallel-merge, chain-e2e-*): 482 passed, 0 failed, 0 flaky, 0 skipped, 1248s wall (20.8 min).
  - `chain-e2e-*` at `--repeat-each=2` (P7.2 Verify): 568 passed, 0 failed, 0 flaky, 1287s wall (21.4 min).
  - `chain-e2e-*` at `--repeat-each=3`: 852 passed, 0 failed, 0 flaky, 2024s wall (33.7 min).
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`: 2 pass, seed md5 unchanged; `check-parity.sh` exit 0; no `test.fixme`/`test.skip` in chain-e2e-* files.
- Flakes found by the first repeat-each=3 runs and fixed at root cause (spec-side races, no source change):
  - `[CHN-X-01]` (~5-10% under load): `openSettledPanel` checked `getAnimations()` before the sheet's slide-in had started, so `fill("7")` landed in the auto-focused source-path field ("$7"). Fix: also wait for focus to land inside the dialog. 60/60 passes afterwards.
  - `[CHN-S-VAL-08a]` (~35% at repeat 20): `getByRole("alert")` matched a page-level alert before the sheet opened, so Escape fired early and the sheet opened after Run. Fix: scope the alert to the dialog; EVL-10 and VAL-08a also wait for the dialog to close before Run. 80/80 passes afterwards.
- `[CHN-S-LOP-15]` flake (1 of 568 in a repeat-each=2 run; unreproducible in isolation at 40 and 228 repeats and at 10 workers). Root cause: `openNodePanel` / `openNodeDetails` called `hover()` once and then waited for the toolbar. The node toolbar is shown purely by CSS `:hover` (`group-hover/node:flex`), so if React Flow's fit-view/layout shifted the node after the pointer landed, `:hover` went stale (the browser does not recompute it without a mouse move) and the toolbar never appeared. The value assertion (`maxIterations` seed 100, panel default 100) was not at fault. Fix: both helpers in `e2e/fixtures/chainE2eHelpers.ts` now re-issue the hover inside `expect(...).toPass()` until the toolbar button is visible (a state-synchronising hover, not a blind retry). Evidence: CHN-S-LOP-15 30/30, whole simple-flow spec at `--repeat-each=3` 135/135, and the three final runs above all green. The fix covers every CHN-S-LOP-* test that opens a panel through the same helper. If the race recurs, it would be a recheck of the helper, not the Loop panel.
- Runtime and slow tests (from the final JSON reports; per-attempt `duration`; runtime varies by machine load):
  - Default run: over 20s: CHN-X-01 30.4s, CHN-BUG-05a 25.3s. No others.
  - `--repeat-each=2`: CHN-X-01 30.5s and 29.3s; CHN-BUG-05a 25.2s and 25.1s. No others.
  - `--repeat-each=3`: CHN-X-01 33.6s, 31.6s, 29.6s; CHN-BUG-05a 25.4s, 25.4s, 25.3s. No others.
  - Both are flagged as known-slow (CHN-BUG-05a iterates every non-copyable block type; CHN-X-01 edits and reloads six blocks, `test.slow()`), bounded well under the per-test timeout, and stable across all repeats.

## Verification steps (manual, each runnable)

1. Simple per-node behaviour (API, Start, Delay): `bunx playwright test e2e/qa/chain-e2e-simple-api-start-delay.spec.ts`
2. Logic nodes (Condition, Display, Evaluate, Validate): `bunx playwright test e2e/qa/chain-e2e-simple-logic.spec.ts`
3. Flow nodes (Merge, Loop, Collect, Sub-chain): `bunx playwright test e2e/qa/chain-e2e-simple-flow.spec.ts`
4. Canvas interactions and validation banners: `bunx playwright test e2e/qa/chain-e2e-canvas.spec.ts`
5. Run log states, filters, tabs, delete/undo, dock: `bunx playwright test e2e/qa/chain-e2e-runlog.spec.ts`
6. Medium combinations and re-run/cancel: `bunx playwright test e2e/qa/chain-e2e-medium.spec.ts`
7. Bug fixes and documented behaviours: `bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts`
8. Complex flows and cross-cutting: `bunx playwright test e2e/qa/chain-e2e-complex.spec.ts`
9. Single scenario by ID: `bunx playwright test e2e/qa/chain-e2e-*.spec.ts --grep "CHN-BUG-09"`
10. Existing chain suite unaffected: `bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
11. Stability: `bunx playwright test e2e/qa/chain-e2e-*.spec.ts --repeat-each=3`
12. Gherkin/test parity: `bash e2e/scenarios/chain/check-parity.sh`
13. Seed integrity: `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
