# Implementation Plan: Thorough Playwright E2E for the Chain Feature

Inputs: `SPEC.md` (sections 3, 5, 6, 12 are authoritative), `ANALYSIS-feature.md` (AF), `ANALYSIS-coverage.md` (AC). Planning only. Task IDs, Kind/Files/Do/Acceptance/Verify detail go in `TASKS.md` (separate agent). Commands: bun/bunx only, never npm, never start the server (running on :3000), no commits.

## Overview
Add 285 new scenarios (Simple 140, Canvas/validation GR+CV 15, Medium 40, Complex 11, Run-log 47, Bug 26, Cross 6) in 8 new spec files plus shared helpers, seeds, routes and a minimal set of source testids. Existing 202 tests stay, except 4 overlapping tests removed at the end (SPEC 12.5). Bug scenarios drive source fixes: `>=`/`<=` is fixed automatically; BUG-06 is documented as intended (source-verified product decision); the remaining ambiguous items stop and ask the user per item.

Env prefix used in every command below: `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000`.

## Architecture Decisions
- **Gherkin-first**: the 9 files in `e2e/scenarios/chain/*.feature.md` (285 scenarios, one `## Scenario: [ID]` each; `check-ids.sh` keeps them equal to SPEC IDs) are written BEFORE any test and are the source of truth. Flow per scenario: Gherkin -> Playwright test titled `[<ID>] <scenario name>` (Given = arrange via seed/open, When = act, Then = assert canvas AND run log). SPEC rows supply seeds/selectors; on disagreement the Gherkin wins. Bundled SPEC rows were split into sub-IDs (a, b, ...) so each test has one outcome. `check-parity.sh` (Phase 6) proves a 1:1 Gherkin <-> test mapping.
- **Specs by tier, 2 workers**: each file under ~800 lines, `fullyParallel`, independent tests, tagged `@qa`, `seededPage` + `installChainRoutes`.
- **Helpers file, not page-object classes** (matches repo convention): `e2e/fixtures/chainE2eHelpers.ts`, thin functions over `getByTestId`. Canvas AND run-log asserted in every scenario via `expectNode` + `expectStep` + bar/summary helpers.
- **Seeded by default**, UI-authored only where authoring is under test: Start panel, Condition branch editing (S-CND-06), SubChainPicker (S-SUB-04), and API-node assertion config (SPEC 12.1). Authoring tests may use `chain.spec.ts`-style UI setup but still inside `@qa` files.
- **Seed hygiene**: one new file `seed/chain-e2e.json` (ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`); regenerate with `bun run qa:seed:build`; never hand-edit `qa-seed.init.js`; drift guarded by `src/lib/qaSeedSchema.spec.ts`.
- **Hermetic mocks only** (stateless): extend `installChainRoutes` with `/api/users`, `/api/empty-list`, `/api/object`, `/api/text`, `/api/status/404`, `/api/score`, `/api/medium`, `/api/list-mixed`, `/api/list-60`, `/api/abort` (route.abort, REQUEST_FAILED), `/api/item/{1,fail,3}`. Unknown stays 599 (an HTTP_STATUS failure) + console.error.
- **Console guard**: add one scoped allowlist in `qa.ts`: an opt-in fixture option/helper (e.g. `allowExpectedConsoleError(page, /exact 599 mock message/)`) consumed only by CHN-S-API-12. Default guard unchanged; unit-check by confirming another test with an unexpected error still fails.
- **Bug policy** (SPEC 12): clear bug => fix + regression. Ambiguous (loop passed with failed iterations, extraction miss => skipped, subchain loopDepth, Mod+D menu/shortcut mismatch, Display first-edge-only, single-node ignoring edges) => implementer STOPs and asks the user per item (AskUserQuestion) before any behaviour change; test is written as `test.fixme` with the question noted until answered.

## File layout
```
e2e/fixtures/chainRoutes.ts                 EDIT  new endpoints
e2e/fixtures/qa.ts                          EDIT  scoped 599 allowlist (opt-in)
src/components/settings/GeneralSection.tsx  EDIT  testid chain-concurrency-input (attribute only)
e2e/fixtures/chainE2eHelpers.ts             NEW   helpers (below)
e2e/fixtures/seed/chain-e2e.json            NEW   seeds (grows per phase)
e2e/fixtures/qa-seed.init.js                GEN   bun run qa:seed:build
e2e/qa/chain-e2e-simple-api-start-delay.spec.ts   S-API/STR/DLY (47)
e2e/qa/chain-e2e-simple-logic.spec.ts             S-CND/DSP/EVL/VAL (48)
e2e/qa/chain-e2e-simple-flow.spec.ts              S-MRG/LOP/COL/SUB (45)
e2e/qa/chain-e2e-canvas.spec.ts                   GR (8) + CV (7)
e2e/qa/chain-e2e-runlog.spec.ts                   LOG (47)
e2e/qa/chain-e2e-medium.spec.ts                   M (40)
e2e/qa/chain-e2e-bugs.spec.ts                     BUG (26)
e2e/qa/chain-e2e-complex.spec.ts                  C (11) + X (6)
e2e/scenarios/chain/*.feature.md           EXISTS  9 Gherkin files (source of truth) + check-ids.sh
e2e/scenarios/chain/check-parity.sh         NEW     Gherkin <-> test title parity (Phase 6)
```
Existing-test removals (final phase): `e2e/chain.spec.ts` at CS:2605, CS:2757, CS:3217, CS:3125 (re-locate by title; line numbers shift).

## Helpers to add (`chainE2eHelpers.ts`)
`openChain`, `runChain({via})`, `waitRunDone`, `nodeBadge`, `expectNode(label,{state,errorCode?,footerUnresolved?})`, `openRunLog`, `expectStep(label,{state,http?,errorCode?,lane?})`, `expectRunSummary`, `expectBarSummary`, `openStepDetail(label,tab)`, `setFilter(tab)`. Additions beyond SPEC 3.3: `waitCanvasReady` (all `.react-flow__node[data-id]` rendered/initialized; used before any drag/nudge, fixes CANVAS-18), `stopChain`, `openNodePanel(type,label)`, `expectBanner(kind)`. Rules: no `waitForTimeout`, `getByTestId` first, web-first assertions/`expect.poll`, `snap()` at end.

## Source testids to add (minimal, SPEC 6)
Condition (`condition-config-variable|-branch-<id>-expression|-branch-<id>-label|-add-branch-btn|-remove-branch-<id>-btn|-save-btn`), Loop (`loop-config-source-path|-item-alias|-max-iterations|-save-btn`), Evaluate (`evaluate-config-code|-alias|-test-btn|-save-btn`), Validate (`validate-config-schema|-source-path|-save-btn`), Collect (`collect-config-loop`), API-node assertion panel `NodeAssertionsPanel.tsx` (source, operator, value, enable toggle; needed for S-API-13/15/16; names discovered in P0.2), RunFilterTabs (`run-filter-tab-<kind>`), NodeToolbar buttons, NodeContextMenu items, DeletableEdge delete, arrow-config testids (`ArrowConfigPanelBody.tsx`, `InjectionEditor.tsx`, `DisplayExtractor.tsx`: handle type, injection row remove, extractor picker), `chain-concurrency-input` (`GeneralSection.tsx`, concurrency lives on `/settings`). Attribute-only changes; no logic change. Only source logic change allowed outside this list is a CHN-BUG fix.

## Dependency graph
```
T0a testids ─┬─> helpers ─┬─> Simple specs (3) ─┬─> Medium ─┬─> Complex ─┐
T0b routes ──┤            │                     │           │            ├─> Cross + dedupe ─> Full-suite gate
T0c seeds ───┘            ├─> Run-log spec ─────┘           │            │
T0d console allowlist ────┤                                  │            │
T0e CANVAS-18 fix ────────┴─> Bug spec + fixes ─────────────┴────────────┘
```
Constraints: seeds, routes and helpers are shared (single owner per phase, sequential edits to `chain-e2e.json`; `qa:seed:build` after every seed change). Spec files within a phase are independent and may be built in parallel by separate agents ONLY if each agent appends distinct seed ids and one agent owns the `qa:seed:build` run. Bug fixes touching `src/lib/chainRunner` must land before Complex tests that depend on them.

## Phases (vertical slices; each ends in a checkpoint)

### Phase 0: Foundation (Core Risk first)
- Confirm the Gherkin files are the source of truth (`check-ids.sh` green) before any test is written.
- Add testids (all panels), verify each via a throwaway selector check in the first spec.
- Extend `chainRoutes.ts`; add seeds for the first slice (api-single, api-fail500, start-literal, delay-short); `qa:seed:build`.
- Build helpers; add scoped 599 allowlist.
- Fix CANVAS-18 (UO:4700): root-cause React Flow #015 (nudge before node init) by `waitCanvasReady` in the test and, if the app triggers it, a source fix; do not allowlist warnings.
- Slice proof: one end-to-end test (CHN-S-API-01) green using the new helpers, canvas + run log.
- Checkpoint 0: CANVAS-18 green at `--repeat-each=5`; seed drift spec green; S-API-01 green; existing 202 still green (minus none removed yet).

### Phase 1: Simple per-node (3 files, ordered by risk and dependency)
1a API/Start/Delay (needs UI assertion authoring for S-API-13/15/16), 1b logic nodes (Condition/Display/Evaluate/Validate), 1c flow nodes (Merge/Loop/Collect/Subchain) plus the canvas file `chain-e2e-canvas.spec.ts` (GR undo/persistence/rename/picker/paste, CV banners). Extras tasks P1.3a, P1.8a, P1.13a, P1.13b sit before each file's checkpoint. Seeds added per file just before use. Condition `>=` seed is created here but its test lives in BUG phase.
- Checkpoint 1 (after each file): file green, `--repeat-each=3`, canvas+log asserted in every test.

### Phase 2: Run log
47 LOG scenarios on `chain-e2e-runlog.spec.ts` (LOG-33..39 add dock persistence, run select, trigger labels, virtualisation >50 rows, 50-run cap, detail pane, failure link), placed before Medium because Medium/Complex reuse `expectStep`/`setFilter`/`openStepDetail` and LOG surfaces helper gaps early. Needs seeds `polish-*` (existing) + `api-text`, `api-assert-fail`. Delete/undo/reload (LOG-21/22) coordinate with BUG-14.
- Checkpoint 2: file green, repeat x3.

### Phase 3: Medium (40)
Seeds `qa-e2e-med-*`. Two-three block combos; includes from-here/upTo/single re-runs (M-28..30), cancel (M-31), cancel-then-rerun, reload persistence and renamed subchain (M-33..35). Every row has explicit Graph/Steps/Canvas/Run-log columns in SPEC 5.2.
- Checkpoint 3: green, repeat x3, total runtime recorded.

### Phase 4: Bug verification and fixes (26)
Order: BUG-19 done in P0; BUG-01 (`>=`/`<=` evaluator fix + regression, automatic); then the unambiguous-by-nature ones (03, 04, 05, 11, 13, 14, 15, 16, 17, 18) written desired-behaviour-first; fix when clearly defective. BUG-06 is documented as intended (source-verified, no question). Ambiguous ones (07, 08, 09, 10, 12, 02) => STOP, ask the user per item with options (fix / document as intended), record decision in SPEC 12 addendum, then write test accordingly. Never batch decisions into silent changes.
- Checkpoint 4: every BUG item is resolved (fixed+regression, documented, or `fixme` pending an answer, which blocks the final gate); engine unit tests untouched (no unit tests added per SPEC Never list, except none).

### Phase 5: Complex (11)
Seeds `qa-e2e-cx-*`. C-01..C-10 assert bar Running -> final, filters, nested toggles; C-06 and C-09 are the most timing- and persistence-sensitive and go last.
- Checkpoint 5: green, repeat x3.

### Phase 6: Cross-cutting and dedupe
CHN-X-01..06 in `chain-e2e-complex.spec.ts`; Gherkin <-> test parity check (`check-parity.sh`: every Gherkin ID has exactly one `[ID]`-titled test and vice versa); matrix audit against SPEC 4 (no empty cell); remove the 4 overlapping CS tests.

### Phase 7: Full-suite green gate
Whole chain suite, flake gate, typecheck/lint (run only now), seed drift, final summary with verification steps.

## Verification commands
```
# single file
PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-<name>.spec.ts
# single test
... bunx playwright test e2e/qa/chain-e2e-<name>.spec.ts -g "CHN-S-API-01"
# flake check
... bunx playwright test e2e/qa/chain-e2e-*.spec.ts --repeat-each=3
# CANVAS-18
... bunx playwright test e2e/qa/chaining-ui-overhaul.spec.ts -g "CANVAS-18" --repeat-each=5
# full chain suite (final gate)
... bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts
# seeds
bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts
# static (only at the very end)
bun run lint && bunx tsc --noEmit
```
First-time only: `bunx playwright install chromium`. Failures: inspect `trace retain-on-failure`; never retry-until-green.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Flakiness from timing (running/cancel, delays, parallel lanes) | High | Web-first assertions only; slow routes only where running state is needed; assert ordering by lane/step index not wall clock; `--repeat-each=3` gate per file, x5 for CANVAS-18 and cancel tests; no `waitForTimeout` |
| Suite runtime growth: baseline ~221s for 202 tests; +285 tests could exceed ~9 min | Med | Seeded setup (no UI building); 2 workers fullyParallel; keep slow routes (`/api/slow` 5s) to the few cancel/running tests, prefer `/api/medium` 1.5s; delay seeds use 200 ms; split files for balanced workers; track per-phase duration and flag outliers (>20s tests) |
| React Flow init warnings (#015) trip consoleGuard | High | `waitCanvasReady` before drag/nudge/shortcuts; fix source if app-caused; no global guard bypass |
| Missing testids make selectors brittle | Med | Phase 0 adds them first; fall back to role/label only when attribute-free |
| Unverified engine behavior behind bug scenarios | High | Phase 4 early-ish, stop-and-ask protocol per ambiguous item; `fixme` prevents silent behaviour changes; Complex phase depends on Phase 4 outcomes |
| Seed file merge conflicts / drift between parallel agents | Med | Single owner for `chain-e2e.json` and `qa:seed:build` per phase; unique `qa-e2e-*` ids (loader throws on dupes) |
| Assertion-config UI not fully analysed (UI authoring) | Med | Task 0 discovery spike of that panel; add testids; if infeasible, ask the user rather than silently seeding |
| Removing 4 existing tests loses coverage | Low | Remove last, only after the new/overlapping copies are green; titles recorded in the removal task |
| Hidden regressions from bug fixes | Med | Each fix has regression test; full existing suite rerun at each checkpoint after Phase 4 |

## Checkpoint template
- [ ] New file(s) green; `--repeat-each=3` green
- [ ] Existing chain suite green
- [ ] Every scenario asserts canvas AND run log
- [ ] Seed build clean, drift spec green
- [ ] No new `waitForTimeout`, no consoleGuard bypass beyond the 599 allowlist
- [ ] Human review before the next phase when a bug decision was made

## Open Questions
None blocking; ambiguous bug items are resolved interactively during Phase 4 (SPEC 12.3).
