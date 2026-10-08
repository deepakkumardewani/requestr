
# Tasks: Thorough Playwright E2E for the Chain Feature

Inputs: `SPEC.md`, `PLAN.md`, `ANALYSIS-feature.md`, `ANALYSIS-coverage.md` (this folder). Planning artifact only. Commands: `bun`/`bunx` only, never `npm`. Never start the server (running on :3000). Never commit unless told. Gherkin-first: `e2e/scenarios/chain/*.feature.md` (285 scenarios, one per ID) is the source of truth for every test; each test title is prefixed `[<ID>]` (so `--grep <ID>` selects it) and its Given/When/Then become arrange/act/assert. Each task has a **Gherkin** field naming its feature file and scenario IDs; P0.0 and P6.3 verify the Gherkin <-> test mapping. Env prefix on every command: `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000`.

Legend: ☐ todo (flip to ✅ in the implementation loop). Kinds: implementation | e2e | gate | walkthrough | dod. Each phase ends with a checkpoint.

First-time only: `bunx playwright install chromium`. Browser checks use the seeded QA specs; `agent-browser` is never used as evidence.

## Phase 0: Foundation (core risk first)

Gherkin confirmed as source of truth, testids, routes, console allowlist, helpers, first seeds, CANVAS-18 fix, vertical slice CHN-S-API-01

### ✅ P0.0 Gherkin scenarios exist and are the source of truth
- **Kind**: dod
- **Files** (0): none (verification only; the 9 feature files and `check-ids.sh` are already written)
- **Scenarios**: none
- **Gherkin**: all 285 scenarios, 9 files in `e2e/scenarios/chain/*.feature.md` (nodes-request-start-delay, nodes-logic, nodes-flow, canvas, medium, complex, run-log, bugs, cross-cutting)
- **Depends on**: none
- **Do**: Confirm one `## Scenario: [ID]` exists per SPEC ID. From here on every test is implemented from its Gherkin scenario: the test title is `[<ID>] <scenario name>`, Given becomes arrange (seed + open), When becomes act, Then becomes assert (canvas AND run log). SPEC rows only add seeds, selectors and assertion detail; on any disagreement the Gherkin wins and the SPEC row is corrected first.
- **Acceptance**:
  - `check-ids.sh` reports 285 SPEC IDs, 285 feature IDs, no duplicates, none missing, none extra.
  - Every implementation/e2e task below has a **Gherkin** field naming its feature file(s) and scenario IDs.
- **Verify**:
  - `bash e2e/scenarios/chain/check-ids.sh`  (expect "SPEC ids: 285  feature ids: 285" and "OK: ID sets match")

### ✅ P0.1 Add testids to Condition/Loop/Evaluate/Validate/Collect config panels
- **Kind**: implementation
- **Files** (5): `src/components/chain/panels/ConditionConfigPanel.tsx`; `src/components/chain/panels/LoopConfigPanel.tsx`; `src/components/chain/panels/EvaluateConfigPanel.tsx`; `src/components/chain/panels/ValidateConfigPanel.tsx`; `src/components/chain/panels/CollectConfigPanel.tsx`
- **Scenarios**: none
- **Gherkin**: none (supporting task, implements no scenario ID)
- **Depends on**: none
- **Do**: Add `data-testid` attributes only (SPEC 6): `condition-config-variable|-branch-<id>-expression|-branch-<id>-label|-add-branch-btn|-remove-branch-<id>-btn|-save-btn`; `loop-config-source-path|-item-alias|-max-iterations|-save-btn`; `evaluate-config-code|-alias|-test-btn|-save-btn`; `validate-config-schema|-source-path|-save-btn`; `collect-config-loop`.
- **Acceptance**:
  - Every testid listed in SPEC 6 for these five panels exists and is unique per panel.
  - Diff is attribute-only; no logic change.
- **Verify**:
  - `grep -rnE "data-testid=.*(condition-config|loop-config|evaluate-config|validate-config|collect-config)" src/components/chain/panels | wc -l`  (expect >= 18)
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chaining-ui-overhaul.spec.ts --grep @qa`  (existing QA specs unaffected)

### ✅ P0.2 Add testids: assertions panel, run filter tabs, node toolbar, context menu, deletable edge
- **Kind**: implementation
- **Files** (5): `src/components/chain/panels/NodeAssertionsPanel.tsx`; `src/components/chain/run-log/RunFilterTabs.tsx`; `src/components/chain/nodes/NodeToolbar.tsx`; `src/components/chain/canvas/NodeContextMenu.tsx`; `src/components/chain/canvas/DeletableEdge.tsx`
- **Scenarios**: none
- **Gherkin**: none (supporting task, implements no scenario ID)
- **Depends on**: none
- **Do**: Discovery spike for the API-node assertion-config UI (names not yet known): read `NodeAssertionsPanel.tsx`, list the controls S-API-13 needs, add testids; record the discovered names (source, operator, value, enable toggle, add/remove) in a comment-free list at the top of `chainE2eHelpers.ts` in P0.4; the controls needed by S-API-15/16 (assertion sources, operators, enable toggle) are part of this spike. Add `run-filter-tab-<kind>`, NodeToolbar button ids, NodeContextMenu item ids, edge delete id. If assertion authoring cannot be driven by UI, STOP and ask the user (do not silently seed).
- **Acceptance**:
  - Testids exist for: assertion add/edit/save controls, `run-filter-tab-<kind>`, toolbar buttons, context-menu items, edge delete.
  - Attribute-only diff.
- **STOP and ask the user**: If the assertion panel cannot be driven through the UI, STOP and ask the user (AskUserQuestion) before falling back to seeded config.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chaining-ui-overhaul.spec.ts --grep RUNLOG`  (existing run-log tests unaffected)

### ✅ P0.3 Arrow panel testids, new mock endpoints, scoped 599 allowlist
- **Kind**: implementation
- **Files** (5): `src/components/chain/panels/arrow-config/ArrowConfigPanelBody.tsx`; `src/components/chain/panels/arrow-config/InjectionEditor.tsx`; `src/components/chain/panels/arrow-config/DisplayExtractor.tsx`; `e2e/fixtures/chainRoutes.ts`; `e2e/fixtures/qa.ts`
- **Scenarios**: none
- **Gherkin**: none (supporting task, implements no scenario ID)
- **Depends on**: none
- **Do**: Add arrow-config testids (handle type success/fail, injection row remove, extractor picker) in the three arrow-config files (there is no `ArrowConfigPanel.tsx`). Extend `installChainRoutes` with `/api/users`, `/api/empty-list`, `/api/object`, `/api/text`, `/api/status/404`, `/api/score`, `/api/medium` (1.5s), `/api/list-mixed`, `/api/list-60` (60 items), `/api/abort` (handler calls `route.abort()` so the proxy reports REQUEST_FAILED), `/api/item/{1,fail,3}` (exact pathname, stateless; unknown stays 599 + console.error). Add an opt-in `allowExpectedConsoleError(page, /exact 599 mock message/)` helper in `qa.ts`; default guard unchanged.
- **Acceptance**:
  - All listed endpoints return deterministic documented bodies.
  - Allowlist is opt-in and matches only the exact 599 mock message. The 599 envelope is an HTTP_STATUS failure; `/api/abort` is the only REQUEST_FAILED source.
  - A deliberately unexpected console.error in a scratch test still fails (confirmed, then scratch removed).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chaining-ui-overhaul.spec.ts --grep @qa`  (default guard unchanged)

### ✅ P0.4 Helpers file and first seeds
- **Kind**: implementation
- **Files** (4): `e2e/fixtures/chainE2eHelpers.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `src/components/settings/GeneralSection.tsx`
- **Scenarios**: none
- **Gherkin**: none (supporting task, implements no scenario ID)
- **Depends on**: P0.1, P0.2, P0.3
- **Do**: Create helpers: `openChain`, `runChain({via})`, `waitRunDone`, `nodeBadge`, `expectNode`, `openRunLog`, `expectStep`, `expectRunSummary`, `expectBarSummary`, `openStepDetail`, `setFilter`, plus `waitCanvasReady`, `stopChain`, `openNodePanel`, `expectBanner`. Add seeds api-single, api-fail500, start-literal, delay-short (`qa-e2e-*`). Also add the attribute-only testid `chain-concurrency-input` on the `#chain-concurrency` input in `GeneralSection.tsx` (used by S-API-07).
- **Acceptance**:
  - Helpers exported and typed; thin functions over `getByTestId`, no page-object classes, no `waitForTimeout`.
  - `waitCanvasReady` waits for all `.react-flow__node[data-id]` to render/initialize.
  - Seeds built; drift spec green.
- **Verify**:
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P0.5 Vertical slice: CHN-S-API-01 end to end
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-API-01
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-request-start-delay.feature.md`: CHN-S-API-01
- **Depends on**: P0.0, P0.4
- **Do**: Add scenarios CHN-S-API-01 to `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: api-single. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
  - Proves helpers + seed + routes work together (canvas and run log).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-api-start-delay.spec.ts --grep "CHN-S-API-01" --repeat-each=3`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P0.6 Fix CANVAS-18 (React Flow warning #015) - CHN-BUG-19
- **Kind**: e2e
- **Files** (2): `e2e/qa/chaining-ui-overhaul.spec.ts`; `e2e/fixtures/chainE2eHelpers.ts`
- **Scenarios**: CHN-BUG-19
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-19
- **Depends on**: P0.4
- **Do**: Root-cause: test nudges/drags before node init (UO:4700). Use `waitCanvasReady` before the nudge in the test; if the app itself triggers #015, apply a minimal source fix (list the file in this task before editing; max 5 files total). Do not allowlist the warning. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - CANVAS-18 passes 5/5 with consoleGuard unchanged. The existing test title is prefixed `[CHN-BUG-19]` (remainder of the title kept, so `--grep CANVAS-18` still works); this is the one ID implemented outside `chain-e2e-*.spec.ts`.
  - No other test in the file changed.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chaining-ui-overhaul.spec.ts --grep CANVAS-18 --repeat-each=5`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chaining-ui-overhaul.spec.ts`

### ✅ P0.7 Checkpoint 0
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P0.0, P0.1, P0.2, P0.3, P0.4, P0.5, P0.6
- **Do**: Run the Phase 0 checkpoint commands.
- **Acceptance**:
  - All commands below exit 0.
  - Flake check passes at the stated `--repeat-each` with zero retries-to-green.
  - Existing chain suite still green (no regression).
- **Verify**:
  - `bash e2e/scenarios/chain/check-ids.sh`  (expect "OK: ID sets match")
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-api-start-delay.spec.ts --repeat-each=3`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts`  (existing 202 intact)

🔶 **Checkpoint 0**: all Phase 0 tasks ✅, Verify commands green, no regression in the existing chain suite, human review if a bug decision was made.

## Phase 1: Simple per-node specs

140 CHN-S scenarios across 3 per-node files plus 15 CHN-GR/CV scenarios in `chain-e2e-canvas.spec.ts`, each node type its own task

### ✅ P1.1 Simple: API request node (S-API-02..13)
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `e2e/fixtures/chainE2eHelpers.ts`
- **Scenarios**: CHN-S-API-02, CHN-S-API-03, CHN-S-API-04, CHN-S-API-05a, CHN-S-API-05b, CHN-S-API-06a, CHN-S-API-06b, CHN-S-API-07a, CHN-S-API-07b, CHN-S-API-08, CHN-S-API-09, CHN-S-API-10, CHN-S-API-11, CHN-S-API-12, CHN-S-API-13
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-request-start-delay.feature.md`: CHN-S-API-02, CHN-S-API-03, CHN-S-API-04, CHN-S-API-05a, CHN-S-API-05b, CHN-S-API-06a, CHN-S-API-06b, CHN-S-API-07a, CHN-S-API-07b, CHN-S-API-08, CHN-S-API-09, CHN-S-API-10, CHN-S-API-11, CHN-S-API-12, CHN-S-API-13
- **Depends on**: P0.5
- **Do**: Add scenarios CHN-S-API-02, CHN-S-API-03, CHN-S-API-04, CHN-S-API-05a, CHN-S-API-05b, CHN-S-API-06a, CHN-S-API-06b, CHN-S-API-07a, CHN-S-API-07b, CHN-S-API-08, CHN-S-API-09, CHN-S-API-10, CHN-S-API-11, CHN-S-API-12, CHN-S-API-13 to `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json` (names per SPEC 3.1): api-fail500, api-404, api-unmocked (599, scoped allowlist), api-text, api-empty-list, api-inject-hdr/-url/-path/-body/-miss/-badbody, api-assert-pass/-fail. S-API-06 also runs api-inject-badbody (INJECTION_BODY_NOT_JSON); S-API-07 sets concurrency on `/settings` via `chain-concurrency-input`. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. S-API-13 authors assertions through the UI (SPEC 12.1); other assertion scenarios seed config.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-api-start-delay.spec.ts --grep "CHN-S-API-(02|03|04|05|06|07|08|09|10|11|12|13)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.2 Simple: Start node (S-STR-01..10)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-STR-01, CHN-S-STR-02, CHN-S-STR-03, CHN-S-STR-04, CHN-S-STR-05a, CHN-S-STR-05b, CHN-S-STR-06, CHN-S-STR-07a, CHN-S-STR-07b, CHN-S-STR-08, CHN-S-STR-09, CHN-S-STR-10
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-request-start-delay.feature.md`: CHN-S-STR-01, CHN-S-STR-02, CHN-S-STR-03, CHN-S-STR-04, CHN-S-STR-05a, CHN-S-STR-05b, CHN-S-STR-06, CHN-S-STR-07a, CHN-S-STR-07b, CHN-S-STR-08, CHN-S-STR-09, CHN-S-STR-10
- **Depends on**: P1.1
- **Do**: Add scenarios CHN-S-STR-01, CHN-S-STR-02, CHN-S-STR-03, CHN-S-STR-04, CHN-S-STR-05a, CHN-S-STR-05b, CHN-S-STR-06, CHN-S-STR-07a, CHN-S-STR-07b, CHN-S-STR-08, CHN-S-STR-09, CHN-S-STR-10 to `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: start-literal variants, start-override, start-multi/duplicate. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. Start panel is UI-authored (SPEC 5.1).
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-api-start-delay.spec.ts --grep "CHN-S-STR-(01|02|03|04|05|06|07|08|09|10)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.3 Simple: Delay node (S-DLY-01..06)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-DLY-01, CHN-S-DLY-02, CHN-S-DLY-03a, CHN-S-DLY-03b, CHN-S-DLY-04, CHN-S-DLY-05, CHN-S-DLY-06
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-request-start-delay.feature.md`: CHN-S-DLY-01, CHN-S-DLY-02, CHN-S-DLY-03a, CHN-S-DLY-03b, CHN-S-DLY-04, CHN-S-DLY-05, CHN-S-DLY-06
- **Depends on**: P1.2
- **Do**: Add scenarios CHN-S-DLY-01, CHN-S-DLY-02, CHN-S-DLY-03a, CHN-S-DLY-03b, CHN-S-DLY-04, CHN-S-DLY-05, CHN-S-DLY-06 to `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: delay-short (200 ms), delay-long (5000 ms), delay-zero (0 ms). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-api-start-delay.spec.ts --grep "CHN-S-DLY-(01|02|03|04|05|06)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.3a Simple: API and Start extras (S-API-14..22, S-STR-11)
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `e2e/fixtures/chainE2eHelpers.ts`
- **Scenarios**: CHN-S-API-14, CHN-S-API-15a, CHN-S-API-15b, CHN-S-API-16, CHN-S-API-17, CHN-S-API-18a, CHN-S-API-18b, CHN-S-API-19, CHN-S-API-20, CHN-S-API-21, CHN-S-API-22, CHN-S-STR-11
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-request-start-delay.feature.md`: CHN-S-API-14, CHN-S-API-15a, CHN-S-API-15b, CHN-S-API-16, CHN-S-API-17, CHN-S-API-18a, CHN-S-API-18b, CHN-S-API-19, CHN-S-API-20, CHN-S-API-21, CHN-S-API-22, CHN-S-STR-11
- **Depends on**: P1.3
- **Do**: Add the listed scenarios to `e2e/qa/chain-e2e-simple-api-start-delay.spec.ts`. Seeds: api-abort (uses `/api/abort`, REQUEST_FAILED), api-nourl, api-assert variants (per source, operator, disabled toggle), reuse med fail-handle and api-inject-hdr (second injection), start-multi, api-promote-env (S-API-21/22: extraction promoted to an environment variable; the stop case adds a slow downstream request, uses `/api/slow` only here). Assertion authoring uses the controls recorded in P0.2. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
  - Items marked VERIFY in SPEC are first observed against the running app; assert the observed, source-confirmed behaviour. If it contradicts the SPEC row and looks like a defect, STOP and ask the user (AskUserQuestion) before changing behaviour.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-api-start-delay.spec.ts --grep "CHN-S-(API-(14|15|16|17|18|19|20|21|22)|STR-11)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.4 Checkpoint 1a: API/Start/Delay file
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P1.1, P1.2, P1.3, P1.3a
- **Do**: Flake and regression gate for file 1.
- **Acceptance**:
  - All commands below exit 0.
  - Flake check passes at the stated `--repeat-each` with zero retries-to-green.
  - Existing chain suite still green (no regression).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-api-start-delay.spec.ts --repeat-each=3`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.5 Simple: Condition node (S-CND-01..10)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-logic.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-CND-01, CHN-S-CND-02, CHN-S-CND-03, CHN-S-CND-04, CHN-S-CND-05, CHN-S-CND-06, CHN-S-CND-07, CHN-S-CND-08, CHN-S-CND-09, CHN-S-CND-10
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-logic.feature.md`: CHN-S-CND-01, CHN-S-CND-02, CHN-S-CND-03, CHN-S-CND-04, CHN-S-CND-05, CHN-S-CND-06, CHN-S-CND-07, CHN-S-CND-08, CHN-S-CND-09, CHN-S-CND-10
- **Depends on**: P1.4, P0.1
- **Do**: Add scenarios CHN-S-CND-01, CHN-S-CND-02, CHN-S-CND-03, CHN-S-CND-04, CHN-S-CND-05, CHN-S-CND-06, CHN-S-CND-07, CHN-S-CND-08, CHN-S-CND-09, CHN-S-CND-10 to `e2e/qa/chain-e2e-simple-logic.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: cond-eq, cond-gte (seed only; its test lives in P4.1), cond-multi-branch, cond-else. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. S-CND-06 authors branches through the UI. Do not assert `>=`/`<=` here (CHN-BUG-01).
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-logic.spec.ts --grep "CHN-S-CND-(01|02|03|04|05|06|07|08|09|10)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.6 Simple: Display node (S-DSP-01..10)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-logic.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-DSP-01, CHN-S-DSP-02, CHN-S-DSP-03, CHN-S-DSP-04, CHN-S-DSP-05, CHN-S-DSP-06, CHN-S-DSP-07, CHN-S-DSP-08, CHN-S-DSP-09, CHN-S-DSP-10
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-logic.feature.md`: CHN-S-DSP-01, CHN-S-DSP-02, CHN-S-DSP-03, CHN-S-DSP-04, CHN-S-DSP-05, CHN-S-DSP-06, CHN-S-DSP-07, CHN-S-DSP-08, CHN-S-DSP-09, CHN-S-DSP-10
- **Depends on**: P1.5
- **Do**: Add scenarios CHN-S-DSP-01, CHN-S-DSP-02, CHN-S-DSP-03, CHN-S-DSP-04, CHN-S-DSP-05, CHN-S-DSP-06, CHN-S-DSP-07, CHN-S-DSP-08, CHN-S-DSP-09, CHN-S-DSP-10 to `e2e/qa/chain-e2e-simple-logic.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: disp-*. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-logic.spec.ts --grep "CHN-S-DSP-(01|02|03|04|05|06|07|08|09|10)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.7 Simple: Evaluate node (S-EVL-01..09)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-logic.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-EVL-01, CHN-S-EVL-02, CHN-S-EVL-03, CHN-S-EVL-04a, CHN-S-EVL-04b, CHN-S-EVL-05, CHN-S-EVL-06, CHN-S-EVL-07, CHN-S-EVL-08, CHN-S-EVL-09
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-logic.feature.md`: CHN-S-EVL-01, CHN-S-EVL-02, CHN-S-EVL-03, CHN-S-EVL-04a, CHN-S-EVL-04b, CHN-S-EVL-05, CHN-S-EVL-06, CHN-S-EVL-07, CHN-S-EVL-08, CHN-S-EVL-09
- **Depends on**: P1.6
- **Do**: Add scenarios CHN-S-EVL-01, CHN-S-EVL-02, CHN-S-EVL-03, CHN-S-EVL-04a, CHN-S-EVL-04b, CHN-S-EVL-05, CHN-S-EVL-06, CHN-S-EVL-07, CHN-S-EVL-08, CHN-S-EVL-09 to `e2e/qa/chain-e2e-simple-logic.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: eval-*. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-logic.spec.ts --grep "CHN-S-EVL-(01|02|03|04|05|06|07|08|09)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.8 Simple: Validate node (S-VAL-01..08)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-logic.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-VAL-01, CHN-S-VAL-02, CHN-S-VAL-03, CHN-S-VAL-04, CHN-S-VAL-05, CHN-S-VAL-06, CHN-S-VAL-07, CHN-S-VAL-08a, CHN-S-VAL-08b
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-logic.feature.md`: CHN-S-VAL-01, CHN-S-VAL-02, CHN-S-VAL-03, CHN-S-VAL-04, CHN-S-VAL-05, CHN-S-VAL-06, CHN-S-VAL-07, CHN-S-VAL-08a, CHN-S-VAL-08b
- **Depends on**: P1.7
- **Do**: Add scenarios CHN-S-VAL-01, CHN-S-VAL-02, CHN-S-VAL-03, CHN-S-VAL-04, CHN-S-VAL-05, CHN-S-VAL-06, CHN-S-VAL-07, CHN-S-VAL-08a, CHN-S-VAL-08b to `e2e/qa/chain-e2e-simple-logic.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: val-*. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-logic.spec.ts --grep "CHN-S-VAL-(01|02|03|04|05|06|07|08)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.8a Simple: logic node extras (S-CND-11..13, S-DSP-11..12, S-EVL-10..11, S-VAL-09)
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-simple-logic.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `e2e/fixtures/chainE2eHelpers.ts`
- **Scenarios**: CHN-S-CND-11a, CHN-S-CND-11b, CHN-S-CND-12, CHN-S-CND-13, CHN-S-DSP-11, CHN-S-DSP-12, CHN-S-EVL-10, CHN-S-EVL-11, CHN-S-VAL-09
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-logic.feature.md`: CHN-S-CND-11a, CHN-S-CND-11b, CHN-S-CND-12, CHN-S-CND-13, CHN-S-DSP-11, CHN-S-DSP-12, CHN-S-EVL-10, CHN-S-EVL-11, CHN-S-VAL-09
- **Depends on**: P1.8
- **Do**: Add the listed scenarios to `e2e/qa/chain-e2e-simple-logic.spec.ts`. Seeds: cond-ge, cond-badnum, cond-multi (overlap), disp-after-fail, eval-syntax, val-fail. S-CND-11 shares its seed with CHN-BUG-01 (P4.1) but does not replace it. S-EVL-11 (sandbox globals) is VERIFY: if the engine behaviour is ambiguous, STOP and ask. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
  - Items marked VERIFY in SPEC are first observed against the running app; assert the observed, source-confirmed behaviour. If it contradicts the SPEC row and looks like a defect, STOP and ask the user (AskUserQuestion) before changing behaviour.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-logic.spec.ts --grep "CHN-S-(CND-(11|12|13)|DSP-(11|12)|EVL-(10|11)|VAL-09)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.9 Checkpoint 1b: logic nodes file
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P1.5, P1.6, P1.7, P1.8, P1.8a
- **Do**: Flake and regression gate for file 2.
- **Acceptance**:
  - All commands below exit 0.
  - Flake check passes at the stated `--repeat-each` with zero retries-to-green.
  - Existing chain suite still green (no regression).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-logic.spec.ts --repeat-each=3`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.10 Simple: Merge node (S-MRG-01..07)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-flow.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-MRG-01, CHN-S-MRG-02, CHN-S-MRG-03, CHN-S-MRG-04, CHN-S-MRG-05, CHN-S-MRG-06, CHN-S-MRG-07
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-flow.feature.md`: CHN-S-MRG-01, CHN-S-MRG-02, CHN-S-MRG-03, CHN-S-MRG-04, CHN-S-MRG-05, CHN-S-MRG-06, CHN-S-MRG-07
- **Depends on**: P1.9
- **Do**: Add scenarios CHN-S-MRG-01, CHN-S-MRG-02, CHN-S-MRG-03, CHN-S-MRG-04, CHN-S-MRG-05, CHN-S-MRG-06, CHN-S-MRG-07 to `e2e/qa/chain-e2e-simple-flow.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: mrg-*. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-flow.spec.ts --grep "CHN-S-MRG-(01|02|03|04|05|06|07)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.11 Simple: Loop node (S-LOP-01..12)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-flow.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-LOP-01, CHN-S-LOP-02, CHN-S-LOP-03, CHN-S-LOP-04, CHN-S-LOP-05, CHN-S-LOP-06, CHN-S-LOP-07a, CHN-S-LOP-07b, CHN-S-LOP-08, CHN-S-LOP-09a, CHN-S-LOP-09b, CHN-S-LOP-10, CHN-S-LOP-11, CHN-S-LOP-12
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-flow.feature.md`: CHN-S-LOP-01, CHN-S-LOP-02, CHN-S-LOP-03, CHN-S-LOP-04, CHN-S-LOP-05, CHN-S-LOP-06, CHN-S-LOP-07a, CHN-S-LOP-07b, CHN-S-LOP-08, CHN-S-LOP-09a, CHN-S-LOP-09b, CHN-S-LOP-10, CHN-S-LOP-11, CHN-S-LOP-12
- **Depends on**: P1.10, P0.1
- **Do**: Add scenarios CHN-S-LOP-01, CHN-S-LOP-02, CHN-S-LOP-03, CHN-S-LOP-04, CHN-S-LOP-05, CHN-S-LOP-06, CHN-S-LOP-07a, CHN-S-LOP-07b, CHN-S-LOP-08, CHN-S-LOP-09a, CHN-S-LOP-09b, CHN-S-LOP-10, CHN-S-LOP-11, CHN-S-LOP-12 to `e2e/qa/chain-e2e-simple-flow.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: loop-ok, loop-empty, loop-max, loop-alias-*. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-flow.spec.ts --grep "CHN-S-LOP-(01|02|03|04|05|06|07|08|09|10|11|12)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.12 Simple: Collect node (S-COL-01..05)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-flow.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-COL-01, CHN-S-COL-02, CHN-S-COL-03, CHN-S-COL-04, CHN-S-COL-05
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-flow.feature.md`: CHN-S-COL-01, CHN-S-COL-02, CHN-S-COL-03, CHN-S-COL-04, CHN-S-COL-05
- **Depends on**: P1.11
- **Do**: Add scenarios CHN-S-COL-01, CHN-S-COL-02, CHN-S-COL-03, CHN-S-COL-04, CHN-S-COL-05 to `e2e/qa/chain-e2e-simple-flow.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: col-*. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-flow.spec.ts --grep "CHN-S-COL-(01|02|03|04|05)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.13 Simple: Subchain node (S-SUB-01..08)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-simple-flow.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-S-SUB-01, CHN-S-SUB-02, CHN-S-SUB-03, CHN-S-SUB-04, CHN-S-SUB-05, CHN-S-SUB-06, CHN-S-SUB-07, CHN-S-SUB-08
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-flow.feature.md`: CHN-S-SUB-01, CHN-S-SUB-02, CHN-S-SUB-03, CHN-S-SUB-04, CHN-S-SUB-05, CHN-S-SUB-06, CHN-S-SUB-07, CHN-S-SUB-08
- **Depends on**: P1.12
- **Do**: Add scenarios CHN-S-SUB-01, CHN-S-SUB-02, CHN-S-SUB-03, CHN-S-SUB-04, CHN-S-SUB-05, CHN-S-SUB-06, CHN-S-SUB-07, CHN-S-SUB-08 to `e2e/qa/chain-e2e-simple-flow.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: sub-parent-ok, sub-*. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. S-SUB-04 authors via SubChainPicker (UI).
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-flow.spec.ts --grep "CHN-S-SUB-(01|02|03|04|05|06|07|08)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.13a Simple: flow node extras (S-MRG-08, S-LOP-13..17, S-COL-06, S-SUB-09..11)
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-simple-flow.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `e2e/fixtures/chainE2eHelpers.ts`
- **Scenarios**: CHN-S-MRG-08, CHN-S-LOP-13, CHN-S-LOP-14, CHN-S-LOP-15, CHN-S-LOP-16, CHN-S-LOP-17, CHN-S-COL-06a, CHN-S-COL-06b, CHN-S-SUB-09, CHN-S-SUB-10, CHN-S-SUB-11
- **Gherkin**: `e2e/scenarios/chain/chain-nodes-flow.feature.md`: CHN-S-MRG-08, CHN-S-LOP-13, CHN-S-LOP-14, CHN-S-LOP-15, CHN-S-LOP-16, CHN-S-LOP-17, CHN-S-COL-06a, CHN-S-COL-06b, CHN-S-SUB-09, CHN-S-SUB-10, CHN-S-SUB-11
- **Depends on**: P1.13
- **Do**: Add the listed scenarios to `e2e/qa/chain-e2e-simple-flow.spec.ts`. Seeds: merge-all-ok + tail, loop-nested3, loop-nested4 (banner `canvas-banner-loop-nesting-depth`), loop tail, sub-parent-self, sub-parent-fail. S-LOP-09 (reworded in SPEC) is verified in P1.11: panel alert plus runtime LOOP_INVALID_ALIAS; update that test if it asserts only the runtime path. Constants: MAX_LOOP_NESTING_DEPTH 3, MAX_SUBCHAIN_DEPTH 5. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
  - Items marked VERIFY in SPEC are first observed against the running app; assert the observed, source-confirmed behaviour. If it contradicts the SPEC row and looks like a defect, STOP and ask the user (AskUserQuestion) before changing behaviour.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-flow.spec.ts --grep "CHN-S-(MRG-08|LOP-(13|14|15|16|17)|COL-06|SUB-(09|10|11))" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.13b Canvas interactions and graph validation banners (GR-01..08, CV-01..07)
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-canvas.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `e2e/fixtures/chainE2eHelpers.ts`
- **Scenarios**: CHN-GR-01, CHN-GR-02, CHN-GR-03, CHN-GR-04, CHN-GR-05, CHN-GR-06, CHN-GR-07, CHN-GR-08, CHN-CV-01, CHN-CV-02, CHN-CV-03, CHN-CV-04, CHN-CV-05, CHN-CV-06, CHN-CV-07
- **Gherkin**: `e2e/scenarios/chain/chain-canvas.feature.md`: CHN-GR-01, CHN-GR-02, CHN-GR-03, CHN-GR-04, CHN-GR-05, CHN-GR-06, CHN-GR-07, CHN-GR-08, CHN-CV-01, CHN-CV-02, CHN-CV-03, CHN-CV-04, CHN-CV-05, CHN-CV-06, CHN-CV-07
- **Depends on**: P1.13a
- **Do**: Create `e2e/qa/chain-e2e-canvas.spec.ts`. Seeds: cycle (banner `canvas-banner-cycle`), start-only, loop-body-unconnected, loop-body-misses-collect, sub-parent-empty, plus reuse api-single/loop-unpaired, api-inject-hdr (GR-07 duplicate connection) and loop-ok (GR-08 occupied Loop handle); GR-06 drags a node onto itself. Banner types live in `src/app/chain/[collectionId]/ChainValidationBanners.tsx` (loop-unpaired, collect-unresolved, loop-nesting-depth, loop-body-unconnected, loop-body-misses-collect, subchain-invalid), `page.tsx` (cycle, merge) and `ChainCanvas.tsx` (start-only). Existing UO tests for rename, picker open, shortcuts overlay, align and find node are not repeated. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
  - Items marked VERIFY in SPEC are first observed against the running app; assert the observed, source-confirmed behaviour. If it contradicts the SPEC row and looks like a defect, STOP and ask the user (AskUserQuestion) before changing behaviour.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-canvas.spec.ts --grep "CHN-(GR|CV)-" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P1.14 Checkpoint 1c: flow nodes and canvas files
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P1.10, P1.11, P1.12, P1.13, P1.13a, P1.13b
- **Do**: Flake and regression gate for the flow file and the canvas file.
- **Acceptance**:
  - All commands below exit 0.
  - Flake check passes at the stated `--repeat-each` with zero retries-to-green.
  - Existing chain suite still green (no regression).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-simple-flow.spec.ts e2e/qa/chain-e2e-canvas.spec.ts --repeat-each=3`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

🔶 **Checkpoint 1**: all Phase 1 tasks ✅, Verify commands green, no regression in the existing chain suite, human review if a bug decision was made.

## Phase 2: Run log and results bar

47 CHN-LOG scenarios in chain-e2e-runlog.spec.ts

### ✅ P2.1 Run log: idle/running/passed/failed/skipped/aborted states (LOG-01..06)
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-runlog.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `e2e/fixtures/chainE2eHelpers.ts`
- **Scenarios**: CHN-LOG-01, CHN-LOG-02, CHN-LOG-03, CHN-LOG-04, CHN-LOG-05, CHN-LOG-06
- **Gherkin**: `e2e/scenarios/chain/chain-run-log.feature.md`: CHN-LOG-01, CHN-LOG-02, CHN-LOG-03, CHN-LOG-04, CHN-LOG-05, CHN-LOG-06
- **Depends on**: P1.14
- **Do**: Add scenarios CHN-LOG-01, CHN-LOG-02, CHN-LOG-03, CHN-LOG-04, CHN-LOG-05, CHN-LOG-06 to `e2e/qa/chain-e2e-runlog.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: reuse polish-never-run; add api-slow, delay-long, api-inject-miss. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-runlog.spec.ts --grep "CHN-LOG-(01|02|03|04|05|06)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P2.2 Run log: filter tabs and search (LOG-07..13)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-runlog.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-LOG-07, CHN-LOG-08, CHN-LOG-09, CHN-LOG-10, CHN-LOG-11, CHN-LOG-12a, CHN-LOG-12b, CHN-LOG-13
- **Gherkin**: `e2e/scenarios/chain/chain-run-log.feature.md`: CHN-LOG-07, CHN-LOG-08, CHN-LOG-09, CHN-LOG-10, CHN-LOG-11, CHN-LOG-12a, CHN-LOG-12b, CHN-LOG-13
- **Depends on**: P2.1
- **Do**: Add scenarios CHN-LOG-07, CHN-LOG-08, CHN-LOG-09, CHN-LOG-10, CHN-LOG-11, CHN-LOG-12a, CHN-LOG-12b, CHN-LOG-13 to `e2e/qa/chain-e2e-runlog.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: reuse polish-run-log; cx-01, cx-07 stubs (full cx seeds land in P5). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. LOG-09 overlaps BUG-17; keep its own assertion distinct.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-runlog.spec.ts --grep "CHN-LOG-(07|08|09|10|11|12|13)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P2.3 Run log: step detail tabs and nested toggles (LOG-14..20)
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-runlog.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `e2e/fixtures/chainRoutes.ts`
- **Scenarios**: CHN-LOG-14, CHN-LOG-15, CHN-LOG-16, CHN-LOG-17, CHN-LOG-18, CHN-LOG-19, CHN-LOG-20
- **Gherkin**: `e2e/scenarios/chain/chain-run-log.feature.md`: CHN-LOG-14, CHN-LOG-15, CHN-LOG-16, CHN-LOG-17, CHN-LOG-18, CHN-LOG-19, CHN-LOG-20
- **Depends on**: P2.2
- **Do**: Add scenarios CHN-LOG-14, CHN-LOG-15, CHN-LOG-16, CHN-LOG-17, CHN-LOG-18, CHN-LOG-19, CHN-LOG-20 to `e2e/qa/chain-e2e-runlog.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: api-text, api-assert-fail, api-inject-hdr, loop-ok, sub-parent-ok, cond-eq. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-runlog.spec.ts --grep "CHN-LOG-(14|15|16|17|18|19|20)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P2.4 Run log: delete, undo, clear (LOG-21..24)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-runlog.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-LOG-21, CHN-LOG-22, CHN-LOG-23a, CHN-LOG-23b, CHN-LOG-24
- **Gherkin**: `e2e/scenarios/chain/chain-run-log.feature.md`: CHN-LOG-21, CHN-LOG-22, CHN-LOG-23a, CHN-LOG-23b, CHN-LOG-24
- **Depends on**: P2.3
- **Do**: Add scenarios CHN-LOG-21, CHN-LOG-22, CHN-LOG-23a, CHN-LOG-23b, CHN-LOG-24 to `e2e/qa/chain-e2e-runlog.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: reuse polish-run-log, api-single. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. LOG-22 pins behaviour that CHN-BUG-14 (P4) may change; write desired behaviour (stays deleted after reload) and mark `test.fixme` with a note ONLY if it fails until P4.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-runlog.spec.ts --grep "CHN-LOG-(21|22|23|24)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P2.5 Run log: cancel, re-run, header status, dock (LOG-25..32)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-runlog.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-LOG-25, CHN-LOG-26, CHN-LOG-27, CHN-LOG-28, CHN-LOG-29a, CHN-LOG-29b, CHN-LOG-29c, CHN-LOG-30, CHN-LOG-31, CHN-LOG-32
- **Gherkin**: `e2e/scenarios/chain/chain-run-log.feature.md`: CHN-LOG-25, CHN-LOG-26, CHN-LOG-27, CHN-LOG-28, CHN-LOG-29a, CHN-LOG-29b, CHN-LOG-29c, CHN-LOG-30, CHN-LOG-31, CHN-LOG-32
- **Depends on**: P2.4
- **Do**: Add scenarios CHN-LOG-25, CHN-LOG-26, CHN-LOG-27, CHN-LOG-28, CHN-LOG-29a, CHN-LOG-29b, CHN-LOG-29c, CHN-LOG-30, CHN-LOG-31, CHN-LOG-32 to `e2e/qa/chain-e2e-runlog.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: api-slow, med-req3, polish-run-log deleted-anchor. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. Cancel tests use `/api/slow` (5s) only here; flake check at x5 for LOG-25/26/27.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-runlog.spec.ts --grep "CHN-LOG-(25|26|27|28|29|30|31|32)" --repeat-each=5`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P2.5a Run log: dock persistence, run select, virtualisation, cap, detail (LOG-33..39)
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-runlog.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `e2e/fixtures/chainE2eHelpers.ts`
- **Scenarios**: CHN-LOG-33a, CHN-LOG-33b, CHN-LOG-34, CHN-LOG-35a, CHN-LOG-35b, CHN-LOG-35c, CHN-LOG-35d, CHN-LOG-36, CHN-LOG-37, CHN-LOG-38, CHN-LOG-39
- **Gherkin**: `e2e/scenarios/chain/chain-run-log.feature.md`: CHN-LOG-33a, CHN-LOG-33b, CHN-LOG-34, CHN-LOG-35a, CHN-LOG-35b, CHN-LOG-35c, CHN-LOG-35d, CHN-LOG-36, CHN-LOG-37, CHN-LOG-38, CHN-LOG-39
- **Depends on**: P2.5
- **Do**: Add LOG-33..39. Seeds: loop-large (`/api/list-60`, 60 iterations exceeds VIRTUALIZE_THRESHOLD 50), api-single, api-inject-hdr, api-fail500, polish-run-log, med-req3. LOG-37 (MAX_RUNS_PER_CHAIN 50 pruning) is VERIFY: seed 50 runs through the run-history store seed format; if pruning is not enforced, STOP and ask. LOG-38 needs clipboard permissions via Playwright context. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
  - Items marked VERIFY in SPEC are first observed against the running app; assert the observed, source-confirmed behaviour. If it contradicts the SPEC row and looks like a defect, STOP and ask the user (AskUserQuestion) before changing behaviour.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-runlog.spec.ts --grep "CHN-LOG-(33|34|35|36|37|38|39)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P2.6 Checkpoint 2: run-log file
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P2.1, P2.2, P2.3, P2.4, P2.5, P2.5a
- **Do**: Flake and regression gate.
- **Acceptance**:
  - All commands below exit 0.
  - Flake check passes at the stated `--repeat-each` with zero retries-to-green.
  - Existing chain suite still green (no regression).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-runlog.spec.ts --repeat-each=3`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

🔶 **Checkpoint 2**: all Phase 2 tasks ✅, Verify commands green, no regression in the existing chain suite, human review if a bug decision was made.

## Phase 3: Medium combinations

40 CHN-M scenarios in chain-e2e-medium.spec.ts; seeds qa-e2e-med-*

### ✅ P3.1 Medium: request chaining and failure routing (M-01..06)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-medium.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-M-01, CHN-M-02, CHN-M-03, CHN-M-04a, CHN-M-04b, CHN-M-05, CHN-M-06
- **Gherkin**: `e2e/scenarios/chain/chain-medium.feature.md`: CHN-M-01, CHN-M-02, CHN-M-03, CHN-M-04a, CHN-M-04b, CHN-M-05, CHN-M-06
- **Depends on**: P2.6
- **Do**: Add scenarios CHN-M-01, CHN-M-02, CHN-M-03, CHN-M-04a, CHN-M-04b, CHN-M-05, CHN-M-06 to `e2e/qa/chain-e2e-medium.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: med-users-detail, med-tok-echo-multi, med-fail-then-echo, med-fail-handle, med-success-handle, med-partial. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-medium.spec.ts --grep "CHN-M-(01|02|03|04|05|06)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P3.2 Medium: Start/Delay/Condition combos (M-07..13)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-medium.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-M-07, CHN-M-08, CHN-M-09, CHN-M-10, CHN-M-11a, CHN-M-11b, CHN-M-11c, CHN-M-11d, CHN-M-12, CHN-M-13
- **Gherkin**: `e2e/scenarios/chain/chain-medium.feature.md`: CHN-M-07, CHN-M-08, CHN-M-09, CHN-M-10, CHN-M-11a, CHN-M-11b, CHN-M-11c, CHN-M-11d, CHN-M-12, CHN-M-13
- **Depends on**: P3.1
- **Do**: Add scenarios CHN-M-07, CHN-M-08, CHN-M-09, CHN-M-10, CHN-M-11a, CHN-M-11b, CHN-M-11c, CHN-M-11d, CHN-M-12, CHN-M-13 to `e2e/qa/chain-e2e-medium.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: med-start-req-cond, med-start-cond-override, med-req-delay-req, med-disp-cond, med-cond-multi, med-cond-parallel, med-cond-merge. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-medium.spec.ts --grep "CHN-M-(07|08|09|10|11|12|13)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P3.3 Medium: Display/Evaluate/Validate/Merge combos (M-14..20)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-medium.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-M-14, CHN-M-15, CHN-M-16, CHN-M-17, CHN-M-18a, CHN-M-18b, CHN-M-19, CHN-M-20
- **Gherkin**: `e2e/scenarios/chain/chain-medium.feature.md`: CHN-M-14, CHN-M-15, CHN-M-16, CHN-M-17, CHN-M-18a, CHN-M-18b, CHN-M-19, CHN-M-20
- **Depends on**: P3.2
- **Do**: Add scenarios CHN-M-14, CHN-M-15, CHN-M-16, CHN-M-17, CHN-M-18a, CHN-M-18b, CHN-M-19, CHN-M-20 to `e2e/qa/chain-e2e-medium.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: med-disp-req, med-disp-two, med-eval-req, med-eval-cond, med-val-gate-pass/-fail, med-merge-then-req, med-chain-of-3. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-medium.spec.ts --grep "CHN-M-(14|15|16|17|18|19|20)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P3.4 Medium: Loop and Subchain combos (M-21..27)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-medium.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-M-21, CHN-M-22, CHN-M-23, CHN-M-24, CHN-M-25, CHN-M-26, CHN-M-27
- **Gherkin**: `e2e/scenarios/chain/chain-medium.feature.md`: CHN-M-21, CHN-M-22, CHN-M-23, CHN-M-24, CHN-M-25, CHN-M-26, CHN-M-27
- **Depends on**: P3.3
- **Do**: Add scenarios CHN-M-21, CHN-M-22, CHN-M-23, CHN-M-24, CHN-M-25, CHN-M-26, CHN-M-27 to `e2e/qa/chain-e2e-medium.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: med-loop-then-req, med-loop-cond, med-loop-eval, med-loop-delay, med-sub-then-req, med-sub-loop, med-val-cond. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-medium.spec.ts --grep "CHN-M-(21|22|23|24|25|26|27)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P3.5 Medium: re-run subsets, cancel, edit-and-rerun (M-28..32)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-medium.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-M-28, CHN-M-29, CHN-M-30, CHN-M-31, CHN-M-32
- **Gherkin**: `e2e/scenarios/chain/chain-medium.feature.md`: CHN-M-28, CHN-M-29, CHN-M-30, CHN-M-31, CHN-M-32
- **Depends on**: P3.4
- **Do**: Add scenarios CHN-M-28, CHN-M-29, CHN-M-30, CHN-M-31, CHN-M-32 to `e2e/qa/chain-e2e-medium.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: med-req3, med-tok-echo, med-req-delay-req-long, reuse cond-eq. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. M-30 notes BUG-10; assert current documented behaviour only, do not change engine here.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-medium.spec.ts --grep "CHN-M-(28|29|30|31|32)" --repeat-each=5`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P3.5a Medium: cancel-then-rerun, reload persistence, renamed subchain (M-33..35)
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-medium.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `e2e/fixtures/chainE2eHelpers.ts`
- **Scenarios**: CHN-M-33, CHN-M-34, CHN-M-35
- **Gherkin**: `e2e/scenarios/chain/chain-medium.feature.md`: CHN-M-33, CHN-M-34, CHN-M-35
- **Depends on**: P3.5
- **Do**: Add M-33..35 with seeds med-start-delay-cond-merge, med-loop-reload, med-sub-rename. Use only `/api/medium` (1.5 s) or Delay for cancel timing. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
  - Items marked VERIFY in SPEC are first observed against the running app; assert the observed, source-confirmed behaviour. If it contradicts the SPEC row and looks like a defect, STOP and ask the user (AskUserQuestion) before changing behaviour.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-medium.spec.ts --grep "CHN-M-(33|34|35)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P3.6 Checkpoint 3: medium file
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P3.1, P3.2, P3.3, P3.4, P3.5, P3.5a
- **Do**: Flake gate; record total runtime of the file and flag tests over 20s.
- **Acceptance**:
  - All commands below exit 0.
  - Flake check passes at the stated `--repeat-each` with zero retries-to-green.
  - Existing chain suite still green (no regression).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-medium.spec.ts --repeat-each=3`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

🔶 **Checkpoint 3**: all Phase 3 tasks ✅, Verify commands green, no regression in the existing chain suite, human review if a bug decision was made.

## Phase 4: Bug verification and fixes

26 BUG scenarios (BUG-19 done in P0, so 25 here). Ambiguous items STOP and ask the user before any behaviour change

### ✅ P4.1 BUG-01: Condition >= / <= support (automatic fix)
- **Kind**: e2e
- **Files** (5): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `src/lib/chainControlFlow.ts`; `src/components/chain/panels/ConditionConfigPanel.tsx`
- **Scenarios**: CHN-BUG-01a, CHN-BUG-01b
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-01a, CHN-BUG-01b
- **Depends on**: P3.6
- **Do**: Write CHN-BUG-01 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-cond-gte). Per SPEC 12.2 this is a fix without asking: support `>=`/`<=` in the Condition evaluator under `src/lib/chainRunner/` (`src/lib/chainControlFlow.ts`), add the regression test; also asserts value 5 takes the branch for both operators. The evaluator is `testExpression` in `src/lib/chainControlFlow.ts` (called from `src/lib/chainRunner/executors/conditionExecutor.ts`); touch `ConditionConfigPanel.tsx` only if its operator list lacks `>=`/`<=`. Note: a unit spec `src/lib/chainControlFlow.spec.ts` already exists; do not add unit tests. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - If investigation shows the behaviour is ambiguous rather than clearly defective, STOP and ask the user before changing behaviour; write the test as `test.fixme` with the question until answered.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-01" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.2 BUG-03/04/05: Collect duplicate, Collect delete, clipboard types
- **Kind**: e2e
- **Files** (5): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `src/components/chain/canvas/hooks/useCanvasClipboard.ts`; `src/components/chain/canvas/hooks/useCanvasCommands.ts`
- **Scenarios**: CHN-BUG-03, CHN-BUG-04, CHN-BUG-05a, CHN-BUG-05b
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-03, CHN-BUG-04, CHN-BUG-05a, CHN-BUG-05b
- **Depends on**: P4.1
- **Do**: Write CHN-BUG-03, CHN-BUG-04, CHN-BUG-05 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-collect-dup, bug-collect-del, bug-clipboard). Clear defects first; fix with regression if desired behaviour fails. Source: `useCanvasClipboard.ts` (copy/paste/duplicate), `useCanvasCommands.ts` (delete/dup commands); supported-type list in `src/components/chain/blockRegistry.ts` and remap in `pasteRemap.ts` are read-only unless the defect lives there (then split the task). If the fix needs another source file, split this task first (max 5 files per task). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - If investigation shows the behaviour is ambiguous rather than clearly defective, STOP and ask the user before changing behaviour; write the test as `test.fixme` with the question until answered.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-(03|04|05)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.3 BUG-11/13/15: ghost placement, banner dismissal, duplicate Start
- **Kind**: e2e
- **Files** (5): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `src/app/chain/[collectionId]/ChainValidationBanners.tsx`; `src/components/chain/canvas/GhostPlacementHandler.tsx`
- **Scenarios**: CHN-BUG-11a, CHN-BUG-11b, CHN-BUG-13, CHN-BUG-15
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-11a, CHN-BUG-11b, CHN-BUG-13, CHN-BUG-15
- **Depends on**: P4.2
- **Do**: Write CHN-BUG-11, CHN-BUG-13, CHN-BUG-15 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-ghost, bug-banner, bug-start2). BUG-15 asserts the toast text and persistence after reload only (S-STR-09/10 cover the rest). Source: `ChainValidationBanners.tsx` (dismissal signature), `GhostPlacementHandler.tsx` (Esc/toolbar clicks); `hooks/useGhostPlacement.ts` only if needed. If the fix needs another source file, split this task first (max 5 files per task). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - If investigation shows the behaviour is ambiguous rather than clearly defective, STOP and ask the user before changing behaviour; write the test as `test.fixme` with the question until answered.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-(11|13|15)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.4 BUG-14/16/17: run-delete persistence, loop alias, filter fallback
- **Kind**: e2e
- **Files** (5): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `src/lib/chainValueNamespace.ts`; `src/lib/chainValueNamespace.spec.ts`
- **Scenarios**: CHN-BUG-14a, CHN-BUG-14b, CHN-BUG-16a, CHN-BUG-16b, CHN-BUG-17
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-14a, CHN-BUG-14b, CHN-BUG-16a, CHN-BUG-16b, CHN-BUG-17
- **Depends on**: P4.3
- **Do**: Write CHN-BUG-14, CHN-BUG-16, CHN-BUG-17 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-run-delete, bug-loop-alias). Coordinate with LOG-21/22 (P2.4): un-fixme LOG-22 here when BUG-14 passes. BUG-17 asserts no stale empty list (LOG-09 covers the tab state). Source: `useChainRunStore.ts` (pendingDeletes, `RUN_DELETE_UNDO_MS`), `chainRunHistory.ts` (persistence). BUG-16: the panel rejected `index` but accepted `1abc` (`LOOP_ALIAS_PATTERN` in `src/lib/chainValueNamespace.ts` allowed a leading digit); fixed there with a unit-spec row; BUG-17 fallback lives in `src/components/chain/run-log/RunFilterTabs.tsx`/`RunLogSplit.tsx`. If the fix needs another source file, split this task first (max 5 files per task). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - If investigation shows the behaviour is ambiguous rather than clearly defective, STOP and ask the user before changing behaviour; write the test as `test.fixme` with the question until answered.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-(14|16|17)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.4a BUG-18: shortcuts during a run and in editable targets
- **Kind**: e2e
- **Files** (2): `e2e/qa/chain-e2e-bugs.spec.ts`; `src/components/chain/canvas/ChainCanvasFlow.tsx`
- **Scenarios**: CHN-BUG-18a, CHN-BUG-18b
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-18a, CHN-BUG-18b
- **Depends on**: P4.4
- **Do**: Write CHN-BUG-18 in `e2e/qa/chain-e2e-bugs.spec.ts` (existing seeds qa-e2e-api-slow, qa-e2e-api-single). Split from P4.4 because the BUG-18a fix lives in `ChainCanvasFlow.tsx`: React Flow's built-in arrow-key move nudged a node while a run was in flight, so `nodesDraggable={!isRunning}` was added. Titles and Given/When/Then come verbatim from the Gherkin scenarios.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - If investigation shows the behaviour is ambiguous rather than clearly defective, STOP and ask the user before changing behaviour; write the test as `test.fixme` with the question until answered.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-18" --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.5 BUG-02: context menu vs Mod+D on Condition and Delay
- **Kind**: e2e
- **Files** (4): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`; `src/components/chain/blockRegistry.ts`
- **Scenarios**: CHN-BUG-02a, CHN-BUG-02b
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-02a, CHN-BUG-02b
- **Depends on**: P4.4a
- **Do**: Write CHN-BUG-02 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-dup-menu). Source candidates after the decision: `NodeContextMenu.tsx`, `useCanvasCommands.ts`, `useChainCanvasShortcuts.ts` (split if a third file is needed). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - The behaviour decision is recorded in SPEC section 12 item 7; no `test.fixme` is left behind.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Decision (resolved, SPEC section 12 item 7)**: Fix: `canDuplicate: true` for Condition and Delay in `blockRegistry.ts`, so the context menu offers Duplicate exactly where Mod+D works. Duplicates carry the same config and no edges.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-02" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.6 BUG-06: Loop passed with failing iterations (documented as intended)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-BUG-06
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-06
- **Depends on**: P4.5
- **Do**: Write CHN-BUG-06 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-loop-partial, may reuse loop-iter-fail). Source verified (Loop executor marks iteration failures as a warning with the loop passed; the code comment calls it a product decision), so no user question and no source change: assert the documented behaviour (loop passed, `loop-iterations-failed` warning on canvas and run log, failed iteration rows visible, chain status per engine rule). Distinct from S-LOP-10: this test also checks the Failed filter and chain status. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the documented behaviour from SPEC 5.5 / 12.6 and is green; no source change.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-06" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P4.7a BUG-07 source: forward loopDepth into Sub-chain runs
- **Kind**: implementation
- **Files** (3): `src/lib/chainRunner.ts`; `src/lib/chainRunner/executors/subchain.ts`; `src/lib/chainRunner/executors/subchain.spec.ts`
- **Depends on**: P4.6
- **Do**: Pass `env.opts.loopDepth ?? 0` from `runSubChainNode` to the subchain executor, and on to the nested `runChain`.
- **Acceptance**:
  - Source change is minimal, covered by the unit specs listed in Files, and `bunx tsc --noEmit -p .` is clean.
  - `ChainCanvas.spec.tsx` stays green.
- **Verify**:
  - `bun run test -- src/lib/chainRunner/executors/subchain.spec.ts`

### ✅ P4.7 BUG-07: Nested loops split across a subchain
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-BUG-07
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-07
- **Depends on**: P4.6
- **Do**: Write CHN-BUG-07 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-loop-depth). Source candidates after the decision: `nesting.ts` (MAX_LOOP_NESTING_DEPTH, loop depth calc), `executors/subchain.ts` (MAX_SUBCHAIN_DEPTH, child depth). Assert LOOP_DEPTH_EXCEEDED / SCHEDULER_DEPTH_EXCEEDED surface as a failed step or a banner. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - The behaviour decision is recorded in SPEC section 12 item 7; no `test.fixme` is left behind.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Decision (resolved, SPEC section 12 item 7)**: Fix: forward `loopDepth` across the Sub-chain boundary (see P4.7a) so the inner Loop fails with LOOP_DEPTH_EXCEEDED, surfaced on the Sub-chain step.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-07" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.8a BUG-08 source: extraction miss fails the step
- **Kind**: implementation
- **Files** (3): `src/lib/chainRunner/executors/apiExecutor.ts`; `src/lib/chainRunner/executors/apiExecutor.spec.ts`; `src/lib/chainRunner.spec.ts`
- **Depends on**: P4.7
- **Do**: In the extraction-miss branch call `onUpdate(nodeId, "failed", ...)` and set `runState[nodeId].state = "failed"`.
- **Acceptance**:
  - Source change is minimal, covered by the unit specs listed in Files, and `bunx tsc --noEmit -p .` is clean.
  - `ChainCanvas.spec.tsx` stays green.
- **Verify**:
  - `bun run test -- src/lib/chainRunner/executors/apiExecutor.spec.ts src/lib/chainRunner.spec.ts`

### ✅ P4.8 BUG-08: Bad JSONPath edge => skipped but run Passed
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-BUG-08
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-08
- **Depends on**: P4.7
- **Do**: Write CHN-BUG-08 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-bad-path). Source candidates: `apiExecutor.ts` (~line 168, extraction miss to skipped), `utils.ts` (`extractJsonPath`). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - The behaviour decision is recorded in SPEC section 12 item 7; no `test.fixme` is left behind.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Decision (resolved, SPEC section 12 item 7)**: Fix: an extraction miss marks the target step `failed` (not `skipped`), keeping `EXTRACTION_FAILED` / `ERROR_KIND.EXTRACTION`; the run ends Failed. Existing scenarios CHN-S-API-08 and CHN-LOG-05 were updated accordingly.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-08" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.9a BUG-09 source: detect multi-inbound Display and block the run
- **Kind**: implementation
- **Files** (5): `src/components/chain/canvas/hooks/chainConnectionRules.ts`; `src/components/chain/canvas/hooks/chainConnectionRules.spec.ts`; `src/app/chain/[collectionId]/useChainStructureValidation.ts`; `src/lib/chainRunBlock.ts`; `src/lib/chainRunBlock.spec.ts`
- **Depends on**: P4.8
- **Do**: Add `getMultiInboundDisplayIds`, expose `multiInboundDisplayIds`, add the `displayMultipleInputs` run-block reason.
- **Acceptance**:
  - Source change is minimal, covered by the unit specs listed in Files, and `bunx tsc --noEmit -p .` is clean.
  - `ChainCanvas.spec.tsx` stays green.
- **Verify**:
  - `bun run test -- src/components/chain/canvas/hooks/chainConnectionRules.spec.ts src/lib/chainRunBlock.spec.ts`

### ✅ P4.9b BUG-09 UI: banner and run-button reason
- **Kind**: implementation
- **Files** (5): `src/app/chain/[collectionId]/page.tsx`; `src/app/chain/[collectionId]/ChainPageHeader.tsx`; `src/components/chain/canvas/CanvasBanner.tsx`; `src/app/chain/[collectionId]/ChainValidationBanners.tsx`; `src/app/chain/[collectionId]/ChainValidationBanners.spec.tsx`
- **Depends on**: P4.9a
- **Do**: Wire `hasMultiInboundDisplay` into the run-block call, add the `display-multiple-inputs` banner and the header reason.
- **Acceptance**:
  - Source change is minimal, covered by the unit specs listed in Files, and `bunx tsc --noEmit -p .` is clean.
  - `ChainCanvas.spec.tsx` stays green.
- **Verify**:
  - `bun run test -- src/app/chain/[collectionId]/ChainValidationBanners.spec.tsx`

### ✅ P4.9c BUG-09 i18n: banner and run-block copy
- **Kind**: implementation
- **Files** (3): `messages/en/chain.json`; `messages/fr/chain.json`; `messages/ja/chain.json`
- **Depends on**: P4.9b
- **Do**: Add `displayMultipleInputsBannerMessage` and `resolveDisplayInputsToRun` in en/fr/ja.
- **Acceptance**:
  - Source change is minimal, covered by the unit specs listed in Files, and `bunx tsc --noEmit -p .` is clean.
  - `ChainCanvas.spec.tsx` stays green.
- **Verify**:
  - `bun run test -- src/i18n/chainMessages.parity.spec.ts`

### ✅ P4.9 BUG-09: Display with two inbound edges
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-BUG-09
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-09
- **Depends on**: P4.8
- **Do**: Write CHN-BUG-09 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-disp-2in). Source candidates: `displayExecutor.ts` (first inbound edge only), `runGraph.ts` (run gate). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - The behaviour decision is recorded in SPEC section 12 item 7; no `test.fixme` is left behind.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Decision (resolved, SPEC section 12 item 7)**: Fix: the validation banner blocks Run for a Display with more than one inbound edge (P4.9a to P4.9c). CHN-S-DSP-07 was rewritten to assert the block.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-09" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.10a BUG-10 source: warn on single-node runs with injected inbound edges
- **Kind**: implementation
- **Files** (3): `src/lib/chainRunner/runGraph.ts`; `src/lib/chainRunner/runGraph.spec.ts`; `src/hooks/useChainRun.ts`
- **Depends on**: P4.9
- **Do**: Add `countInjectedIncomingEdges` and show `toast.warning` from `handleRunSingleNode` when it is > 0.
- **Acceptance**:
  - Source change is minimal, covered by the unit specs listed in Files, and `bunx tsc --noEmit -p .` is clean.
  - `ChainCanvas.spec.tsx` stays green.
- **Verify**:
  - `bun run test -- src/lib/chainRunner/runGraph.spec.ts`

### ✅ P4.10b BUG-10 i18n: single-run warning copy
- **Kind**: implementation
- **Files** (3): `messages/en/chain.json`; `messages/fr/chain.json`; `messages/ja/chain.json`
- **Depends on**: P4.10a
- **Do**: Add `singleRunInjectionsIgnored` in en/fr/ja.
- **Acceptance**:
  - Source change is minimal, covered by the unit specs listed in Files, and `bunx tsc --noEmit -p .` is clean.
  - `ChainCanvas.spec.tsx` stays green.
- **Verify**:
  - `bun run test -- src/i18n/chainMessages.parity.spec.ts`

### ✅ P4.10 BUG-10: Single-node run on an injected edge
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-BUG-10
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-10
- **Depends on**: P4.9
- **Do**: Write CHN-BUG-10 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-single-inject). Source candidates: `runGraph.ts` (single-node trigger subset), `stepRecording.ts` (unresolved-variable warning on the step). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - The behaviour decision is recorded in SPEC section 12 item 7; no `test.fixme` is left behind.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Decision (resolved, SPEC section 12 item 7)**: Fix: `toast.warning` on a single-node run when incoming injection edges exist (P4.10a, P4.10b); the unresolved-variable warning on the step Input is unchanged.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-10" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.11 BUG-12: Merge any with slow in-flight lane
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-bugs.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-BUG-12
- **Gherkin**: `e2e/scenarios/chain/chain-bugs.feature.md`: CHN-BUG-12
- **Depends on**: P4.10
- **Do**: Write CHN-BUG-12 in `e2e/qa/chain-e2e-bugs.spec.ts` (seeds: qa-e2e-bug-merge-any-slow). Source candidates: `executors/merge.ts` (any/all resolve), `scheduler.ts` (aborting in-flight lanes). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Test asserts the DESIRED behaviour from SPEC 5.5 and is green; any source fix is minimal and listed in Files before editing (total <= 5 files).
  - The behaviour decision is recorded in SPEC section 12 item 7; no `test.fixme` is left behind.
  - Full existing chain suite re-run green after the fix.
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Decision (resolved, SPEC section 12 item 7)**: Document as intended: the in-flight lane ends `skipped`; canvas node, log row and summary counts (skipped 1, aborted 0) agree and the run is Passed. No source change.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --grep "CHN-BUG-12" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`  (regression after any source fix)

### ✅ P4.12 Checkpoint 4: bugs file and all-bug resolution
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P4.1, P4.2, P4.3, P4.4, P4.5, P4.6, P4.7, P4.8, P4.9, P4.10, P4.11
- **Do**: Every BUG item is resolved (fixed + regression, or documented). Any remaining `test.fixme` blocks Phase 7. Grep the file for `fixme` and confirm none remain.
- **Acceptance**:
  - All commands below exit 0.
  - Flake check passes at the stated `--repeat-each` with zero retries-to-green.
  - Existing chain suite still green (no regression).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-bugs.spec.ts --repeat-each=3`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `grep -c "test.fixme" e2e/qa/chain-e2e-bugs.spec.ts e2e/qa/chain-e2e-runlog.spec.ts`  (expect 0 in both)
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

🔶 **Checkpoint 4**: all Phase 4 tasks ✅, Verify commands green, no regression in the existing chain suite, human review if a bug decision was made.

## Phase 5: Complex flows

11 CHN-C scenarios in chain-e2e-complex.spec.ts; seeds qa-e2e-cx-*; C-06 and C-09 last

### ✅ P5.1 Complex: auth pipeline, fan-out/fan-in, partial loop failure (C-01..03)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-complex.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-C-01, CHN-C-02, CHN-C-03
- **Gherkin**: `e2e/scenarios/chain/chain-complex.feature.md`: CHN-C-01, CHN-C-02, CHN-C-03
- **Depends on**: P4.12
- **Do**: Add scenarios CHN-C-01, CHN-C-02, CHN-C-03 to `e2e/qa/chain-e2e-complex.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: cx-auth-pipeline, cx-fanout-merge, cx-loop-validate-partial. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. Also complete cx-01/cx-07 seeds referenced by LOG-11/12 (already stubbed in P2.2) so they stay in sync.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
  - Bar asserted Running -> final; filters, nested rows and counts checked; ends with `snap()`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-complex.spec.ts --grep "CHN-C-(01|02|03)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P5.2 Complex: nested loops/subchain, recovery, gauntlet, sub-compose (C-04,05,07,08)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-complex.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-C-04, CHN-C-05a, CHN-C-05b, CHN-C-07, CHN-C-08
- **Gherkin**: `e2e/scenarios/chain/chain-complex.feature.md`: CHN-C-04, CHN-C-05a, CHN-C-05b, CHN-C-07, CHN-C-08
- **Depends on**: P5.1
- **Do**: Add scenarios CHN-C-04, CHN-C-05a, CHN-C-05b, CHN-C-07, CHN-C-08 to `e2e/qa/chain-e2e-complex.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: cx-nested-loops-sub, cx-recovery, cx-gauntlet, cx-sub-compose. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. Depends on Phase 4 decisions for loop depth and extraction behaviour.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
  - Bar asserted Running -> final; filters, nested rows and counts checked.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-complex.spec.ts --grep "CHN-C-(04|05|07|08)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P5.3 Complex: undo/redo and structural edits around a run (C-10)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-complex.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-C-10
- **Gherkin**: `e2e/scenarios/chain/chain-complex.feature.md`: CHN-C-10
- **Depends on**: P5.2
- **Do**: Add scenarios CHN-C-10 to `e2e/qa/chain-e2e-complex.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: reuse cx-01. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-complex.spec.ts --grep "CHN-C-10" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P5.4 Complex: wide cancel stress (C-06)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-complex.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-C-06
- **Gherkin**: `e2e/scenarios/chain/chain-complex.feature.md`: CHN-C-06
- **Depends on**: P5.3
- **Do**: Add scenarios CHN-C-06 to `e2e/qa/chain-e2e-complex.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: cx-wide-cancel (Start + 4 slow lanes). Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. Most timing-sensitive: assert by lane/step index, not wall clock.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-complex.spec.ts --grep "CHN-C-06" --repeat-each=5`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P5.5 Complex: reload mid-history persistence (C-09)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-complex.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-C-09
- **Gherkin**: `e2e/scenarios/chain/chain-complex.feature.md`: CHN-C-09
- **Depends on**: P5.4
- **Do**: Add scenarios CHN-C-09 to `e2e/qa/chain-e2e-complex.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: reuse cx-02. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. Most persistence-sensitive; reload then assert restored run log and bar.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-complex.spec.ts --grep "CHN-C-09" --repeat-each=5`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P5.6 Checkpoint 5: complex file
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P5.1, P5.2, P5.3, P5.4, P5.5
- **Do**: Flake gate.
- **Acceptance**:
  - All commands below exit 0.
  - Flake check passes at the stated `--repeat-each` with zero retries-to-green.
  - Existing chain suite still green (no regression).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-complex.spec.ts --repeat-each=3`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

🔶 **Checkpoint 5**: all Phase 5 tasks ✅, Verify commands green, no regression in the existing chain suite, human review if a bug decision was made.

## Phase 6: Cross-cutting, docs, matrix audit, dedupe

6 CHN-X scenarios, Gherkin <-> test parity check, matrix audit, remove 4 overlapping tests

### ✅ P6.1 Cross-cutting: persistence and undo/redo of every block config (X-01, X-02)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-complex.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-X-01, CHN-X-02
- **Gherkin**: `e2e/scenarios/chain/chain-cross-cutting.feature.md`: CHN-X-01, CHN-X-02
- **Depends on**: P5.6
- **Do**: Add scenarios CHN-X-01, CHN-X-02 to `e2e/qa/chain-e2e-complex.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: reuse qa-polish-blocks. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. Reload after each config edit; assert canvas and log restored.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-complex.spec.ts --grep "CHN-X-(01|02)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P6.2 Cross-cutting: responsive, and remaining hardening (X-03..06)
- **Kind**: e2e
- **Files** (3): `e2e/qa/chain-e2e-complex.spec.ts`; `e2e/fixtures/seed/chain-e2e.json`; `e2e/fixtures/qa-seed.init.js (generated)`
- **Scenarios**: CHN-X-03, CHN-X-04, CHN-X-05, CHN-X-06
- **Gherkin**: `e2e/scenarios/chain/chain-cross-cutting.feature.md`: CHN-X-03, CHN-X-04, CHN-X-05, CHN-X-06
- **Depends on**: P6.1
- **Do**: Add scenarios CHN-X-03, CHN-X-04, CHN-X-05, CHN-X-06 to `e2e/qa/chain-e2e-complex.spec.ts` (create the file if absent). Seeds to add to `chain-e2e.json`: reuse existing seeds. Titles and Given/When/Then come verbatim from the Gherkin scenarios listed in the **Gherkin** field (source of truth); SPEC section 5 rows supply seed ids, selectors and assertion detail. If they disagree, fix the SPEC row first. X-03 runs the run log at 390px width. Read SPEC 5.6 for X-04/X-05 definitions. X-06 is marked VERIFY: first observe what the app renders for an unknown chain id (fallback title), assert exactly that with no console error, and ask the user if the observed behaviour looks like a defect.
- **Acceptance**:
  - Tests implement the Gherkin scenarios listed in **Gherkin** (feature file under `e2e/scenarios/chain/` is the source of truth): one `test()` per scenario ID, title prefixed with the ID in brackets (e.g. `[CHN-S-API-01] ...`, so `--grep <ID>` selects it); Given = arrange (seed/open), When = act, Then = assert; tagged `@qa`; uses `seededPage` + `installChainRoutes`.
  - Every test asserts the canvas (badge/error strip/banner/footer) AND the run log (step state, error line, tab content, counts or bar) via the shared helpers.
  - No `waitForTimeout`, no console-guard bypass beyond the single 599 allowlist; `getByTestId` first, web-first assertions or `expect.poll`.
  - New seeds use ids `qa-e2e-*`, `scope:"standalone"`, `schemaVersion:5`; `bun run qa:seed:build` clean; `qa-seed.init.js` never hand-edited.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-complex.spec.ts --grep "CHN-X-(03|04|05|06)" --repeat-each=2`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

### ✅ P6.3 Gherkin <-> test parity check
- **Kind**: dod
- **Files** (1): `e2e/scenarios/chain/check-parity.sh`
- **Scenarios**: none
- **Gherkin**: all 285 scenarios in `e2e/scenarios/chain/*.feature.md` (parity check, implements no scenario itself)
- **Depends on**: P6.2
- **Do**: Add `e2e/scenarios/chain/check-parity.sh`, sibling of `check-ids.sh`. It extracts every `## Scenario: [ID]` from the Gherkin files and every Playwright test title starting with `[ID]` from `e2e/qa/chain-e2e-*.spec.ts` plus `e2e/qa/chaining-ui-overhaul.spec.ts` (home of the `[CHN-BUG-19]` CANVAS-18 test only), then fails on: a Gherkin ID with no test, a Gherkin ID with more than one test, or a test ID with no Gherkin scenario. Fix mismatches in the tests (Gherkin is the source of truth); if a scenario itself is wrong, edit the Gherkin and SPEC row together and re-run `check-ids.sh`.
- **Acceptance**:
  - Script exits 0 and prints the counts: 285 Gherkin IDs, 285 test IDs, 0 missing, 0 duplicated, 0 unknown.
  - Every test title in the new specs is `[<ID>] <name>`; no test is untagged by an ID.
  - `check-ids.sh` still reports SPEC IDs == Gherkin IDs.
- **Verify**:
  - `bash e2e/scenarios/chain/check-parity.sh`  (expect exit 0)
  - `bash e2e/scenarios/chain/check-ids.sh`  (expect "OK: ID sets match")

### ✅ P6.4 Matrix audit against SPEC section 4
- **Kind**: dod
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P6.3
- **Do**: Check each cell of the SPEC 4 coverage matrix maps to a passing test; fix gaps by adding to existing task files only after asking if a scenario ID is missing.
- **Acceptance**:
  - No empty matrix cell.
  - All 11 node types have H, C, E, X scenarios asserted on canvas and log.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-*.spec.ts --list | tail -1`  (expect 285 tests in total, before the 4 existing-test removals which are outside these files)
  - `bash e2e/scenarios/chain/check-parity.sh`  (expect exit 0)

### ✅ P6.5 Remove 4 overlapping existing tests (SPEC 12.5)
- **Kind**: implementation
- **Files** (1): `e2e/chain.spec.ts`
- **Scenarios**: none
- **Gherkin**: none (supporting task, implements no scenario ID)
- **Depends on**: P6.4
- **Do**: Locate by title (line numbers shifted): CS:2605 Start override, CS:2757 Evaluate flow, CS:3217 3-item loop, CS:3125 parallel. Remove only after their new overlapping copies are green. Record the four removed titles in this task. Ask the user first if any title does not clearly match.
- **Removed** (from `e2e/chain.spec.ts`; each maps to the SPEC 12.5 overlap list, coverage retained by the listed test):
  1. "A Start input override reaches a downstream request header" (CS:2605) -> `e2e/qa/chaining-ui-overhaul.spec.ts` "Start input override reaches a downstream request header" (UO:409)
  2. "Evaluate node result is injected into a downstream request header" (CS:2757) -> `e2e/qa/chaining-ui-overhaul.spec.ts` "Evaluate result flows into a header" (UO:454)
  3. "Loop over three items shows three iterations" (CS:3217) -> `e2e/qa/chaining-ui-overhaul.spec.ts` "A 3-item loop shows 3 iterations" (UO:518)
  4. "Two independent branches both run, concurrently rather than sequentially" (CS:3125) -> `e2e/qa/parallel-merge.spec.ts` "Two independent branches run concurrently, showing distinct lanes at concurrency 4" (PM:16)
- **Acceptance**:
  - Exactly 4 tests removed; titles recorded.
  - Overlapping new tests green; rest of chain.spec.ts untouched.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts --list | tail -1`  (count drops by 4)
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-*.spec.ts`

### ✅ P6.6 Checkpoint 6
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P6.1, P6.2, P6.3, P6.4, P6.5
- **Do**: Flake gate for the cross-cutting additions.
- **Acceptance**:
  - All commands below exit 0.
  - Flake check passes at the stated `--repeat-each` with zero retries-to-green.
  - Existing chain suite still green (no regression).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-complex.spec.ts --repeat-each=3`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`

🔶 **Checkpoint 6**: all Phase 6 tasks ✅, Verify commands green, no regression in the existing chain suite, human review if a bug decision was made.

## Phase 7: Full-suite green gate

static checks, walkthrough, final gate

### ✅ P7.1 Static checks and seed drift (run only now)
- **Kind**: dod
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P6.6
- **Do**: Run lint and typecheck once, now (not earlier). Fix findings in the files introduced by this work only.
- **Acceptance**:
  - `bun run lint:check` and `bunx tsc --noEmit` exit 0.
  - Seed build is idempotent (md5 of `qa-seed.init.js` identical before and after `bun run qa:seed:build`); drift spec green.
  - No `waitForTimeout` or `npm` anywhere in new files.
- **Verify**:
  - `bun run lint:check`
  - `bunx tsc --noEmit`
  - `md5 -q e2e/fixtures/qa-seed.init.js; bun run qa:seed:build; md5 -q e2e/fixtures/qa-seed.init.js`  (both hashes identical)
  - `bun test src/lib/qaSeedSchema.spec.ts`
  - `grep -rn "waitForTimeout" e2e/qa/chain-e2e-*.spec.ts e2e/fixtures/chainE2eHelpers.ts`  (expect no output)

### ✅ P7.2 Walkthrough: manual verification list
- **Kind**: walkthrough
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P7.1
- **Do**: Produce the final Implementation Summary with Verification Steps based on the acceptance criteria. Evidence is the seeded QA specs only; agent-browser is never evidence. Deliverable: `agent_docs/chain-e2e/IMPLEMENTATION-SUMMARY.md`.
- **Acceptance**:
  - Summary lists per-phase results and decisions made on ambiguous bugs.
  - Each verification step names a runnable `bunx playwright test` command.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-*.spec.ts --repeat-each=2`

### ✅ P7.3 Final gate: full chain suite green
- **Kind**: gate
- **Files** (0): none (verification only)
- **Scenarios**: none
- **Gherkin**: none (verification only)
- **Depends on**: P7.2
- **Do**: Run the whole chain suite once with default repeats and the new files at --repeat-each=3. Fix flakes at root cause; never retry until green.
- **Acceptance**:
  - Full chain suite green: chain.spec.ts, chaining-ui-overhaul, parallel-merge, all chain-e2e-* specs.
  - New files stable at --repeat-each=3.
  - No `test.fixme`/`test.skip` left in chain-e2e-* files.
  - Total runtime recorded; tests over 20s flagged (recorded in `agent_docs/chain-e2e/IMPLEMENTATION-SUMMARY.md`, section Gate evidence).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-*.spec.ts --repeat-each=3`
  - `bun run qa:seed:build && bun test src/lib/qaSeedSchema.spec.ts`
  - `bash e2e/scenarios/chain/check-parity.sh`  (expect exit 0)
  - `grep -rnE "test\.(fixme|skip)" e2e/qa/chain-e2e-*.spec.ts`  (expect no output)

🔶 **Checkpoint 7**: all Phase 7 tasks ✅, Verify commands green, no regression in the existing chain suite, human review if a bug decision was made.

## Traceability (scenario ID -> task)

| Scenario ID | Task |
|---|---|
| CHN-BUG-01a | P4.1 |
| CHN-BUG-01b | P4.1 |
| CHN-BUG-02a | P4.5 |
| CHN-BUG-02b | P4.5 |
| CHN-BUG-03 | P4.2 |
| CHN-BUG-04 | P4.2 |
| CHN-BUG-05a | P4.2 |
| CHN-BUG-05b | P4.2 |
| CHN-BUG-06 | P4.6 |
| CHN-BUG-07 | P4.7 |
| CHN-BUG-08 | P4.8 |
| CHN-BUG-09 | P4.9 |
| CHN-BUG-10 | P4.10 |
| CHN-BUG-11a | P4.3 |
| CHN-BUG-11b | P4.3 |
| CHN-BUG-12 | P4.11 |
| CHN-BUG-13 | P4.3 |
| CHN-BUG-14a | P4.4 |
| CHN-BUG-14b | P4.4 |
| CHN-BUG-15 | P4.3 |
| CHN-BUG-16a | P4.4 |
| CHN-BUG-16b | P4.4 |
| CHN-BUG-17 | P4.4 |
| CHN-BUG-18a | P4.4 |
| CHN-BUG-18b | P4.4 |
| CHN-BUG-19 | P0.6 |
| CHN-C-01 | P5.1 |
| CHN-C-02 | P5.1 |
| CHN-C-03 | P5.1 |
| CHN-C-04 | P5.2 |
| CHN-C-05a | P5.2 |
| CHN-C-05b | P5.2 |
| CHN-C-06 | P5.4 |
| CHN-C-07 | P5.2 |
| CHN-C-08 | P5.2 |
| CHN-C-09 | P5.5 |
| CHN-C-10 | P5.3 |
| CHN-CV-01 | P1.13b |
| CHN-CV-02 | P1.13b |
| CHN-CV-03 | P1.13b |
| CHN-CV-04 | P1.13b |
| CHN-CV-05 | P1.13b |
| CHN-CV-06 | P1.13b |
| CHN-CV-07 | P1.13b |
| CHN-GR-01 | P1.13b |
| CHN-GR-02 | P1.13b |
| CHN-GR-03 | P1.13b |
| CHN-GR-04 | P1.13b |
| CHN-GR-05 | P1.13b |
| CHN-GR-06 | P1.13b |
| CHN-GR-07 | P1.13b |
| CHN-GR-08 | P1.13b |
| CHN-LOG-01 | P2.1 |
| CHN-LOG-02 | P2.1 |
| CHN-LOG-03 | P2.1 |
| CHN-LOG-04 | P2.1 |
| CHN-LOG-05 | P2.1 |
| CHN-LOG-06 | P2.1 |
| CHN-LOG-07 | P2.2 |
| CHN-LOG-08 | P2.2 |
| CHN-LOG-09 | P2.2 |
| CHN-LOG-10 | P2.2 |
| CHN-LOG-11 | P2.2 |
| CHN-LOG-12a | P2.2 |
| CHN-LOG-12b | P2.2 |
| CHN-LOG-13 | P2.2 |
| CHN-LOG-14 | P2.3 |
| CHN-LOG-15 | P2.3 |
| CHN-LOG-16 | P2.3 |
| CHN-LOG-17 | P2.3 |
| CHN-LOG-18 | P2.3 |
| CHN-LOG-19 | P2.3 |
| CHN-LOG-20 | P2.3 |
| CHN-LOG-21 | P2.4 |
| CHN-LOG-22 | P2.4 |
| CHN-LOG-23a | P2.4 |
| CHN-LOG-23b | P2.4 |
| CHN-LOG-24 | P2.4 |
| CHN-LOG-25 | P2.5 |
| CHN-LOG-26 | P2.5 |
| CHN-LOG-27 | P2.5 |
| CHN-LOG-28 | P2.5 |
| CHN-LOG-29a | P2.5 |
| CHN-LOG-29b | P2.5 |
| CHN-LOG-29c | P2.5 |
| CHN-LOG-30 | P2.5 |
| CHN-LOG-31 | P2.5 |
| CHN-LOG-32 | P2.5 |
| CHN-LOG-33a | P2.5a |
| CHN-LOG-33b | P2.5a |
| CHN-LOG-34 | P2.5a |
| CHN-LOG-35a | P2.5a |
| CHN-LOG-35b | P2.5a |
| CHN-LOG-35c | P2.5a |
| CHN-LOG-35d | P2.5a |
| CHN-LOG-36 | P2.5a |
| CHN-LOG-37 | P2.5a |
| CHN-LOG-38 | P2.5a |
| CHN-LOG-39 | P2.5a |
| CHN-M-01 | P3.1 |
| CHN-M-02 | P3.1 |
| CHN-M-03 | P3.1 |
| CHN-M-04a | P3.1 |
| CHN-M-04b | P3.1 |
| CHN-M-05 | P3.1 |
| CHN-M-06 | P3.1 |
| CHN-M-07 | P3.2 |
| CHN-M-08 | P3.2 |
| CHN-M-09 | P3.2 |
| CHN-M-10 | P3.2 |
| CHN-M-11a | P3.2 |
| CHN-M-11b | P3.2 |
| CHN-M-11c | P3.2 |
| CHN-M-11d | P3.2 |
| CHN-M-12 | P3.2 |
| CHN-M-13 | P3.2 |
| CHN-M-14 | P3.3 |
| CHN-M-15 | P3.3 |
| CHN-M-16 | P3.3 |
| CHN-M-17 | P3.3 |
| CHN-M-18a | P3.3 |
| CHN-M-18b | P3.3 |
| CHN-M-19 | P3.3 |
| CHN-M-20 | P3.3 |
| CHN-M-21 | P3.4 |
| CHN-M-22 | P3.4 |
| CHN-M-23 | P3.4 |
| CHN-M-24 | P3.4 |
| CHN-M-25 | P3.4 |
| CHN-M-26 | P3.4 |
| CHN-M-27 | P3.4 |
| CHN-M-28 | P3.5 |
| CHN-M-29 | P3.5 |
| CHN-M-30 | P3.5 |
| CHN-M-31 | P3.5 |
| CHN-M-32 | P3.5 |
| CHN-M-33 | P3.5a |
| CHN-M-34 | P3.5a |
| CHN-M-35 | P3.5a |
| CHN-S-API-01 | P0.5 |
| CHN-S-API-02 | P1.1 |
| CHN-S-API-03 | P1.1 |
| CHN-S-API-04 | P1.1 |
| CHN-S-API-05a | P1.1 |
| CHN-S-API-05b | P1.1 |
| CHN-S-API-06a | P1.1 |
| CHN-S-API-06b | P1.1 |
| CHN-S-API-07a | P1.1 |
| CHN-S-API-07b | P1.1 |
| CHN-S-API-08 | P1.1 |
| CHN-S-API-09 | P1.1 |
| CHN-S-API-10 | P1.1 |
| CHN-S-API-11 | P1.1 |
| CHN-S-API-12 | P1.1 |
| CHN-S-API-13 | P1.1 |
| CHN-S-API-14 | P1.3a |
| CHN-S-API-15a | P1.3a |
| CHN-S-API-15b | P1.3a |
| CHN-S-API-16 | P1.3a |
| CHN-S-API-17 | P1.3a |
| CHN-S-API-18a | P1.3a |
| CHN-S-API-18b | P1.3a |
| CHN-S-API-19 | P1.3a |
| CHN-S-API-20 | P1.3a |
| CHN-S-API-21 | P1.3a |
| CHN-S-API-22 | P1.3a |
| CHN-S-CND-01 | P1.5 |
| CHN-S-CND-02 | P1.5 |
| CHN-S-CND-03 | P1.5 |
| CHN-S-CND-04 | P1.5 |
| CHN-S-CND-05 | P1.5 |
| CHN-S-CND-06 | P1.5 |
| CHN-S-CND-07 | P1.5 |
| CHN-S-CND-08 | P1.5 |
| CHN-S-CND-09 | P1.5 |
| CHN-S-CND-10 | P1.5 |
| CHN-S-CND-11a | P1.8a |
| CHN-S-CND-11b | P1.8a |
| CHN-S-CND-12 | P1.8a |
| CHN-S-CND-13 | P1.8a |
| CHN-S-COL-01 | P1.12 |
| CHN-S-COL-02 | P1.12 |
| CHN-S-COL-03 | P1.12 |
| CHN-S-COL-04 | P1.12 |
| CHN-S-COL-05 | P1.12 |
| CHN-S-COL-06a | P1.13a |
| CHN-S-COL-06b | P1.13a |
| CHN-S-DLY-01 | P1.3 |
| CHN-S-DLY-02 | P1.3 |
| CHN-S-DLY-03a | P1.3 |
| CHN-S-DLY-03b | P1.3 |
| CHN-S-DLY-04 | P1.3 |
| CHN-S-DLY-05 | P1.3 |
| CHN-S-DLY-06 | P1.3 |
| CHN-S-DSP-01 | P1.6 |
| CHN-S-DSP-02 | P1.6 |
| CHN-S-DSP-03 | P1.6 |
| CHN-S-DSP-04 | P1.6 |
| CHN-S-DSP-05 | P1.6 |
| CHN-S-DSP-06 | P1.6 |
| CHN-S-DSP-07 | P1.6 |
| CHN-S-DSP-08 | P1.6 |
| CHN-S-DSP-09 | P1.6 |
| CHN-S-DSP-10 | P1.6 |
| CHN-S-DSP-11 | P1.8a |
| CHN-S-DSP-12 | P1.8a |
| CHN-S-EVL-01 | P1.7 |
| CHN-S-EVL-02 | P1.7 |
| CHN-S-EVL-03 | P1.7 |
| CHN-S-EVL-04a | P1.7 |
| CHN-S-EVL-04b | P1.7 |
| CHN-S-EVL-05 | P1.7 |
| CHN-S-EVL-06 | P1.7 |
| CHN-S-EVL-07 | P1.7 |
| CHN-S-EVL-08 | P1.7 |
| CHN-S-EVL-09 | P1.7 |
| CHN-S-EVL-10 | P1.8a |
| CHN-S-EVL-11 | P1.8a |
| CHN-S-LOP-01 | P1.11 |
| CHN-S-LOP-02 | P1.11 |
| CHN-S-LOP-03 | P1.11 |
| CHN-S-LOP-04 | P1.11 |
| CHN-S-LOP-05 | P1.11 |
| CHN-S-LOP-06 | P1.11 |
| CHN-S-LOP-07a | P1.11 |
| CHN-S-LOP-07b | P1.11 |
| CHN-S-LOP-08 | P1.11 |
| CHN-S-LOP-09a | P1.11 |
| CHN-S-LOP-09b | P1.11 |
| CHN-S-LOP-10 | P1.11 |
| CHN-S-LOP-11 | P1.11 |
| CHN-S-LOP-12 | P1.11 |
| CHN-S-LOP-13 | P1.13a |
| CHN-S-LOP-14 | P1.13a |
| CHN-S-LOP-15 | P1.13a |
| CHN-S-LOP-16 | P1.13a |
| CHN-S-LOP-17 | P1.13a |
| CHN-S-MRG-01 | P1.10 |
| CHN-S-MRG-02 | P1.10 |
| CHN-S-MRG-03 | P1.10 |
| CHN-S-MRG-04 | P1.10 |
| CHN-S-MRG-05 | P1.10 |
| CHN-S-MRG-06 | P1.10 |
| CHN-S-MRG-07 | P1.10 |
| CHN-S-MRG-08 | P1.13a |
| CHN-S-STR-01 | P1.2 |
| CHN-S-STR-02 | P1.2 |
| CHN-S-STR-03 | P1.2 |
| CHN-S-STR-04 | P1.2 |
| CHN-S-STR-05a | P1.2 |
| CHN-S-STR-05b | P1.2 |
| CHN-S-STR-06 | P1.2 |
| CHN-S-STR-07a | P1.2 |
| CHN-S-STR-07b | P1.2 |
| CHN-S-STR-08 | P1.2 |
| CHN-S-STR-09 | P1.2 |
| CHN-S-STR-10 | P1.2 |
| CHN-S-STR-11 | P1.3a |
| CHN-S-SUB-01 | P1.13 |
| CHN-S-SUB-02 | P1.13 |
| CHN-S-SUB-03 | P1.13 |
| CHN-S-SUB-04 | P1.13 |
| CHN-S-SUB-05 | P1.13 |
| CHN-S-SUB-06 | P1.13 |
| CHN-S-SUB-07 | P1.13 |
| CHN-S-SUB-08 | P1.13 |
| CHN-S-SUB-09 | P1.13a |
| CHN-S-SUB-10 | P1.13a |
| CHN-S-SUB-11 | P1.13a |
| CHN-S-VAL-01 | P1.8 |
| CHN-S-VAL-02 | P1.8 |
| CHN-S-VAL-03 | P1.8 |
| CHN-S-VAL-04 | P1.8 |
| CHN-S-VAL-05 | P1.8 |
| CHN-S-VAL-06 | P1.8 |
| CHN-S-VAL-07 | P1.8 |
| CHN-S-VAL-08a | P1.8 |
| CHN-S-VAL-08b | P1.8 |
| CHN-S-VAL-09 | P1.8a |
| CHN-X-01 | P6.1 |
| CHN-X-02 | P6.1 |
| CHN-X-03 | P6.2 |
| CHN-X-04 | P6.2 |
| CHN-X-05 | P6.2 |
| CHN-X-06 | P6.2 |

Check: Gherkin defines 285 unique scenario IDs ({'BUG': 26, 'C': 11, 'CV': 7, 'GR': 8, 'LOG': 47, 'M': 40, 'S': 140, 'X': 6}); SPEC defines the same set; table maps 285, each ID appears exactly once; unmapped: 0; unknown: 0. `e2e/scenarios/chain/check-ids.sh` enforces SPEC == Gherkin; P6.3 enforces Gherkin == tests.

Totals: 67 tasks across 8 phases.

Next step: run /build-phases agent_docs/chain-e2e/TASKS.md
