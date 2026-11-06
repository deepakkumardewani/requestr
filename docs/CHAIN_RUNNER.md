# Chain runner

A chain is a graph of blocks run in dependency order. The runner is browser-side. Every claim cites a path.

## Model

`Chain` (`src/types/chain.ts`) holds blocks and `ChainEdge`s; its `schemaVersion` is `CHAIN_SCHEMA_VERSION` (5). Block kinds are listed once in `CHAIN_NODE_TYPES` (`src/types/chain.ts`): `api`, `delay`, `condition`, `display`, `start`, `evaluate`, `validate`, `merge`, `loop`, `collect`, `subchain`. A chain is `collection` or `standalone` scoped (`ChainScope`). Pre-v5 per-collection configs are migrated by `src/lib/chainMigration.ts`. Persisted chains and runs are covered in `docs/DATA_MODEL.md`.

## Execution

`runChain` (`src/lib/chainRunner.ts`):

1. Throws `SchedulerDepthExceededError` when nesting passes `MAX_SCHEDULER_DEPTH` (8, `src/lib/chainRunner/types.ts`). Sub-chains are bounded by `MAX_SUBCHAIN_DEPTH` (5) and loops by `MAX_LOOP_NESTING_DEPTH` (3) in `src/lib/chainConstants.ts`.
2. Collects control-flow ids, checks the graph is runnable, and builds the scheduled ids and run environment.
3. Drains the scheduler (`createScheduler` in `src/lib/chainRunner/scheduler.ts`) with `concurrency` (default `DEFAULT_CHAIN_CONCURRENCY` = 4, `src/lib/chainConstants.ts`; the UI preference is clamped to 1 to 8 in `src/stores/useUIStore.ts`) calling `processNode` for each node.
4. If the run was aborted, every node that never ran is reported `skipped` with the `RUN_STOPPED` error code.

`buildExecutionOrder` in `src/lib/chainRunner.ts` orders nodes and throws `CircularDependencyError` on a cycle. Scheduler internals: `schedulerGraph.ts`, `schedulerLanes.ts`, `schedulerQueue.ts` in `./src/lib/chainRunner`; graph traversal in `src/lib/chainRunner/runGraph.ts`; loop bodies in `src/lib/chainRunner/loopBody.ts`; sub-chain nesting in `src/lib/chainRunner/nesting.ts`.

## Executors

One per block kind in `./src/lib/chainRunner/executors`: `apiExecutor.ts` (sends through `runRequest`, see `docs/REQUEST_PIPELINE.md`), `conditionExecutor.ts`, `delayExecutor.ts`, `displayExecutor.ts`, `evaluate.ts`, `loop.ts`, `merge.ts`, `start.ts`, `subchain.ts`, `validate.ts`. Step results are recorded by `src/lib/chainRunner/stepRecording.ts`. Failures use typed codes from `src/lib/chainRunner/errorCodes.ts` (`chainError`, `CHAIN_ERROR_CODE`).

## Evaluate blocks

User code runs off the main thread. `src/lib/chainEvalHost.ts` owns the worker and kills it after `EVAL_TIMEOUT_MS` (5000); the worker is `src/lib/chainEvalWorker.ts`; request and result types are in `src/lib/chainEval.ts`; `src/lib/chainEvalLockdown.ts` removes network, storage and script-loading globals from the worker.

## State and history

- `src/stores/useChainStore.ts`: chain definitions.
- `src/stores/useChainRunStore.ts`: run state, persisted to the `chainRuns` store.
- `src/stores/chainHistory.ts`: bounded undo and redo stacks, one per chain id (in memory).
- Canvas UI and shortcuts: `./src/components/chain/canvas`, `src/components/chain/canvas/hooks/useChainCanvasShortcuts.ts`.

## Tests

Unit specs beside each file (for example `src/lib/chainRunner.spec.ts`, `src/lib/chainRunner/runGraph.spec.ts`); browser specs `e2e/chain.spec.ts` and the `chain-e2e-*` specs in `./e2e/qa`. See `docs/TESTING.md`.
