# Chain feature analysis (for E2E planning)

Branch: feature/chaining-ui-overhaul. Read-only analysis. Schema v5. Existing spec: `e2e/chain.spec.ts`. Fixtures: `src/lib/dev/chainFixtures.ts`.
Paths: types `src/types/chain.ts`; registry `src/components/chain/blockRegistry.ts`; nodes `src/components/chain/nodes/`; panels `src/components/chain/panels/`; canvas `src/components/chain/canvas/`; page `src/app/chain/[collectionId]/`; runner `src/lib/chainRunner.ts` + `src/lib/chainRunner/`; run log `src/components/chain/run-log/`; stores `src/stores/useChainRunStore.ts`, chain store; run gating `src/lib/chainRunBlock.ts`.
Note: Condition/Loop/Evaluate/Validate/Collect config panels were not fully read for field-level testids; verify before writing selectors.

## 1. Node / block types

| Type | Purpose | Config (default) | Add behavior | Handles | Validation / errors | Duplicate (menu) |
|---|---|---|---|---|---|---|
| api (request) | Run a collection request; inject values from upstream | none (edge injections, assertions) | Picker dialog (cap 100); one node per request | in, success, fail | EXTRACTION_FAILED (skipped), injection errors (failed), HTTP_STATUS, ASSERTIONS_FAILED | no (page handler makes "<name> (copy)") |
| start | Declares chain inputs | inputs[{key, defaultValue, source literal/env, envVarKey}] | Direct insert at viewport centre; max 1 per chain (toast startBlockLimit) | out only (cannot be a target) | Override order: startOverrides > env var > default | no |
| delay | Wait N ms | delayMs (1000), inline edit `delay-value-btn` | Ghost placement | in/out | Aborted while waiting -> DELAY_INTERRUPTED/aborted | no |
| condition | Branch on variable | variable `{{value}}`, branches[{id,label,expression}] (branch 1 `== 'value'`, else empty) | Ghost, opens panel | in, one handle per branch id (+else) | NO_BRANCH_MATCHED. Operators: `==`,`!=` (str/num), `>`,`<`, `contains`. `>=`/`<=` unsupported | no |
| display | Extract value from upstream response into an alias | sourceJsonPath, targetField (url/path/header/body), targetKey, targetUrl | Ghost, no panel | in/out | DISPLAY_NO_SOURCE, DISPLAY_NO_PATH, DISPLAY_EXTRACT_FAILED. Only first inbound edge used | yes |
| evaluate | Sandboxed JS (worker) | code `return data;`, outputAlias `result` | Ghost, opens panel | in/out | EVALUATE_UNDEFINED_OUTPUT, EVALUATE_TIMEOUT, EVALUATE_TERMINATED. Panel test output | yes (alias gets `_copy`) |
| validate | JSON Schema check on upstream body | schema `{}`, sourceJsonPath "" | Ghost, opens panel | in/out | VALIDATE_NO_UPSTREAM, _INVALID_JSON, _INVALID_JSON_PATH, _NO_MATCH, _INVALID_SCHEMA_JSON, _INVALID_SCHEMA (max 3 errors shown) | yes |
| merge | Join parallel lanes | mode all/any (all) | Ghost, opens panel | in (needs >=2), out | <2 inbound: banner and Run blocked. any cuts other lanes (MERGE_ALREADY_RESOLVED, skipped) | yes |
| loop | Iterate array | sourceJsonPath, itemAlias `item`, maxIterations 100 (cap 1000) | Ghost, opens panel | in, `body`, `done` (each single-use) | LOOP_INVALID_ALIAS (not `index`), LOOP_INVALID_MAX_ITERATIONS, LOOP_NO_UPSTREAM, LOOP_SOURCE_NOT_ARRAY, LOOP_NO_PAIRED_COLLECT, nesting max 3 | yes (+paired collect) |
| collect | Gather loop iteration outputs | loopId | Ghost, opens panel | in/out | COLLECT_NO_LOOP_RESULT (skipped); unresolved -> banner | no |
| subchain | Run another chain inline | chainId, inputBindings{key: literal/alias} | Ghost, opens SubChainPicker | in/out | SUBCHAIN_REFERENCE_UNRESOLVED, SUBCHAIN_DEPTH_EXCEEDED (>5); nested failure re-raised | yes |

Edges: `{id, source, target, branchId?, injections[{sourceJsonPath, targetField, targetKey}], targetUrl?}`. Handle ids: success, fail, else, body, done, branch id. Routing edges get a placeholder injection. Injection semantics: header replace/push; url `?k=v`/`&k=v` encoded; path replaces `:key` else appends `/value`; body JSON only (INJECTION_BODY_TYPE_UNSUPPORTED, INJECTION_BODY_NOT_JSON). Env promotion per edge writes a value to an env var (PromoteToEnvPopover).
Connection rules: self-connect rejected (toast), duplicate source+target+branch rejected, occupied loop handle rejected, nesting >3 refused (toast), cannot connect into Start.

## 2. Execution engine

| Aspect | Behavior |
|---|---|
| Order | Kahn topological; cycle -> CIRCULAR_DEPENDENCY, run aborted. UI blocks Run first (reasons in priority: empty, cycle, invalidMerge, unpairedLoop, unresolvedCollect, loopNesting, invalidSubChain). Start-only chain counts as empty |
| Concurrency | Default 4 (UI setting chainConcurrency). Loop and subchain bodies: 1 |
| Skip rules | Source missing/skipped -> UPSTREAM_SKIPPED. Failed source deactivates normal edges; `fail` handle active only on failure; `success` only on pass; branch edges only if activeBranchId matches |
| Partial failure | Descendants of a failure skipped; independent branches continue. Run status: aborted->stopped, any failed->failed, else passed |
| Branching | Condition first-match-wins, else fallback, none -> failed |
| Loops | Sequential per item; exposes `{{item alias}}`, `{{index}}`; failed iteration does not stop loop (warning loop-iterations-failed; loop-truncated on cap); loop "passed" |
| Parallel/merge | all: needs every lane passed; any: first pass wins, others skipped |
| Delay | Timer, rejects on abort |
| Cancel | Stop button / Mod+. aborts: running node "aborted" (RUN_STOPPED), unstarted "skipped" |
| Re-run | rerun(runId): full -> full run; other triggers use anchorNodeId; triggers: full, upTo, fromHere, single (single ignores edges/injections) |
| Interpolation | `{{key}}` from start inputs + aliases; unresolved vars recorded per step, shown in node footer and Run log |
| API result | 2xx + enabled assertions pass = passed; non-2xx = failed HTTP_STATUS; assertion fail = ASSERTIONS_FAILED |
| Env promotion | Applied after run unless aborted |

## 3. Run log (bottom dock)

| Item | Detail |
|---|---|
| Run statuses | running, passed, failed, stopped. Step states: idle, running, passed, failed, skipped, aborted |
| Layout | RunLogDock = Header + Split (RunsList left, StepsTimeline + StepDetail right) + ResizeHandle; collapsed bar when collapsed (`useUIStore.chainRunLogCollapsed`); toggle `toggle-run-log-btn` |
| Runs list | RunCard (indicator, trigger, counts, duration), RunCardMenu (delete with 6s undo, rerun), RunSelect dropdown, clear runs |
| Filtering | RunFilterTabs: all / passed / failed (includes aborted) / skipped; zero-count tabs hidden; falls back to All if active tab empties. Plus text search in StepsTimeline. Counts ignore search |
| Steps | StepRow per node, lane indicator, http status, error line, warnings; NestedSteps toggles for loop iterations and subchains; virtualised above threshold when no nesting |
| Step detail tabs | Input, Output, Assertions, Extracted |
| Empty states | `run-log-empty-<kind>` |
| Persistence | IndexedDB `chainRuns`, pruned and capped; active run persisted as stopped on beforeunload; deleting chain purges runs |
| Header status | LastRunStatus in page header: `chain-history-label`, `chain-running-indicator`, `chain-<kind>` |

## 4. Canvas interactions

| Action | How |
|---|---|
| Add | `block-menu-trigger` (Mod+Shift+K or `/`), `block-menu-item-<id>`, `block-menu-search`; empty state `empty-add-api-btn`, `empty-add-start-btn`; ghost blocks placed by clicking pane; drop from handle with connection creates connected node |
| API picker | `api-picker-dialog`: tabs, search, method filter, tree, history, new request/cURL, target collection, cap 100 |
| Connect/disconnect | Drag handle to handle; click edge to configure injections (ArrowConfigPanel); delete edge via DeletableEdge or `clear-edges-btn` |
| Delete | Delete/Backspace; loop deletion removes paired collect; clear all via `clear-nodes-btn` |
| Duplicate | Mod+D, context menu (registry flag) |
| Copy/paste | Mod+C/V for delay, condition, display, evaluate, validate only (others toast clipboardSkipped); offset 40px |
| Drag/nudge | Snap grid 16; arrows nudge 16 (Shift 160), disabled while running |
| Undo/redo | Mod+Z / Mod+Shift+Z, history 100, coalesce 1s |
| Layout/zoom | L auto layout, F fit, Mod+A select all, Mod+F find node, `?` shortcuts |
| Run | Mod+Enter, Mod+. ; Run with inputs popover (start block) |
| Rename | Chain list rename (`chain-rename-input`, `chain-rename-btn`) |
| Persist | Debounced 150ms, flushed on unload/visibility/leave |
| Context menu | Add API after, Configure, Change reference, Duplicate, Run up to/from here, align/distribute (2+/3+ nodes), Delete |
| Empty state | `chain-empty-state` |
| Banners | cycle, merge, loop-unpaired, collect-unresolved, loop-nesting-depth, loop-body-unconnected, loop-body-misses-collect, subchain-invalid, start-only (info); dismissible per signature |

Shortcuts only fire when canvas focused, no dialog open, not in an editable target. Enter opens focused node; Esc clears focus.

## 5. Selectors

| Area | Selectors |
|---|---|
| Header | chain-request-count, toggle-run-log-btn, chain-more-actions-btn, clear-nodes-btn, clear-run-results-btn, clear-edges-btn, run-chain-btn, stop-chain-btn, run-with-inputs-btn, run-with-inputs-popover, clear-nodes-dialog |
| Canvas | role=application, chain-empty-state, empty-add-api-btn, empty-add-start-btn, block-menu-trigger, pane-block-menu, block-menu-search, block-menu-item-<id>, canvas-banner-<type> (role=status), edge-status-label, find-node-input/list/row-<id>/empty |
| Nodes | chain-node-<id>, start-node-, delay-node-, condition-node-, display-node-, evaluate-node-, validate-node-, merge-node-, loop-node-, collect-node-, subchain-node-<id>; delay-value-btn; node-variables-footer(-unresolved/-list); `.react-flow__node[data-id]` |
| Start panel | start-config-add-input-btn, -save-btn, -cancel-btn, -delete-btn, -input-key, -delete-input-btn, -source-literal-btn, -source-env-btn, -default-value, -env-var |
| Other panels | merge-config-mode-any-btn/all-btn, subchain-config-binding-<key>, evaluate-test-output/-error, role=alert (alias collision, validate) |
| API picker | api-picker-dialog, picker-search, picker-tab-<tab>, picker-panel-new, picker-tree, picker-row-<id>, picker-header-<id>, picker-method-<M>, picker-footer, picker-selected-count, picker-clear-selection, picker-cap-note, picker-cancel, picker-add-selected, picker-new-request, picker-new-curl, picker-curl-error, picker-new-method/url/name, picker-new-url-error, picker-new-request-submit/-cancel, picker-target(-collection/-path/-folder-<id>), picker-no-results, picker-error, picker-retry, picker-skeleton, picker-history-empty |
| Subchain picker | subchain-picker-dialog, subchain-picker-search, subchain-picker-item-<chainId> |
| Run log | run-log-dock, run-log-header, run-log-strip, run-summary-header, run-card-indicator, run-card-menu, run-log-empty-<kind>, step-lane-<n>, step-type-icon, step-http-status, step-error-line, iteration-toggle-<parent>-<iter>, subchain-toggle-<parent>, injected-value, unresolved-vars; role=option on runs/steps, role=separator on resize handle; aria-labels runLogRunSelect, runLogOptions, runLogExpand/Collapse, runLogRowMenu, search placeholder, runLogLaneAriaLabel; assertion pass/fail labels |
| Chain list | new-chain-name-input, chain-list-item-<id>, chain-list-more-btn-<id>, chain-rename-input, chain-rename-btn, chain-delete-btn |
| Gaps (no testid) | Condition/Loop/Evaluate/Validate/Collect panels, NodeToolbar buttons (aria-label only), NodeContextMenu items (use role=menuitem + text), ArrowConfigPanel, DeletableEdge delete, RunFilterTabs buttons (text-based) |

## 6. Suspected bugs and edge cases

| # | Finding | Suggested E2E |
|---|---|---|
| 1 | Condition `>=`/`<=` silently false; no else -> NO_BRANCH_MATCHED | Condition with `>= 5` |
| 2 | canDuplicate false for condition/delay hides menu item, yet Mod+D duplicates them | Compare menu vs shortcut |
| 3 | Mod+D on lone Collect creates collect with empty loopId -> collect-unresolved banner | Select collect, Mod+D |
| 4 | Deleting Collect alone leaves loop unpaired -> banner, Run blocked | Delete collect |
| 5 | Copy/paste supports only 5 block types; others toast skip | Copy loop |
| 6 | Loop is "passed" even when iterations fail (warning only) | Loop with one failing iteration |
| 7 | Subchain executor does not forward loopDepth to nested chain (nesting limit bypass) | Nested loops across subchains |
| 8 | Extraction failure marks API node skipped, run can end "passed" with missing data | Bad JSONPath edge |
| 9 | Display uses only incomingEdges[0]; canRun false but executes | Display with two inputs |
| 10 | Single-node run ignores edges/injections | Run single node with injected edge |
| 11 | Ghost placement uses window click listener: any click (even on UI) may place; check Esc cancel | Place then Esc / click toolbar |
| 12 | Merge "any" skips in-flight lanes; aborted lanes not counted | Merge any with slow lane |
| 13 | Dismissed banners reappear when node-id signature changes | Dismiss, then edit graph |
| 14 | Run delete is soft (6s undo) and committed on unload; clear runs finalizes pending deletes | Delete + undo + reload |
| 15 | Start block second add toasts; Start cannot be a target | Add two starts |
| 16 | Loop alias `index` or non-identifier rejected only at run time (LOOP_INVALID_ALIAS) | Alias "index" |
| 17 | Filter falls back to All when active tab empties (derived state) | Filter failed, rerun passing |
| 18 | Nudge/auto-layout disabled while running; shortcuts ignored in editable targets | Nudge during run |
