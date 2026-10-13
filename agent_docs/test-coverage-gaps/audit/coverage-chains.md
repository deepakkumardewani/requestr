# Chains coverage audit (read-only)

## 1) Files inspected
- Runner: src/lib/chainRunner.ts, chainRunner/{scheduler,schedulerQueue,schedulerLanes,schedulerGraph,runGraph,loopBody,nesting,stepRecording,utils,errorCodes,types}.ts, chainRunner/executors/{api,condition,delay,display,evaluate,validate,merge,start,loop,subchain,index}.ts, chainControlFlow.ts, chainEval*.ts
- Concurrency chain: src/stores/useUIStore.ts, components/settings/GeneralSection.tsx, app/settings/SettingsPageClient.tsx, hooks/useChainRun.ts, hooks/useHydrateChainPreferences.ts, lib/chainConstants.ts
- UI: components/chain/** (blockRegistry, ChainList, MigrationRecovery, canvas, dialogs/picker, nodes, panels, run-log), app/chain/[collectionId]/*, stores useChainStore/useChainRunStore/chainHistory, layout/SidebarMainTab
- Specs: ~58 vitest files in chain areas (920 tests, all passing when run); e2e/chain.spec.ts (66), e2e/qa/chain-e2e-*.spec.ts (276 tests incl. param loops), chaining-ui-overhaul.spec.ts (123), parallel-merge.spec.ts (5); scenarios e2e/scenarios/chain/*.feature.md (285 IDs) + chain.feature.md; check-ids.sh, check-parity.sh

Block types (from executors index + loop/subchain): api, start, delay, condition, display, evaluate, validate, merge, loop (+collect), subchain.

## 2) Coverage matrix
| Behavior | Unit | E2E | Notes |
|---|---|---|---|
| Create standalone chain | useChainStore.spec "createChain generates an id..."; ensureCollectionChain | chain.spec "Create a standalone chain via the Create New dropdown" | OK |
| Rename chain | useChainStore.spec "renameChain updates..." | chain.spec "Rename a standalone chain from the sidebar" | No validation cases (empty/duplicate name) at either level |
| Duplicate whole chain | none (no feature found; only node duplicate) | none | Not implemented; confirm intended |
| Delete chain | ChainList.spec confirm/cancel; store "deleteChain purges run history / drops undo" | chain.spec "Delete a standalone chain"; "Deleting a chain removes its persisted runs" | Good |
| List in sidebar | ChainList.spec lists names/empty; SidebarMainTab.spec renders section (ChainList mocked) | covered by create/rename/delete | OK |
| Search chains in sidebar | none located | none | SidebarSearch references chains; unverified, treat as gap |
| Add API node (picker) | picker specs in dialogs/picker; store addRequestNodes specs | chain.spec picker tests, PICKER-1..24 | Heavily covered |
| Add blocks (block menu) | BlockMenu.spec, blockRegistry.spec | chain.spec per-block adds; CHN-S-* | Good |
| Connect / self-connection / rules | chainConnectionRules.spec | CANVAS-20, CHN-BUG | Good |
| Delete node / edge, clear edges/nodes, undo/redo | store specs (removeNode cascade, clearNodes/Edges, temporal.spec undo/redo) | chain.spec Cmd+Z tests, CANVAS-3/4/5 | Good |
| Copy/paste, duplicate, align, nudge, find, auto-layout | useCanvasClipboard/useAlignSelection/useAutoLayout/useCanvasCommands specs | chain.spec copy/paste, align, find; overhaul CANVAS-14..21 | Good |
| Start node + inputs | executors/start.spec; StartInputRow has NO spec | chain.spec Start tests; CHN-S-START | StartInputRow UI untested at unit level |
| Request (api) node | apiExecutor.spec | CHN-S-API-* (47) | OK |
| Delay | delayExecutor.spec (abort too) | CHN-S-API delay scenarios | OK |
| Condition (logic) | conditionExecutor.spec; chainControlFlow.spec | chain-e2e-simple-logic (48) | OK |
| Display / Evaluate / Validate | displayExecutor, evaluate, validate specs; chainEval* specs (incl lockdown, worker) | chain-e2e-simple-flow / logic | OK; evaluate timeout code exists (EVALUATE_TIMEOUT) |
| Merge (all/any) | merge.spec, chainRunnerMergeLoop.spec, chainRunner.spec Merge describe | parallel-merge.spec (3 merge tests) | Good |
| Loop / Collect | loop.spec (557 lines), loopBody.spec | CHN-M-*, chain-e2e-medium; overhaul "3-item loop" | Good; CHN-BUG-04 covers Collect unpairing |
| Sub-chain | subchain.spec, nesting.spec | chain.spec nested sub-chain run log; chain-e2e-complex | Good |
| Variable extraction/passing (edges, aliases) | stepInputs.spec, utils.spec, chainValueNamespace.spec, chainAssertions.spec, ArrowConfig panel specs (ArrowConfigPanelBody + InjectionPreviewList no spec) | chain.spec "Mapping data across an edge", "literal {{alias}}", env var tests | Good runtime; arrow-config body UI only e2e |
| Run / stop / abort | chainRunner.spec, chainRunnerAbort.spec, useChainRun.spec | chain.spec "Stop cancels a slow run"; overhaul Stop | chainRunnerAbort.spec has only 1 test (pre-start abort); mid-run abort covered in chainRunner.spec/MergeLoop |
| Failed node handling | chainRunner.spec "throwing executor ... orphan siblings"; errorCodes.spec | chain.spec "Failing node shows error strip"; CHN-BUG | Good |
| Cycles | chainRunner.spec CircularDependencyError; utils.spec cycle ids; useChainCycle NO spec; ChainValidationBanners.spec | CHN scenarios (banner) | useChainCycle.ts untested directly |
| Timeouts | Only evaluate timeout (errorCodes) + delay | none | No request timeout in chain runner (apiExecutor passes signal only); no timeout test |
| Concurrency limit honored | chainRunner.spec "scheduler concurrency limits (CR-034)": conc=1 max one in flight, throttles N to limit, conc 3/4 throwing lane; P2.14 ordering fixture | parallel-merge ("lanes at concurrency 4", "Setting concurrency to 1"), CHN-S-API-07a/b | See wiring below |
| Concurrency setting wiring | useUIStore.spec (default 4, persist, clamp 1/8, round); useChainRun.spec "handleRun passes the store's chainConcurrency ... and reacts to changes"; GeneralSection.spec (label+value 4 only) | setConcurrency helper in complex/api specs types into chain-concurrency-input then runs; parallel-merge seeds localStorage | Wired end to end, but see gaps |
| Run log | run-log specs (many), chainRunHistory.spec, useChainRunStore.spec | CHN-LOG-* (47), RUNLOG-1..28 | Excellent; NestedSteps/StepWarnings/RunCardMenu have no direct spec |
| Persistence | store debounce/flush specs, useFlushChainOnLeave.spec, idb | run log reload tests, snap persist | Good |
| Migration (v5) | chainMigration.spec; store hydrate migration tests | overhaul "Legacy chain migrates", "Legacy standalone chain migrates" | Good |
| Migration recovery UI | MigrationRecovery.spec (3 tests), page.spec | none (error path not forced in e2e) | Gap |

## 3) Missing unit tests
High
- src/lib/chainRunner/scheduler.ts, schedulerQueue.ts, schedulerLanes.ts: no direct specs (only indirect via chainRunner.spec; schedulerGraph has one). Add: dispatchReady honors limit and drops already-recorded nodes; drain stops dispatch after abort; lane assignment reuse/release; concurrency 0/negative/NaN/non-integer passed straight to runChain (runChain does `concurrency = DEFAULT` only for undefined; 0 would deadlock or run nothing, no guard in runner, only UI clamp).
- src/components/settings/GeneralSection.tsx: the input onChange (finite parse, ignore NaN/empty, min/max attrs) untested; spec has 1 test only.
- src/hooks/useHydrateChainPreferences.ts: hydrate-after-mount of persisted concurrency untested (no spec).
Medium
- src/app/chain/[collectionId]/useChainCycle.ts (no spec): returns NO_CYCLE, picks edge on cycle.
- src/components/chain/panels/arrow-config/ArrowConfigPanelBody.tsx (368 lines) and ArrowConfigInjectionPreviewList.tsx: no specs.
- src/components/chain/canvas/hooks/chainNodeBuilders.ts (408 lines), blockNodeFactory.ts, ChainCanvasFlow.tsx, ChainCanvasPanels.tsx (440, only configure/evaluate partial specs).
- src/components/chain/run-log/NestedSteps.tsx, StepWarnings.tsx, RunCardMenu.tsx.
- src/components/chain/nodes/useNodeToolbarActions.ts, panels/StartInputRow.tsx, AliasCollisionWarning.tsx.
- chainRunnerAbort.spec: abort mid-flight at concurrency>1 for every executor type, abort during Loop/Subchain.
Low
- src/lib/chainRunner/types.ts, executors/index.ts (dispatch table), lib/chainConstants.ts, lib/dev/chainFixturesWindow.ts, ChainDevProvider, useChainErrorMessage, schemaPlaceholder, CopyButton, SectionHeading, PickerTabs/PickerStates, ConnectionFeedback, useNodeCache.
- Chain rename with empty/duplicate/whitespace name; no duplicate-chain action exists.
- Sidebar chain search (SidebarSearch + chains).

## 4) Missing e2e scenarios (prioritized)
1. High: Given Settings > General, When the Chain execution Concurrency input is typed 0, 99, -3, or cleared, Then value clamps to 1..8 / is ignored and persists after reload (default 4 shown on fresh profile). Currently only fill(1|4) is used as a setup helper; clamping and default-4 are never asserted in e2e.
2. High: Given concurrency set to 2 in Settings and a chain with 4 independent slow requests, When run, Then the run log shows exactly 2 lanes concurrently (never 3+), proving the limit rather than 1-vs-4.
3. High: Given a chain with a cycle, When Run is pressed, Then run is blocked, banner names cycle nodes (verify against existing CHN scenarios; none specifically runs a cyclic chain through the UI).
4. Med: Given a persisted concurrency of 1 with a Loop body and Sub-chain, When run, Then sub-chain/loop still run (they force sequential) while outer lanes obey setting.
5. Med: Given MigrationRecovery visible (forced migration failure via init script), When Retry or Open read-only is clicked, Then the app recovers / shows read-only chains.
6. Med: Given several chains in sidebar, When searching by name in the sidebar search, Then only matching chains show.
7. Med: Given a rename to an empty or duplicate name, Then the old name is kept or error shown.
8. Low: Given a slow request with no timeout, When Stop pressed while 3 lanes are in flight at concurrency 4, Then all lanes show stopped (existing Stop test is single lane).
9. Low: Duplicate chain (if intended product feature).

## 5) Weak tests
- GeneralSection.spec "renders the localized concurrency copy": asserts presence only, no interaction.
- chainRunnerAbort.spec: single test.
- nodeStateStyles.spec: uses toBeTruthy() on class maps and querySelector(".h-3\\.5") (CSS-class coupling).
- SidebarMainTab.spec mocks ChainList entirely, so chains-in-sidebar is only checked by ChainList.spec separately.
- CHN-S-API-07b only asserts lane-0 and lane-1 elements visible; does not prove overlap in time (parallel-merge.spec timing-based tests cover this better but rely on fixture delays).
- e2e uses 8 waitForTimeout calls across chain specs (flakiness risk); chain.spec has ~54 bare toBeVisible assertions, mostly fine for UI presence.
- Concurrency in several e2e tests is seeded via localStorage (parallel-merge) bypassing the Settings UI wiring; only chain-e2e-* tests go through the input.

## 6) Parity script results
- check-ids.sh: `SPEC ids: 285  feature ids: 285`, `OK: ID sets match`.
- check-parity.sh: the script exited 1 with no output in this shell (set -e/pipefail on its playwright --list pipeline). Reproduced its logic manually via `bunx playwright test ... --list`: 285 Gherkin IDs, 285 test IDs, 0 missing, 0 duplicated, 0 unknown. Parameterized tests (CHN-BUG-16a/b, CHN-LOG-29a-c, 35b-d, CHN-M-11a-d) are generated by loops and resolve only through --list; a pure source grep shows them missing, which is expected. Therefore no scenario is documented-but-unimplemented. Worth fixing the script so it surfaces its failure reason (it exits silently in this environment, possibly because the dev server base URL or grep returning 1).
- Per-file scenario counts: bugs 26, canvas 15, complex 11, cross-cutting 6, medium 40, nodes-flow 45, nodes-logic 48, request-start-delay 47, run-log 47.
- Vitest on chain-related dirs: 58 files, 920 tests, all pass.
