# Review: chain-e2e SPEC / PLAN / TASKS

Reviewer: independent pass against ANALYSIS-feature.md, ANALYSIS-coverage.md and the source (read-only). No test code written, nothing committed. Fixes were applied in SPEC.md, PLAN.md and TASKS.md.

## Result
- Scenarios: 196 -> 244 (Simple 124, GR+CV 12, Medium 35, Complex 10, Run-log 39, Bug 19, Cross 5). Traceability is exactly 1:1 (244 IDs, 244 rows, verified by script).
- Tasks: 60 -> 66 (new: P1.3a, P1.8a, P1.13a, P1.13b, P2.5a, P3.5a). All tasks have Kind/Files/Do/Acceptance/Verify, at most 5 files, valid dependencies, bun/bunx only.

## Gaps and fixes

| # | Category | Gap | Fix applied |
|---|---|---|---|
| 1 | Coverage (API) | No REQUEST_FAILED, assertion sources/operators/toggle, handle type, injection/edge removal, duplicate injection, empty URL | Added S-API-14..20; S-API-06 now also covers INJECTION_BODY_NOT_JSON (orphan seed api-inject-badbody) |
| 2 | Coverage (Start) | Run-with-inputs reset/stale override | Added S-STR-11 |
| 3 | Coverage (Condition/Display/Evaluate/Validate) | `>=`/`<=` boundary outside BUG-01, non-numeric operand, branch order, extractor picker, upstream-failed Display, syntax error, sandbox globals, error-list cap | Added S-CND-11..13, S-DSP-11..12, S-EVL-10..11, S-VAL-09 |
| 4 | Coverage (flow nodes) | Merge output, nesting depth 3 vs 4 (LOOP_DEPTH_EXCEEDED), default max, done handle, loop re-run, collect re-pair, self-reference, picker excludes self, SUBCHAIN_FAILED | Added S-MRG-08, S-LOP-13..17, S-COL-06, S-SUB-09..11; reworded S-LOP-09 (panel rejects, runtime LOOP_INVALID_ALIAS) |
| 5 | Coverage (canvas) | Undo/redo, reload persistence, rename in log, picker search, paste; banners cycle/start-only/loop-body-unconnected/loop-body-misses-collect/subchain-invalid had no scenario | Added CHN-GR-01..05 and CHN-CV-01..07 (new file `chain-e2e-canvas.spec.ts`, new task P1.13b) |
| 6 | Coverage (run log) | Dock persistence, run select, trigger labels, virtualisation (>50 rows), 50-run cap, detail pane, failure link | Added LOG-33..39 (task P2.5a) |
| 7 | Thin scenarios | Medium table had one "Flow and assertions" cell | Rewrote as Graph / Steps / Canvas / Run log for all rows; added M-33..35 |
| 8 | Thin scenarios | C-04, C-05, C-06, C-09, C-10 lacked concrete assertions | Expanded with counts, lanes, filters, reload and undo assertions |
| 9 | Source mismatch | `chain-passed` testid does not exist | Replaced with `chain-<kind>-count` (`chain-passed-count`) |
| 10 | Source mismatch | Concurrency is on `/settings` (`#chain-concurrency`), not the chain page | S-API-07 corrected; testid `chain-concurrency-input` added to the allowed list and task P0.4 |
| 11 | Source mismatch | S-API-12: the 599 proxy envelope is HTTP_STATUS, not a network error | S-API-12 reworded; new `/api/abort` route (route.abort) for REQUEST_FAILED; decision 12.6 |
| 12 | Source mismatch | P0.3 targeted nonexistent `ArrowConfigPanel.tsx` | Now `arrow-config/ArrowConfigPanelBody.tsx`, `InjectionEditor.tsx`, `DisplayExtractor.tsx` (SPEC 6, PLAN, P0.3) |
| 13 | Bug handling | BUG-06 is an intentional product decision in source, but TASKS made it STOP-and-ask | BUG-06 documented as intended; P4.6 has no ask and no source change |
| 14 | Bug handling | BUG-16: Loop panel already rejects invalid alias | BUG-16 asserts panel rejection; runtime owned by S-LOP-09 |
| 15 | Bug handling | BUG-07 vague | Now cites LOOP_DEPTH_EXCEEDED / SCHEDULER_DEPTH_EXCEEDED; still STOP-and-ask |
| 16 | Placeholders | P4.1..P4.11 Files held `<found by grep>` / `<determined after the user decides>` | Resolved to real paths: `chainControlFlow.ts`, `ConditionConfigPanel.tsx`, `useCanvasClipboard.ts`, `useCanvasCommands.ts`, `ChainValidationBanners.tsx`, `GhostPlacementHandler.tsx`, `useChainRunStore.ts`, `chainRunHistory.ts`, `NodeContextMenu.tsx`, `nesting.ts`, `executors/subchain.ts`, `apiExecutor.ts`, `utils.ts`, `displayExecutor.ts`, `runGraph.ts`, `stepRecording.ts`, `executors/merge.ts`, `scheduler.ts`; each notes "split before touching a sixth file" |
| 17 | Consistency | SPEC section 10 phase order disagreed with PLAN/TASKS | Section 10 rewritten to match (0 Foundation, 1 Simple, 2 Run log, 3 Medium, 4 Bugs, 5 Complex, 6 Cross, 7 Gate) |
| 18 | Consistency | Seed names differed (SPEC api-404 / delay-zero vs TASKS api-fail404 / delay-invalid); orphan seeds | TASKS aligned to SPEC; seed table extended with every new seed and its scenario |
| 19 | Consistency | Counts (196, 98, 32) in SPEC, PLAN, TASKS; P6.3 ID regex lacked GR/CV; P6.4 expected 196 | All updated to 244/124/35/39; regex and expected total fixed; traceability Check and "Totals: 66 tasks" updated |
| 20 | Checkpoints | New tasks sat outside checkpoint dependencies | Checkpoints 1a, 1b, 1c (now also runs the canvas file), 2 and 3 depend on the new tasks |

## Verified against source (no change needed)
Operator set and `testExpression` location, executor error codes, limits (loop depth 3, subchain depth 5, scheduler depth 8, virtualize 50, run cap 50), RunFilterTabs and banner testid pattern `canvas-banner-<type>`, clipboard supported types, 599 mock behaviour.

## Open items
- VERIFY (observe, then assert): assertion-authoring UI control names (S-API-13/15/16, P0.2 spike), S-API-20 empty-URL gate, S-DSP-11 extractor control, S-EVL-11 sandbox behaviour, LOG-37 50-run pruning, LOG-38 clipboard permission, CV-06 reachability of CIRCULAR_DEPENDENCY / SCHEDULER_DEPTH_EXCEEDED from the UI.
- User decisions still required during Phase 4 (STOP-and-ask, `test.fixme` until answered): BUG-02, 07, 08, 09, 10, 12. BUG-01 is fixed automatically; BUG-06 documented.
- Runtime: +244 tests may exceed the earlier ~8 minute estimate; PLAN risk table updated, per-phase timing is tracked.
