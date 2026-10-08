# Spec: Thorough Playwright E2E Coverage of the Chain Feature

Branch: feature/chaining-ui-overhaul. Status: DRAFT for human review (planning only; no test or source code is written by this spec).
Inputs: `agent_docs/chain-e2e/ANALYSIS-feature.md` (AF), `agent_docs/chain-e2e/ANALYSIS-coverage.md` (AC). Citation style `file:line` below uses AC section 3 line numbers. `chain.spec.ts` = `e2e/chain.spec.ts` (CS), `chaining-ui-overhaul.spec.ts` = `e2e/qa/chaining-ui-overhaul.spec.ts` (UO), `parallel-merge.spec.ts` = `e2e/qa/parallel-merge.spec.ts` (PM).

## ASSUMPTIONS I'M MAKING (confirmed by user unless noted)
1. Keep all 202 existing tests; add new specs only for gaps; light dedupe allowed (no rewrites).
2. Network stays hermetic through `installChainRoutes`; new endpoints may be added to `e2e/fixtures/chainRoutes.ts`.
3. New chain data goes into a new seed file `e2e/fixtures/seed/chain-e2e.json` (then `bun run qa:seed:build`); seeded specs are tagged `@qa`.
4. Real bugs are fixed in scope with a regression test; missing testids may be added to source (minimal, listed in section 6).
5. (Unconfirmed) API-node assertion configuration UI is not fully analysed; scenarios touching assertions are marked VERIFY and may be satisfied via seeded assertion config rather than UI authoring.
6. (Unconfirmed) Field-level testids for Condition/Loop/Evaluate/Validate/Collect panels do not exist (AF section 5 gaps); scenarios use role/label/text selectors until the testids in section 6 are added.

## 1. Objective
Deliver a passing, thorough Playwright suite for chains: all 11 block types (api, start, delay, condition, display, evaluate, validate, merge, loop, collect, subchain), the bottom run-log/results bar, from single-node scenarios to complex graphs (branching, loops, parallel+merge, subchains, errors, cancel, re-run). Every node type must have: happy path, every config option, at least one edge case (empty/invalid/upstream failure), an error state, each asserted on the canvas AND in the run log. Success is the entire chain suite green and the Coverage Matrix (section 4) fully populated.

## 2. Commands
```
Install browser (once):   bunx playwright install chromium
Seed rebuild (after editing e2e/fixtures/seed/*.json):  bun run qa:seed:build
Seed drift check:         bun test src/lib/qaSeedSchema.spec.ts   (or the project's unit runner)
New chain e2e only:       PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/chain-e2e-*.spec.ts
Full chain suite:         PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts e2e/qa/chain-e2e-*.spec.ts
Flake gate:               ... bunx playwright test e2e/qa/chain-e2e-*.spec.ts --repeat-each=3
Typecheck/lint:           bun run lint ; bunx tsc --noEmit  (only once the whole task is done)
```
Never run `npm`. The server is already running on :3000 (do not start it). No commits.

## 3. Project structure (new files)
```
e2e/fixtures/chainRoutes.ts                extend with new mock endpoints (3.2)
e2e/fixtures/seed/chain-e2e.json           NEW seeds (3.1); regenerate qa-seed.init.js
e2e/fixtures/chainE2eHelpers.ts            NEW helpers (3.3)
e2e/qa/chain-e2e-simple-api-start-delay.spec.ts      CHN-S-API/START/DLY
e2e/qa/chain-e2e-simple-logic.spec.ts                CHN-S-CND/DSP/EVL/VAL
e2e/qa/chain-e2e-simple-flow.spec.ts                 CHN-S-MRG/LOP/COL/SUB
e2e/qa/chain-e2e-canvas.spec.ts                      CHN-GR-*, CHN-CV-*
e2e/qa/chain-e2e-medium.spec.ts                      CHN-M-*
e2e/qa/chain-e2e-complex.spec.ts                     CHN-C-*
e2e/qa/chain-e2e-runlog.spec.ts                      CHN-LOG-*
e2e/qa/chain-e2e-bugs.spec.ts                        CHN-BUG-*
e2e/scenarios/chain/*.feature.md          EXISTS: 9 Gherkin feature files, one scenario per ID, SOURCE OF TRUTH (check: e2e/scenarios/chain/check-ids.sh)
```
Splitting by file keeps each spec under ~800 lines (the logic and flow files may exceed it; split further by node if so) and lets 2 workers parallelise (config: 2 workers locally).

### 3.1 New seeds (`chain-e2e.json`, all chains `scope:"standalone"`, `schemaVersion:5`, ids `qa-e2e-*`)
Request ids reuse existing `qa-req-*` where possible (fast, fail, slow, list, token, echo, users, user-detail). New requests use `qa-e2e-req-*`. "->" is an edge; `inj(...)` is an injection.

| Seed id | Graph | Purpose |
|---|---|---|
| qa-e2e-api-single | fast | S-API happy |
| qa-e2e-api-fail500 | fail | S-API error (500) |
| qa-e2e-api-404 | status404 (new route) | non-5xx HTTP_STATUS |
| qa-e2e-api-unmocked | unmocked-host (599) | network error state |
| qa-e2e-api-inject-hdr / -url / -path / -body | token -> echo with inj to header / query / `:id` path / JSON body | each injection target |
| qa-e2e-api-inject-miss | token -> echo, inj `$.nope` | EXTRACTION_FAILED edge |
| qa-e2e-api-inject-badbody | token -> echo(form body) inj to body | INJECTION_BODY_NOT_JSON/UNSUPPORTED |
| qa-e2e-api-assert-pass / -fail | fast with seeded assertion (VERIFY format) | ASSERTIONS_FAILED |
| qa-e2e-start-literal / -env / -multi / -dup | Start(inputs) -> echo | Start options |
| qa-e2e-delay-short / -long / -zero | Delay(200/5000/0) -> fast | delay |
| qa-e2e-cond-{eq,neq,gt,lt,contains,ge,else,nomatch,multi} | Start(score) -> Condition -> fast(pass) / fail-route nodes | operators, branches |
| qa-e2e-disp-{url,path,header,body,nopath,nosrc,multi-in} | token/users -> Display -> echo | Display |
| qa-e2e-eval-{ok,undef,timeout,throw,alias-clash,data} | token -> Evaluate -> echo | Evaluate |
| qa-e2e-val-{pass,fail,badjson,badpath,nomatch,badschema,noup,path-ok} | fast/users -> Validate | Validate |
| qa-e2e-merge-{all-ok,all-fail,any-ok,any-first-fail,single-in} | slow+fast -> Merge | Merge |
| qa-e2e-loop-{ok,empty,notarray,alias-index,alias-bad,max-cap,cap-trunc,iter-fail,noup,unpaired,nested3,nested4} | list(users) -> Loop -> body -> Collect | Loop/Collect |
| qa-e2e-sub-{child, parent-ok, parent-bind, parent-missing, parent-fail, parent-deep6, parent-self} | child chain and parents | Subchain |
| qa-e2e-api-abort / -nourl / -text / -empty-list / -object | `/api/abort`, empty URL, `/api/text`, `/api/empty-list`, `/api/object` | S-API-14, -20, -09, -10, S-LOP-04 |
| qa-e2e-api-assert-pass / -fail variants | assertions per source/operator, disabled toggle | S-API-15, -16 |
| qa-e2e-cond-ge, cond-badnum | `>= 5` with 5; `>` with "abc" | S-CND-11, -12 |
| qa-e2e-eval-syntax, disp-after-fail, val-fail | syntax error; Display after failed request; 4+ schema errors | S-EVL-10, S-DSP-12, S-VAL-09 |
| qa-e2e-loop-large, loop-nested3 / -nested4 | 60-item list; depth 3 ok, depth 4 banner | LOG-36, S-LOP-13, -14 |
| qa-e2e-cycle, start-only, loop-body-unconnected, loop-body-misses-collect, sub-parent-empty | banner seeds | CHN-CV-01..05 |
| qa-e2e-med-* and qa-e2e-cx-* | see sections 5.2 and 5.3 | Medium / Complex graphs |

### 3.2 New mock endpoints (`installChainRoutes`, exact pathname match; unknown stays 599 + console.error)
`/api/users` (array of 3 objects `{id,name,score,tags[]}`), `/api/empty-list` (`[]`), `/api/object` (`{items:{}, nested:{a:{b:[1,2]}}}`), `/api/text` (non-JSON body), `/api/status/404`, `/api/score` (`{score:7,label:"seven"}`), `/api/medium` (1500 ms, 200), `/api/abort` (handler calls `route.abort()` to produce REQUEST_FAILED), `/api/list-60` (60 items, LOG-36), `/api/flaky/:n` is NOT added (stateful mocks risk flake); per-iteration failure uses `/api/list-mixed` returning `[{id:1},{id:"fail"},{id:3}]` with `/api/item/<id>` routed by pathname: `/api/item/1` 200, `/api/item/fail` 500, `/api/item/3` 200.

### 3.3 Helpers (`chainE2eHelpers.ts`; reuse `qa.ts`, `qaHelpers.ts`)
`openChain(page, chainId)`, `runChain(page, {via:"button"|"shortcut"})`, `waitRunDone(page)`, `nodeBadge(page,nodeLabel)` (canvas status), `expectNode(page, label, {state, errorCode?, footerUnresolved?})`, `openRunLog(page)`, `expectStep(page, label, {state, http?, errorCode?, lane?})`, `expectRunSummary(page, {status, passed, failed, skipped})`, `expectBarSummary(page, status)`, `openStepDetail(page,label,tab)`, `setFilter(page, tab)`. Rules (from template): no `waitForTimeout`, no CSS selectors, `getByTestId` first, `snap()` at end, never bypass consoleGuard, one `test()` per scenario.

## 4. Coverage Matrix
Legend: EX = existing, cited `file:line`; NEW = scenario ID in section 5; GAP-FILLED means the dimension had no coverage before. "Canvas+Log" means both surfaces are asserted (mandatory for all NEW). Columns: H happy, C every config option, E edge case, X error state, M medium, K complex (CHN-C), L run-log asserted.

| Node | H | C (config options) | E (edge) | X (error) | M (medium) | K (complex) | L |
|---|---|---|---|---|---|---|---|
| api | EX CS:939, CS:969, CS:1133; NEW S-API-01,02 | EX injection to path CS:1533, UO:80. NEW S-API-21/22 (env promotion), S-API-03 (header), -04 (query), -05 (path), -06 (body), -07 (concurrency on /settings), -15/-16 (assertion sources, operators, toggle), -17 (handle type), -18 (injection/edge removal) | NEW S-API-08 (extraction miss), -09 (non-JSON body), -10 (empty response list), -19 (duplicate header injection), -20 (empty URL) | EX CS:1020, CS:1376, UO:162. NEW S-API-11 (404), -12 (HTTP_STATUS 599), -13 (assertions fail), -14 (REQUEST_FAILED) | M-01..M-06, M-20 | C-01..C-08 | every NEW |
| start | EX CS:2542, CS:2605, UO:409 | NEW S-STR-02 (literal), -03 (env source), -04 (default), -05 (override via Run-with-inputs), -06 (multiple inputs) | EX CS:2708, CS:3593 (start-only). NEW S-STR-07 (empty key / duplicate key), -08 (env var missing), -11 (reset and stale override) | NEW S-STR-09 (second Start toast), -10 (cannot be edge target) | M-07, M-08 | C-01, C-05 | every NEW |
| delay | EX CS:746 (add only). NEW S-DLY-01 (runs, duration in log) | NEW S-DLY-02 (edit value inline), -03 (value persists reload) | NEW S-DLY-04 (0 ms), -05 (invalid/negative/non-numeric input) | NEW S-DLY-06 (cancel during delay -> aborted, DELAY_INTERRUPTED) | M-09 | C-03, C-06 | every NEW |
| condition | EX CS:867, CS:898 (UI only). NEW S-CND-01 (== match) | NEW S-CND-02 (!=), -03 (>), -04 (<), -05 (contains), -06 (add/remove branch), -07 (else), -08 (numeric vs string) | NEW S-CND-09 (variable unresolved) | NEW S-CND-10 (NO_BRANCH_MATCHED), -11 (>=/<= boundary), -12 (non-numeric), -13 (overlap order), BUG-01 | M-10..M-13 | C-02, C-04 | every NEW |
| display | EX CS:777, CS:1482 (add/menu only). NEW S-DSP-01 | NEW S-DSP-02 (target url), -03 (path), -04 (header), -05 (body), -06 (targetKey alias consumed downstream) | NEW S-DSP-07 (multiple inbound edges, BUG-09), -11 (extractor picker), -12 (upstream failed) | NEW S-DSP-08 (DISPLAY_NO_SOURCE), -09 (DISPLAY_NO_PATH), -10 (DISPLAY_EXTRACT_FAILED) | M-14, M-15 | C-01, C-07 | every NEW |
| evaluate | EX CS:809, CS:2757, UO:454 | NEW S-EVL-02 (code uses data), -03 (outputAlias custom), -04 (panel Test output), -05 (alias used in URL) | NEW S-EVL-06 (returns undefined) | NEW S-EVL-07 (throws), -08 (timeout), -09 (alias collision alert), -10 (syntax error), -11 (sandbox globals) | M-16, M-17 | C-01, C-07 | every NEW |
| validate | EX CS:838, CS:3060, UO:491 (fail, 3 errors) | NEW S-VAL-02 (schema pass), -03 (sourceJsonPath scoped) | NEW S-VAL-04 (no upstream), -05 (no match path) | NEW S-VAL-06 (invalid JSON body), -07 (invalid path), -08 (invalid schema JSON / schema), -09 (max 3 errors) | M-18 | C-04, C-08 | every NEW |
| merge | EX PM:60, PM:86, PM:122, UO:567 (lanes) | EX PM modes all/any. NEW S-MRG-03 (mode toggle persists + panel), -04 (any with failed first lane) | NEW S-MRG-05 (<2 inbound banner, Run blocked) | NEW S-MRG-06 (all with failing lane), -07 (MERGE_ALREADY_RESOLVED skipped), -08 (aggregated output) | M-19 | C-02, C-06 | every NEW |
| loop | EX CS:3217, UO:518, UO:542 | NEW S-LOP-02 (itemAlias custom), -03 (maxIterations), -04 (sourceJsonPath), -05 ({{index}} usage) | NEW S-LOP-06 (empty array), -07 (cap/truncated warning) | NEW S-LOP-08 (not array), -09 (alias `index` invalid), -10 (iteration failure warning), -11 (no upstream), -12 (no paired collect), -13/-14 (nesting depth 3 ok, 4 banner/LOOP_DEPTH_EXCEEDED), -15 (default max), -16 (done handle), -17 (re-run) | M-21..M-24 | C-03, C-04 | every NEW |
| collect | EX CS:3217, UO:518 (implicit) | NEW S-COL-02 (collects outputs, Extracted tab) | NEW S-COL-03 (collect of empty loop) | NEW S-COL-04 (COLLECT_NO_LOOP_RESULT skipped), -05 (unresolved banner), -06 (re-pair on loop delete) | M-22 | C-03 | every NEW |
| subchain | EX CS:2066, UO:607 | NEW S-SUB-02 (inputBindings literal), -03 (binding from alias), -04 (change reference via picker) | NEW S-SUB-05 (empty chain target) | NEW S-SUB-06 (SUBCHAIN_REFERENCE_UNRESOLVED / deleted target), -07 (depth > 5), -08 (nested failure re-raised), -09 (self reference), -10 (picker excludes self), -11 (SUBCHAIN_FAILED) | M-25 | C-04, C-08 | every NEW |

Results bar / run log matrix (rows: aspect; cells list scenarios): states running/passed/failed/stopped/skipped/aborted (EX UO:1603, UO:1653, UO:2462; NEW LOG-01..06, LOG-35, LOG-39), filter tabs (EX UO:1953; NEW LOG-07..10), search (EX UO:1983; NEW LOG-11..13), expand/details (EX CS:2173, CS:2223; NEW LOG-14..20), clearing (EX CS:1946, UO:988, UO:2305; NEW LOG-21..24), cancel (EX CS:1441, UO:199; NEW LOG-25..27), re-run (EX UO:2442; NEW LOG-28..30), header LastRunStatus (EX UO:947; NEW LOG-31), dock persistence and run select (NEW LOG-33, LOG-34), virtualisation and run cap (NEW LOG-36, LOG-37), detail pane (NEW LOG-38).

Canvas/graph dimensions (undo/redo, persistence, rename, picker search, copy/paste, banners cycle/start-only/loop-nesting-depth/loop-body-unconnected/loop-body-misses-collect/subchain-invalid) are covered by CHN-GR-01..08 and CHN-CV-01..07. Every row has at least one NEW or EX per column; no cell is empty. Dedupe candidates (optional, light): CS:2605 and UO:409 (Start override), CS:2757 and UO:454 (Evaluate flow), CS:3217 and UO:518 (3-item loop), CS:3125 and PM:16 (parallel lanes). Policy: keep both unless the maintainer asks to drop the CS copy; NEW scenarios must not repeat these.

## 5. Scenarios
Gherkin-first: `e2e/scenarios/chain/*.feature.md` holds one scenario per ID below and is the source of truth for titles and Given/When/Then; these rows add seeds, selectors and assertion detail. Where a bundled row was split into sub-IDs (a, b, c, d), each sub-row states only its own outcome. Test titles are prefixed `[<ID>]`.

Format: **ID** | title | seed | steps | canvas expectation | run-log expectation. Preconditions: seeded via `seededPage` + `installChainRoutes`, landing on `/chain/<seed id>`; viewport 1280x800 unless stated; run log expanded unless stated. "State" values: passed, failed, skipped, aborted. `[H] [C] [E] [X]` = happy, config option, edge, error tag.

### 5.1 Simple tier (single node to 3 nodes)

#### API request node (27)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-API-01 [H] | Single request passes and shows status | api-single | Click `run-chain-btn` | node badge passed, `chain-request-count` = 1 node, header `chain-passed-count` (pattern `chain-<kind>-count`) | one step, passed, `step-http-status` 200, duration shown, bar says Passed |
| CHN-S-API-02 [H] | Two chained requests run in order | api-inject-hdr without injection (token -> echo plain) | Run | both passed in order | steps ordered 1,2; no lane indicator conflict |
| CHN-S-API-03 [C] | Injection into a header | api-inject-hdr | Run; open echo step Output | node passed | step Input tab shows header value `secret-token-abc` (`injected-value`); Extracted tab lists the path |
| CHN-S-API-04 [C] | Injection into a query param | api-inject-url | Run | passed | Input URL contains `?k=secret-token-abc` (encoded) |
| CHN-S-API-05a [C] | Injection into a path (`:id` replace, else append) - replaces the :id placeholder | api-inject-path | Run (target URL contains a `:id` placeholder) | downstream node passed | downstream step URL shows `:id` replaced by the extracted value |
| CHN-S-API-05b [C] | Injection into a path (`:id` replace, else append) - appends the value when no placeholder exists | api-inject-path | Run (target URL has no placeholder) | downstream node passed | downstream step URL ends with the extracted value as a new path segment (`/value`) |
| CHN-S-API-06a [C] | Injection into a JSON body; form body gives INJECTION_BODY_NOT_JSON - JSON body injection | api-inject-body, api-inject-badbody | Run (JSON body target) | downstream node passed | step Input body contains the injected value |
| CHN-S-API-06b [C] | Injection into a JSON body; form body gives INJECTION_BODY_NOT_JSON - form body gives INJECTION_BODY_NOT_JSON | api-inject-body, api-inject-badbody | Run (target uses a form body) | downstream node failed | step failed with INJECTION_BODY_NOT_JSON (assert the observed code) |
| CHN-S-API-07a [C] | Concurrency setting 1 vs 4 for independent requests - concurrency 1 runs lanes sequentially | parallel-lanes (existing) | Set `chain-concurrency-input` to 1 on `/settings` (GeneralSection; range MIN/MAX_CHAIN_CONCURRENCY), return to chain, run | independent lanes run sequentially | steps in ordered, non-overlapping `step-lane-<n>` lanes (complements PM:149) |
| CHN-S-API-07b [C] | Concurrency setting 1 vs 4 for independent requests - concurrency 4 runs lanes concurrently | parallel-lanes (existing) | Set `chain-concurrency-input` to 4 on `/settings`, return to chain, run | independent lanes overlap in time | steps in distinct parallel `step-lane-<n>` lanes (complements PM:149) |
| CHN-S-API-08 [E] | Missing JSONPath fails the target, run ends Failed (BUG-08, item 7) | api-inject-miss | Run | echo node failed, EXTRACTION_FAILED on error strip | step failed with error line EXTRACTION_FAILED; run summary Failed with 1 passed, 1 failed |
| CHN-S-API-09 [E] | Non-JSON response renders raw in Output | api-text | Run | passed | Output tab shows raw text, no crash |
| CHN-S-API-10 [E] | Empty-array response is a valid pass | api-empty-list | Run | passed | Output shows `[]` |
| CHN-S-API-11 [X] | 404 is HTTP_STATUS failed | api-404 | Run | failed badge, error strip | step failed, `step-http-status` 404, `step-error-line` HTTP_STATUS; bar Failed |
| CHN-S-API-12 [X] | Unmocked host: proxy envelope status 599 fails as HTTP_STATUS (not a network error) | api-unmocked | Run (test allow-lists the expected console.error via the scoped helper, section 6) | failed badge, error strip | step failed, `step-http-status` 599, error line HTTP_STATUS; bar Failed |
| CHN-S-API-13 [X] | Assertions failing produce ASSERTIONS_FAILED (VERIFY authoring) | api-assert-fail / -pass | Run | pass seed passed, fail seed failed | Assertions tab lists pass/fail labels per assertion; error line ASSERTIONS_FAILED |
| CHN-S-API-14 [X] | Real network failure maps to REQUEST_FAILED | api-abort (`/api/abort`, handler calls `route.abort()`) | Run | failed badge, error strip | step failed, no `step-http-status`, error line REQUEST_FAILED; bar Failed |
| CHN-S-API-15a [C] | Assertion sources and operators (status, header, JSONPath body, duration; eq/neq/gt/lt/contains/exists) VERIFY authoring - assertion sources | api-assert-pass | In the assertions panel author one assertion per source (status, header, body path, duration), run | node passed | Assertions tab lists one passed row per source |
| CHN-S-API-15b [C] | Assertion sources and operators (status, header, JSONPath body, duration; eq/neq/gt/lt/contains/exists) VERIFY authoring - assertion operators | api-assert-pass | In the assertions panel author one assertion per operator (equality, comparison, contains, exists), run | node passed | Assertions tab lists one passed row per operator |
| CHN-S-API-16 [C] | Assertion enable/disable toggle skips evaluation | api-assert-fail | toggle the failing assertion off (VERIFY control name), Run | node passed (was failed in -13) | Assertions tab shows the disabled assertion as not evaluated; no ASSERTIONS_FAILED |
| CHN-S-API-17 [C] | Edge handle type: success vs fail edge via ArrowConfigPanel | fail-handle (med) | open edge, switch `success`/`fail` (ArrowConfigPanelBody), reload | edge label updates and persists | next run: routing follows new type |
| CHN-S-API-18a [C] | Remove one injection row from a multi-injection edge; delete edge from panel and via DeletableEdge - remove one injection row | api-inject-hdr | Open the edge, remove one `InjectionEditor` row, then run | injection count chip drops by one; edge remains | echo Input lacks the removed header |
| CHN-S-API-18b [C] | Remove one injection row from a multi-injection edge; delete edge from panel and via DeletableEdge - delete the edge | api-inject-hdr | Open the edge and delete it from its panel (and via DeletableEdge) | edge gone from the canvas | n/a |
| CHN-S-API-19 [E] | Two injections to the same header: last wins, no crash | api-inject-hdr + second inj | Run | passed | Input shows the single resolved header; Extracted lists both paths |
| CHN-S-API-20 [E] | Request with empty URL is blocked by the run gate | api-nourl | open page | node shows invalid state; `run-chain-btn` disabled or run fails with explicit error (observe and assert) VERIFY | no run created, or step failed with error line |
| CHN-S-API-21 [C] | Env promotion writes an extracted value to an environment variable after the run | api-promote-env | Run | passed | Extracted tab shows the promoted variable; environment now holds the value |
| CHN-S-API-22 [E] | Env promotion is not applied when the run is stopped | api-promote-env (slow) | Run, Stop before completion | run stopped | environment variable unchanged |

#### Start node (11)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-STR-01 [H] | Start with a literal default feeds a request | start-literal | Run | Start node lists input; echo passed | echo Input header equals default |
| CHN-S-STR-02 [C] | Switch source literal to env and select env var | start-literal | Open panel, `start-config-source-env-btn`, set `start-config-env-var`, save | node shows env source chip | Run: echo uses `{{baseUrl}}` env value |
| CHN-S-STR-03 [C] | Add, key and default fields persist | start-multi | `start-config-add-input-btn`, set key/default, save, reload | node lists all inputs after reload | Run uses all values |
| CHN-S-STR-04 [C] | Override order: Run-with-inputs > env > default | start-env | Open `run-with-inputs-popover`, override one, run | popover shows keys | Input shows override, not env or default |
| CHN-S-STR-05a [C] | Delete one input and delete block from panel - delete one input | start-multi | Delete one input with `start-config-delete-input-btn`, save | input no longer shown on the Start node | n/a |
| CHN-S-STR-05b [C] | Delete one input and delete block from panel - delete the block | start-multi | Delete the block with `start-config-delete-btn` | Start node removed; empty overlay returns | prior run steps remain |
| CHN-S-STR-06 [C] | Cancel discards edits | start-literal | edit, `start-config-cancel-btn` | node unchanged | n/a |
| CHN-S-STR-07a [E] | Empty or duplicate input key is rejected - empty key rejected | start-dup | Try to save an input with an empty key | save disabled / role=alert; node unchanged | n/a (assert no run created) |
| CHN-S-STR-07b [E] | Empty or duplicate input key is rejected - duplicate key rejected | start-dup | Try to save two inputs with the same key | save disabled / role=alert; node unchanged | n/a (assert no run created) |
| CHN-S-STR-08 [E] | Env source with missing env var falls back to default | start-env (var absent) | Run | node ok | unresolved-vars footer if no default; else default used (`node-variables-footer-unresolved`) |
| CHN-S-STR-09 [X] | Second Start block is refused with toast | start-literal | Add Start from `block-menu-item-start` | still one Start; toast startBlockLimit | n/a |
| CHN-S-STR-10 [X] | Start cannot be an edge target | start-literal + delay | Drag delay output onto Start | no edge created | n/a |
| CHN-S-STR-11 [E] | Run-with-inputs popover resets to defaults after Reset and survives panel edit | start-multi | override one input, click reset (VERIFY control), edit default in panel, reopen popover | popover shows new default | Run Input uses new default, not stale override |

#### Delay node (6)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-DLY-01 [H] | Delay runs for its configured time | delay-short | Run | passed after >= 200 ms, followed by fast passed | Delay step passed with duration >= 200 ms |
| CHN-S-DLY-02 [C] | Edit value inline via `delay-value-btn` | delay-short | click, type 300, Enter | node shows 300 ms | next run duration >= 300 ms |
| CHN-S-DLY-03a [C] | Value persists across reload and undo restores - value persists reload | delay-short | Edit the delay value, reload | node shows the new value after reload | n/a |
| CHN-S-DLY-03b [C] | Value persists across reload and undo restores - undo restores previous value | delay-short | Edit the delay value, press Cmd+Z | node shows the original delay value | n/a |
| CHN-S-DLY-04 [E] | 0 ms delay passes immediately | delay-zero | Run | passed | duration near 0 |
| CHN-S-DLY-05 [E] | Invalid input (empty, negative, letters) is rejected | delay-short | type invalid values | value unchanged / clamped; no console error | n/a |
| CHN-S-DLY-06 [X] | Cancel during delay | delay-long | Run, wait for running badge, `stop-chain-btn` | delay aborted, downstream skipped | delay aborted DELAY_INTERRUPTED/RUN_STOPPED; fast skipped; run Stopped |

#### Condition node (13)
Each uses Start(score) -> Condition -> request per branch (branch targets are `fast`, `fail`, `echo`, so the taken branch is visible by passed vs skipped).
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-CND-01 [H] | `==` branch matches | cond-eq | Run | matching branch node passed, others skipped | Condition step passed with branch label; non-taken steps skipped UPSTREAM_SKIPPED |
| CHN-S-CND-02 [C] | `!=` operator | cond-neq | Run | other branch taken | same pattern |
| CHN-S-CND-03 [C] | `>` numeric | cond-gt | Run | taken | same |
| CHN-S-CND-04 [C] | `<` numeric | cond-lt | Run | taken | same |
| CHN-S-CND-05 [C] | `contains` | cond-contains | Run | taken | same |
| CHN-S-CND-06 [C] | Add and remove branches in panel, handles follow | cond-multi | open panel, add branch, remove one, save | handle count equals branches + else | n/a |
| CHN-S-CND-07 [C] | Else fallback when no branch matches | cond-else | Run | else path taken | step shows else |
| CHN-S-CND-08 [C] | Numeric vs string comparison (`"7" == 7`) | cond-eq | Run with Start 7 vs "7" | consistent outcome | n/a |
| CHN-S-CND-09 [E] | Unresolved variable in condition | cond-eq with absent input | Run | footer shows unresolved variable | `unresolved-vars` listed on step |
| CHN-S-CND-10 [X] | No branch matches and no else -> NO_BRANCH_MATCHED | cond-nomatch | Run | condition failed; descendants skipped | step failed NO_BRANCH_MATCHED, run Failed |
| CHN-S-CND-11a [C] | `>=` and `<=` boundary with value equal (links BUG-01) - >= boundary | cond-ge | Run with input 5 against `>= 5` | the `>=` branch passed, other skipped | Condition step names the taken branch |
| CHN-S-CND-11b [C] | `>=` and `<=` boundary with value equal (links BUG-01) - <= boundary | cond-ge | Run with input 5 against `<= 5` | the `<=` branch passed, other skipped | taken branch step passed, other branch step skipped |
| CHN-S-CND-12 [E] | Non-numeric operand with `>` does not throw: falls to else or NO_BRANCH_MATCHED | cond-gt (score "abc") | Run | stable outcome, no console error | step shows else or NO_BRANCH_MATCHED, never an uncaught error |
| CHN-S-CND-13 [E] | Branch label editing and reorder: first matching branch wins | cond-multi (two overlapping branches) | edit labels, Run | handle labels match edits | log shows first-listed branch taken, second skipped |

#### Display node (12)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-DSP-01 [H] | Extract token to header alias | disp-header | Run | all passed | Display step Extracted tab shows value |
| CHN-S-DSP-02 [C] | targetField url | disp-url | Run | passed | downstream URL uses value |
| CHN-S-DSP-03 [C] | targetField path | disp-path | Run | passed | path has value |
| CHN-S-DSP-04 [C] | targetField header | disp-header | Run | passed | header present |
| CHN-S-DSP-05 [C] | targetField body | disp-body | Run | passed | body has value |
| CHN-S-DSP-06 [C] | targetKey alias is readable as `{{alias}}` downstream | disp-header | Run | passed | resolved, no unresolved warning |
| CHN-S-DSP-07 [E] | Multiple inbound edges block the run (BUG-09, item 7) | disp-multi-in | Open chain | banner display-multiple-inputs | Run disabled |
| CHN-S-DSP-08 [X] | DISPLAY_NO_SOURCE (no inbound) | disp-nosrc | Run | Run blocked or failed per UI gate | error line DISPLAY_NO_SOURCE |
| CHN-S-DSP-09 [X] | DISPLAY_NO_PATH (empty JSONPath) | disp-nopath | Run | failed | DISPLAY_NO_PATH |
| CHN-S-DSP-10 [X] | DISPLAY_EXTRACT_FAILED (path misses) | disp-nopath variant | Run | failed, downstream skipped | DISPLAY_EXTRACT_FAILED |
| CHN-S-DSP-11 [C] | Display extractor path picker builds JSONPath from upstream response (DisplayExtractor) | disp-header | open Display panel, click a field in the formatted upstream body (VERIFY control), save | node shows path chip | Extracted tab shows picked value |
| CHN-S-DSP-12 [E] | Upstream failed: Display is skipped, not failed | disp-after-fail | Run | Display skipped (UPSTREAM_SKIPPED) | Display step skipped; request failed; run Failed |

#### Evaluate node (11)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-EVL-01 [H] | Default `return data;` passes through | eval-data | Run | passed | Output tab equals upstream body |
| CHN-S-EVL-02 [C] | Custom code transforms data | eval-ok | edit code, Run | passed | Extracted shows transformed value |
| CHN-S-EVL-03 [C] | Custom outputAlias consumed as `{{alias}}` | eval-ok | set alias, Run | passed | echo header holds alias value |
| CHN-S-EVL-04a [C] | Panel Test output renders result and error - Test shows result | eval-ok / eval-throw | Click `evaluate-test-btn` on eval-ok; assert `evaluate-test-output` | panel shows the computed output | n/a |
| CHN-S-EVL-04b [C] | Panel Test output renders result and error - Test shows error | eval-ok / eval-throw | Click `evaluate-test-btn` on eval-throw; assert `evaluate-test-error` | panel shows the error message | n/a |
| CHN-S-EVL-05 [C] | Alias used in URL query of downstream | eval-ok | Run | passed | URL contains value |
| CHN-S-EVL-06 [E] | Returns undefined | eval-undef | Run | failed | EVALUATE_UNDEFINED_OUTPUT |
| CHN-S-EVL-07 [X] | Code throws | eval-throw | Run | failed, downstream skipped | error line shows message |
| CHN-S-EVL-08 [X] | Infinite loop times out | eval-timeout | Run (long timeout) | failed | EVALUATE_TIMEOUT or TERMINATED |
| CHN-S-EVL-09 [X] | Alias collision shows role=alert | eval-alias-clash | open panel, set alias equal to existing | alert visible, save blocked | n/a |
| CHN-S-EVL-10 [E] | Syntax error in code is reported in panel Test and at run | eval-syntax | Test, then Run | `evaluate-test-error` visible; node failed | step failed with the syntax message |
| CHN-S-EVL-11 [X] | Sandbox isolation: access to `window`/`fetch`/`process` is unavailable (VERIFY engine behaviour; if ambiguous STOP and ask) | eval-throw variant | Run | failed | error names the missing global; no network call made (route counter 0) |

#### Validate node (9)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-VAL-01 [H] | Matching schema passes (default `{}`) | val-pass | Run | passed | Assertions/Output shows passed |
| CHN-S-VAL-02 [C] | Non-trivial schema passes (types, required) | val-pass | Run | passed | n/a |
| CHN-S-VAL-03 [C] | sourceJsonPath scopes validation | val-path-ok | Run | passed | validated subset in Input |
| CHN-S-VAL-04 [E] | No upstream | val-noup | Run | failed or blocked | VALIDATE_NO_UPSTREAM |
| CHN-S-VAL-05 [E] | Path matches nothing | val-nomatch | Run | failed | VALIDATE_NO_MATCH |
| CHN-S-VAL-06 [X] | Upstream body not JSON | val-badjson | Run | failed | VALIDATE_INVALID_JSON |
| CHN-S-VAL-07 [X] | Invalid JSONPath | val-badpath | Run | failed | VALIDATE_INVALID_JSON_PATH |
| CHN-S-VAL-08a [X] | Invalid schema JSON / invalid schema - invalid schema JSON | val-badschema | Open the panel with schema text that is not JSON, then Run | panel role=alert; node failed | VALIDATE_INVALID_SCHEMA_JSON |
| CHN-S-VAL-08b [X] | Invalid schema JSON / invalid schema - invalid schema | val-badschema | Run with JSON that is not a valid schema | node failed | VALIDATE_INVALID_SCHEMA |
| CHN-S-VAL-09 [E] | Failure message lists at most 3 errors with count of the rest | val-fail | Run | failed | Assertions tab shows 3 error lines plus "+N more"; matches UO:491 without duplicating it |

#### Merge node (8)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-MRG-01 [H] | all: both lanes pass then Merge passes | merge-all-ok | Run | merge passed after both | lanes 0 and 1, merge last |
| CHN-S-MRG-02 [H] | any: first lane resolves, other skipped | merge-any-ok | Run | slow lane skipped | MERGE_ALREADY_RESOLVED skipped |
| CHN-S-MRG-03 [C] | Toggle mode via `merge-config-mode-any-btn` / `-all-btn`, persists reload | merge-all-ok | toggle, reload | node label reflects mode | next run honours mode |
| CHN-S-MRG-04 [C] | any with first lane failing, second passing | merge-any-first-fail | Run | merge passed via second lane | failed lane + passed lane |
| CHN-S-MRG-05 [E] | One inbound edge shows banner and blocks Run | merge-single-in | open page | `canvas-banner-merge` visible; `run-chain-btn` disabled; Cmd+Enter no-op | no run created |
| CHN-S-MRG-06 [X] | all with a failing lane fails Merge | merge-all-fail | Run | merge failed, downstream skipped | merge failed with cause |
| CHN-S-MRG-07 [X] | Aborted in-flight lane under any is not counted | merge-any-ok | Run | state per BUG-12 | aborted vs skipped distinction |
| CHN-S-MRG-08 [C] | Merge output exposes aggregated lane results to downstream | merge-all-ok + echo | Run | echo passed | Merge Output tab lists both lane bodies; echo Input resolved |

#### Loop node (17)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-LOP-01 [H] | Three items iterate three times | loop-ok | Run | body passed, collect passed | 3 `iteration-toggle-*` |
| CHN-S-LOP-02 [C] | Custom itemAlias used in body URL | loop-ok | set alias `user`, body uses `{{user}}` | passed | Input shows per-item value |
| CHN-S-LOP-03 [C] | maxIterations lower than items | loop-ok | set 2 | passed | 2 iterations + loop-truncated warning |
| CHN-S-LOP-04 [C] | sourceJsonPath selects nested array | loop-ok on `/api/object` | set path | passed | iterations equal nested length |
| CHN-S-LOP-05 [C] | `{{index}}` available in body | loop-ok | Run | passed | index 0,1,2 in inputs |
| CHN-S-LOP-06 [E] | Empty array: zero iterations | loop-empty | Run | loop passed, body skipped/none | zero iteration rows, done handle continues |
| CHN-S-LOP-07a [E] | Cap 1000 / maxIterations out of range - above the 1000 cap | loop-max-cap | Enter 5000 as max iterations | panel clamps the value or shows role=alert | n/a |
| CHN-S-LOP-07b [E] | Cap 1000 / maxIterations out of range - zero iterations requested | loop-max-cap | Enter 0 as max iterations, then Run with that value | panel clamps the value or shows role=alert | LOOP_INVALID_MAX_ITERATIONS |
| CHN-S-LOP-08 [X] | Source not an array | loop-notarray | Run | failed | LOOP_SOURCE_NOT_ARRAY |
| CHN-S-LOP-09a [X] | Seeded invalid alias (`index`) fails at run time; panel also rejects it (BUG-16 owns panel UX) - panel rejects the alias | loop-alias-bad / loop-alias-index | Open the panel and enter `index` as the item alias | panel role=alert, save blocked | n/a |
| CHN-S-LOP-09b [X] | Seeded invalid alias (`index`) fails at run time; panel also rejects it (BUG-16 owns panel UX) - runtime fails with LOOP_INVALID_ALIAS | loop-alias-bad / loop-alias-index | Run the seeded chain whose alias is already `index` | loop node failed | LOOP_INVALID_ALIAS, body skipped |
| CHN-S-LOP-10 [X] | Failing iteration: loop still passed, warning | loop-iter-fail | Run | loop passed, warning chip | iteration rows mix passed/failed, `loop-iterations-failed` warning (BUG-06) |
| CHN-S-LOP-11 [X] | No upstream | loop-noup | Run | failed | LOOP_NO_UPSTREAM |
| CHN-S-LOP-12 [X] | Loop without paired collect blocks Run | loop-unpaired | open | `canvas-banner-loop-unpaired`; Run disabled | no run |
| CHN-S-LOP-13 [E] | Nested loops at depth 3 run (limit MAX_LOOP_NESTING_DEPTH) | loop-nested3 | Run | no banner, all passed | nested `iteration-toggle-*` three levels |
| CHN-S-LOP-14 [X] | Nested loops at depth 4 show `canvas-banner-loop-nesting-depth` and block Run; engine code LOOP_DEPTH_EXCEEDED when forced | loop-nested4 | open | banner visible; Run disabled | no run (gate). Forced path: SCHEDULER_DEPTH_EXCEEDED/LOOP_DEPTH_EXCEEDED asserted only if reachable from the UI (VERIFY) |
| CHN-S-LOP-15 [E] | Default maxIterations shown and applied when untouched | loop-ok | open panel | `loop-config-max-iterations` holds the default | n/a |
| CHN-S-LOP-16 [C] | Loop `done` output continues after Collect to a downstream request | loop-ok + tail | Run | tail passed after collect | tail Input uses collected array |
| CHN-S-LOP-17 [E] | Re-running a loop does not leave stale iterations | loop-ok | Run twice | second run has 3 iterations only | each run card shows its own 3 iterations |

#### Collect node (6)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-COL-01 [H] | Collect gathers iteration outputs | loop-ok | Run | collect passed after loop | step passed; Output array length 3 |
| CHN-S-COL-02 [C] | loopId pairing is shown and survives Mod+D of Loop (paired collect duplicated) | loop-ok | select Loop, Mod+D | two loops, two collects, both paired | n/a |
| CHN-S-COL-03 [E] | Collect of empty loop returns empty list | loop-empty | Run | passed | Output `[]` |
| CHN-S-COL-04 [X] | COLLECT_NO_LOOP_RESULT is skipped | loop-ok after removing loop edge | Run | collect skipped | skipped with code |
| CHN-S-COL-05 [X] | Unresolved collect shows banner and blocks Run | loop-ok + stray collect | open | `canvas-banner-collect-unresolved`; Run disabled | no run |
| CHN-S-COL-06a [E] | Collect panel shows its paired loop and re-pairs when the loop is deleted - panel shows paired loop | loop-ok | Open the Collect panel (`collect-config-loop`) | pairing label names the paired Loop | n/a |
| CHN-S-COL-06b [E] | Collect panel shows its paired loop and re-pairs when the loop is deleted - deleting the loop cascades to its paired collect (useChainStore removal cascade) | loop-ok | Delete the Loop | Loop and Collect nodes both gone; `canvas-banner-collect-unresolved` absent | no run |

#### Subchain node (11)
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-S-SUB-01 [H] | Parent runs child inline | sub-parent-ok | Run | subchain passed | nested rows under `subchain-toggle-*` |
| CHN-S-SUB-02 [C] | inputBindings with a literal | sub-parent-bind | Run | passed | child's Start input equals literal |
| CHN-S-SUB-03 [C] | inputBindings with an alias from upstream | sub-parent-bind | Run | passed | resolved alias in child |
| CHN-S-SUB-04 [C] | Change reference via SubChainPicker (`subchain-picker-dialog`, search, item) | sub-parent-ok | pick another chain | node label changes | next run uses new child |
| CHN-S-SUB-05 [E] | Child chain with no runnable nodes | sub-parent-empty | Run | failed or blocked per `invalidSubChain` | banner `subchain-invalid` or error |
| CHN-S-SUB-06 [X] | Deleted target gives SUBCHAIN_REFERENCE_UNRESOLVED | sub-parent-missing | open + Run | banner; Run blocked or failed | error code |
| CHN-S-SUB-07 [X] | Depth > 5 gives SUBCHAIN_DEPTH_EXCEEDED | sub-parent-deep6 | Run | failed | code visible at deepest nest |
| CHN-S-SUB-08 [X] | Child failure re-raised in parent | sub-parent-fail | Run | subchain failed, downstream skipped | nested failed step visible, parent failed |
| CHN-S-SUB-09 [E] | Self-reference is refused (SUBCHAIN circular / CIRCULAR_DEPENDENCY) | sub-parent-self | open + Run | banner or blocked Run | no run, or failed step with CIRCULAR_DEPENDENCY (observe and assert) |
| CHN-S-SUB-10 [C] | Picker excludes the current chain and searches by name | sub-parent-ok | open `subchain-picker-dialog`, search, list | current chain absent; filter works | n/a |
| CHN-S-SUB-11 [X] | Child step failure surfaces as SUBCHAIN_FAILED on the parent step | sub-parent-fail | Run | subchain node failed | parent step error line SUBCHAIN_FAILED; nested failed step visible |

#### Canvas interactions and graph validation (GR 8, CV 7)
Complements UO canvas tests (rename, shortcuts overlay, toolbar, align, find node, picker open) which stay as they are; these add the missing persistence, undo and banner coverage.
| ID | Title | Seed | Steps | Canvas | Run log |
|---|---|---|---|---|---|
| CHN-GR-01 | Undo/redo of add, delete and connect | api-single | add Delay, delete it, connect, `Mod+Z` x3, `Mod+Shift+Z` x3 | node/edge counts follow each step | run after redo: log shows the redone graph's steps |
| CHN-GR-02 | Positions, edges and config persist across reload | cx-01 (or api-inject-hdr) | drag a node, reload | position and edges identical | previous run still listed |
| CHN-GR-03 | Rename a node: label shows on canvas, in run log and survives reload | api-single | rename inline, Run, reload | new label | step row uses new label; search by new label finds it |
| CHN-GR-04 | Block picker search filters items and Enter adds the top match | api-single | open picker, type "loop", Enter | only matching items; node added at ghost position | n/a (run blocked by loop-unpaired banner) |
| CHN-GR-05 | Duplicate/paste keeps config and offsets; undo removes the copy (clipboard-supported types) | start-literal + delay-short | select Delay, `Mod+C`, `Mod+V` | copy +40px with same value | run: both Delay steps present |
| CHN-GR-06 | Connecting a node to itself is rejected with a drag-time status message ("This connection isn't allowed") | api-single | drag a node output onto its own input | no edge created | n/a |
| CHN-GR-07 | A duplicate connection is rejected with a toast | api-inject-hdr | connect the same source/target/handle again | edge count unchanged | n/a |
| CHN-GR-08 | An already-connected Loop body or done handle refuses a second connection | loop-ok | connect a second target to the occupied body handle | edge count unchanged, toast | n/a |
| CHN-CV-01 | `canvas-banner-cycle` blocks Run | cycle | open | banner; `run-chain-btn` disabled; `Mod+Enter` no-op | no run created |
| CHN-CV-02 | `canvas-banner-start-only` when only Start is on canvas | start-only | open | banner; Run disabled | empty state never-run |
| CHN-CV-03 | `canvas-banner-loop-body-unconnected` | loop-body-unconnected | open | banner; Run disabled | no run |
| CHN-CV-04 | `canvas-banner-loop-body-misses-collect` | loop-body-misses-collect | open | banner; Run disabled | no run |
| CHN-CV-05 | `canvas-banner-subchain-invalid` | sub-parent-empty | open | banner; Run disabled | no run |
| CHN-CV-06 | Engine CIRCULAR_DEPENDENCY / SCHEDULER_DEPTH_EXCEEDED are unreachable from the UI gate (VERIFY): assert gate blocks instead | cycle, deep chain | open | blocked by banner | no run |
| CHN-CV-07 | Banners clear when the cause is fixed (delete cycle edge, add paired Collect) | cycle, loop-unpaired | fix via UI | banner disappears; Run enabled | run passes |

Simple tier (S-*): API 20 + STR 11 + DLY 6 + CND 13 + DSP 12 + EVL 11 + VAL 9 + MRG 8 + LOP 17 + COL 6 + SUB 11 = **124**; GR 5 + CV 7 = **12**.

### 5.2 Medium tier (2-3 node types combined)
Each row is asserted on the canvas (badge, error strip, footer) AND the run log (order, state, tab content). Seeds `qa-e2e-med-*`. Edge path = `edge-status-label` / handle type.
| ID | Graph | Steps | Canvas | Run log |
|---|---|---|---|---|
| CHN-M-01 | users -> user-detail (inj `$[0].id` into `:id`) | Run | both passed | detail Input URL has id 1; Extracted lists `$[0].id` |
| CHN-M-02 | token -> echo (header + query injections) | Run | passed | Input shows both values |
| CHN-M-03 | fail -> echo (success edge) | Run | fail failed, echo skipped | echo UPSTREAM_SKIPPED; bar Failed 1 skipped 1 |
| CHN-M-04a | fail -fail-> recovery; fail -success-> never - fail handle routes to recovery | Run | recovery passed; fail edge labels show the fail routing | recovery step ran after the failed step |
| CHN-M-04b | fail -fail-> recovery; fail -success-> never - success edge from failed node is skipped | Run | success-routed follower skipped | skipped step shows its skip code |
| CHN-M-05 | fast -success-> A; fast -fail-> B | Run | A passed, B skipped | inverse of M-04 |
| CHN-M-06 | fail || fast (independent) | Run | one failed one passed | run Failed; counts 1/1; filters show each |
| CHN-M-07 | Start(score=9) -> echo -> Condition(`>5`) -> A/B | Run | A passed B skipped | Condition step branch A |
| CHN-M-08 | M-07 graph | Run-with-inputs score=1 | B passed A skipped | Input override visible; two runs distinguishable |
| CHN-M-09 | fast -> Delay(300) -> fast | Run | all passed | Delay duration >= 300; order 1,2,3 |
| CHN-M-10 | score -> Display(`$.score` as `s`) -> Condition(`{{s}} > 5`) | Run | branch by score 7 | Display Extracted `s=7`; branch taken |
| CHN-M-11a | Start -> Condition 3 branches + else - score 1 | Run with score 1 | first branch node passed, the rest skipped | run card lists the taken (first) branch |
| CHN-M-11b | Start -> Condition 3 branches + else - score 5 | Run with score 5 | second branch node passed, the rest skipped | run card lists the taken (second) branch |
| CHN-M-11c | Start -> Condition 3 branches + else - score 9 | Run with score 9 | third branch node passed, the rest skipped | run card lists the taken (third) branch |
| CHN-M-11d | Start -> Condition 3 branches + else - score 99 (else) | Run with score 99 | else node passed, branch nodes skipped | run card lists the else path |
| CHN-M-12 | Start -> two Conditions in parallel lanes | Run | each lane picks independently | lanes 0/1 each with own branch |
| CHN-M-13 | Condition A/B -> Merge(any) -> echo | Run | merge passed via taken branch; other skipped | merge step lane, MERGE_ALREADY_RESOLVED absent |
| CHN-M-14 | token -> Display(alias `tk`) -> echo(`{{tk}}` header) | Run | passed | echo Input header has token; no unresolved footer |
| CHN-M-15 | users -> Display a -> req1; users -> Display b -> req2 | Run | both passed | both aliases in respective Inputs |
| CHN-M-16 | users -> Evaluate(map names) -> echo | Run | passed | Evaluate Extracted array; echo Input has it |
| CHN-M-17 | score -> Evaluate(`data.score*2`) -> Condition | Run | branch by 14 | Evaluate Output 14; branch |
| CHN-M-18a | users -> Validate(pass) -> echo; users -> Validate(fail) -> echo - passing schema lets echo run | Run the validate-pass seed | Validate and the following echo request passed | both steps passed |
| CHN-M-18b | users -> Validate(pass) -> echo; users -> Validate(fail) -> echo - failing schema skips echo | Run the validate-fail seed | Validate failed, echo skipped | Validate failed with an error list; run Failed |
| CHN-M-19 | fast + medium -> Merge(all) -> echo | Run | echo after both | echo started after merge (order index) |
| CHN-M-20 | token -> Display a -> req b -> Display b -> req c | Run | all passed | alias propagation, zero unresolved |
| CHN-M-21 | list -> Loop -> echo -> Collect -> echo2 | Run | all passed | echo2 Input holds 3 collected items |
| CHN-M-22 | list -> Loop -> Condition(`{{index}} == 1`) -> A/B -> Collect | Run | loop passed | iteration rows show taken branches |
| CHN-M-23 | list -> Loop -> Evaluate(`index*10`) -> Collect | Run | passed | iteration outputs 0,10,20; collect array |
| CHN-M-24 | list -> Loop -> Delay(200) -> Collect | Run (concurrency 1) | passed | total duration >= 3*200, sequential iteration order |
| CHN-M-25 | Subchain(child returns alias) -> echo | Run | passed | echo Input has returned alias; nested rows |
| CHN-M-26 | Subchain whose child has Loop+Collect | Run | passed | nested toggles at two levels |
| CHN-M-27 | users -> Validate(fail schema) -> main; users -> recovery (plain edges, no fail handle; fail routing is API-node-only) | Run | Validate failed, main skipped, recovery passed, run Failed | Validate failed blocks only its own branch |
| CHN-M-28 | a -> b -> c | card menu "from here" at b | a skipped/not rerun | new run trigger label "from here", steps b,c only |
| CHN-M-29 | a -> b -> c | card menu "up to" at b | c not rerun | steps a,b only; trigger label |
| CHN-M-30 | token -> echo (inj) | single-node run on echo | echo ran alone, no injected value | trigger "single"; Input shows unresolved warning (BUG-10 documents) |
| CHN-M-31 | fast -> Delay(5000) -> fast | Run, wait running, Stop | first passed, delay aborted, last skipped | bar Stopped; counts 1/1 aborted/1 skipped |
| CHN-M-32 | cond-eq | Run, change Start value in panel, Run again | second run takes other branch | two run cards; old one unchanged |
| CHN-M-33 | Start -> Delay -> Condition -> Merge(any) | Run, cancel during Delay, re-run | first Stopped, second Passed | two run cards with statuses; no stale running badge |
| CHN-M-34 | list -> Loop -> echo -> Collect, 2 runs, reload | Run twice, reload | persisted | run list restores 2 runs and iteration toggles |
| CHN-M-35 | Request -> Subchain -> Request, rename child chain between runs | Run, rename child via collection, Run | picker/node label follows rename | both runs listed |

Medium total: **35**.

### 5.3 Complex tier (realistic end-to-end flows; results bar asserted throughout)
Each: assert bar state Running -> final, filters, nested rows, counts at end; each saved with `snap()`. Cross-cutting actions: partial failure, cancel, re-run.
| ID | Title | Seed (qa-e2e-cx-*) | Flow |
|---|---|---|---|
| CHN-C-01 | Auth to data pipeline | auth-pipeline | Start(user) -> token request -> Display(token alias) -> Request(users, header token) -> Validate(schema) -> Evaluate(summarise) -> Request(echo summary). Assert aliases chain; bar Passed; Extracted tab on Display, Evaluate; all 7 nodes on canvas passed |
| CHN-C-02 | Fan-out / fan-in with branching | fanout-merge | Start -> Condition(env flag) -> [A: 2 parallel requests -> Merge all -> Evaluate] / [B: Request -> Delay] -> final Request. Run twice (input flips branch): lanes visible, skipped branch counts, filters Passed/Skipped |
| CHN-C-03 | Loop with per-item validate and partial failure | loop-validate-partial | list-mixed -> Loop -> Request(`/api/item/{{item}}`) -> Validate -> Collect -> Evaluate(count passed). One iteration fails: loop passed with warning, collect handles, Failed tab shows nested failed row, run status per engine rule, bar shows failed count |
| CHN-C-04 | Nested loops with Condition and Subchain | nested-loops-sub | Loop(users, 3 items) -> Subchain(child: Loop(tags, 2 tags) -> Request(`/api/echo`) -> Collect) -> Condition(`{{index}} > 0`) -> Collect. Run. Assert: canvas all passed with no depth banner; run log shows 3 outer iteration toggles each containing a subchain toggle containing 2 inner iterations (total echo steps = 6); outer Collect Output length 3; bar Passed with step totals matching; filter Passed hides nothing, search `echo` returns 6 rows; Extracted tab on inner Collect shows 2 items |
| CHN-C-05a | Error recovery via fail handles - recovery chain | recovery / recovery-ok | Run `recovery`: Request A(500) -fail-> Request B(recovery) -> Merge <- Request C (success path). The recovery chain's Merge is mode `all` (with `any` the Merge fires on the first lane and cuts the slower in-flight one as skipped, so B and C could not both pass); recovery-ok keeps mode `any`. A failed (500), B and C passed, Merge resolved once both arrive; bar Failed; Failed tab lists only A; header status Failed |
| CHN-C-05b | Error recovery via fail handles - recovery-ok chain | recovery / recovery-ok | Run `recovery-ok` (A passes): fail branch B skipped, Merge resolved via C (success path); header status Passed |
| CHN-C-06 | Mixed concurrency stress with cancel | wide-cancel | Start + 4 parallel slow(1.5s) lanes + Condition + Loop(users) + Merge(all). Run; assert bar Running with progress and `stop-chain-btn`; assert at least 2 lanes running at once (distinct `step-lane-<n>`); Stop; running nodes aborted, unstarted skipped, run Stopped, bar and header Stopped, no response after stop mutates states; Re-run via card menu produces a new complete Passed run; run list shows Stopped then Passed |
| CHN-C-07 | Evaluate/Validate/Display gauntlet with every failure at once in parallel branches | gauntlet | Six parallel branches each ending in one error code (EVALUATE_UNDEFINED_OUTPUT, VALIDATE_NO_MATCH, DISPLAY_NO_PATH, HTTP_STATUS 500, NO_BRANCH_MATCHED, SUBCHAIN_REFERENCE_UNRESOLVED or LOOP_SOURCE_NOT_ARRAY). Failed tab lists all; search filters by code; each step error line correct; run Failed |
| CHN-C-08 | Subchain composition with bound inputs and re-run subsets | sub-compose | Parent: Start -> Subchain A(bind from Start) -> Subchain B(binds `{{name}}`/`{{city}}` from the same Start inputs; the child chain has no terminal alias to forward) -> Delay -> Request. Verify bindings; Re-run "from here" at B; "single" run of the last Request; three runs listed with distinct trigger labels |
| CHN-C-09 | Reload mid-history and persistence of a complex run | cx-fanout-merge (with a trailing Subchain so a nested group exists) | Run C-02 twice (inputs flip), reload. Assert run list restores both runs with trigger labels, nested toggles still expand, active filter resets to All, selected run is the latest, step detail Output renders, canvas badges restore from last run; then `clear-run-results-btn` clears badges but keeps both runs, and `Clear all runs` empties the list with graph intact |
| CHN-C-10 | Undo/redo and structural edits around a complex graph | cx-auth-pipeline | Run (7 passed). Delete the Evaluate node: run log chip marks removed node, Run still enabled but downstream request now has unresolved alias (footer) or banner; Run again: counts differ and Failed/Skipped shown; `Mod+Z` restores node and edges; Run: counts equal run 1; three runs listed, each card status correct. Redo and undo repeatedly produce no console error |

Complex total: **10**.

### 5.4 Run log / results bar (CHN-LOG)
Seeds: reuse `qa-polish-run-log`, `qa-polish-last-run` plus live runs on new seeds. Existing UO RUNLOG-1..28 cover layout; the NEW ones below add state breadth and behavior depth.
| ID | Title | Seed | Steps | Expect |
|---|---|---|---|---|
| CHN-LOG-01 | Idle: never-run chain shows `run-log-empty-*` and idle bar | polish-never-run | open | empty state kind never-run, bar "no runs" |
| CHN-LOG-02 | Running state: live step progress, spinner, `chain-running-indicator`, Stop visible | api-slow | Run | bar Running n/N; step running badge; Run button disabled |
| CHN-LOG-03 | Passed state everywhere | api-single | Run | card, header (`chain-passed-count`), bar |
| CHN-LOG-04 | Failed state everywhere with failed count | api-fail500 | Run | card/header/bar failed |
| CHN-LOG-05 | Skipped steps state and counts | bug-cond-ge (condition skips the other branch) | Run | skipped row styling, skipped tab count |
| CHN-LOG-06 | Aborted step state in a stopped run | delay-long | Run + stop | aborted row, Stopped tone, filter Failed includes aborted |
| CHN-LOG-07 | Filter tabs counts equal row counts per tab | polish-run-log failed run | click All/Passed/Failed/Skipped | rows match counts |
| CHN-LOG-08 | Zero-count tabs hidden | polish-run-log passed run | open | no Failed tab |
| CHN-LOG-09 | Active tab falls back to All when emptied (BUG-17) | api-fail500 | filter Failed, fix + re-run passing variant | All active |
| CHN-LOG-10 | Filter persists per selected run? changes when switching runs | polish-run-log | switch runs | defined behavior asserted |
| CHN-LOG-11 | Search by step label | cx-01 | type label | only matches; counts ignore search |
| CHN-LOG-12a | Search by error code and HTTP status - search by error code | cx-07 | Type an error code (`HTTP_STATUS`) in the search box | only rows with that error code shown |
| CHN-LOG-12b | Search by error code and HTTP status - search by HTTP status | cx-07 | Type the status `500` in the search box | only rows with HTTP status 500 shown |
| CHN-LOG-13 | Search no-match empty message and Esc clears | cx-01 | type gibberish; Esc | empty text then cleared |
| CHN-LOG-14 | Expand step shows Input tab content | api-inject-hdr | click step, Input | headers/URL present |
| CHN-LOG-15 | Output tab shows body (JSON pretty, raw text) | api-text | click | raw text |
| CHN-LOG-16 | Assertions tab pass and fail labels | api-assert-fail | click | labelled results |
| CHN-LOG-17 | Extracted tab lists injected values | api-inject-hdr | click | `injected-value` |
| CHN-LOG-18 | Loop iterations expand/collapse | loop-ok | `iteration-toggle-*` | rows toggle; nested step detail selectable |
| CHN-LOG-19 | Subchain nested expand/collapse | sub-parent-ok | `subchain-toggle-*` | nested rows |
| CHN-LOG-20 | Unresolved variables listed on step and footer | cond-eq (absent input) | Run | `unresolved-vars` and `node-variables-footer-unresolved` |
| CHN-LOG-21 | Delete a run then undo within 6s | polish-run-log | row menu delete, undo | restored |
| CHN-LOG-22 | Delete a run without undo and reload (BUG-14) | polish-run-log | delete, reload | stays deleted |
| CHN-LOG-23a | Clear all runs (menu, confirm cancel then confirm) - cancel keeps runs | polish-run-log | Clear all runs from the menu, cancel the confirm | all runs remain |
| CHN-LOG-23b | Clear all runs (menu, confirm cancel then confirm) - confirm clears runs | polish-run-log | Clear all runs from the menu, confirm | empty state shown; graph intact; pending deletes finalized |
| CHN-LOG-24 | Clear run results resets canvas badges but keeps history (header menu `clear-run-results-btn`) | api-single | Run, clear | badges gone; runs list retained |
| CHN-LOG-25 | Cancel via `stop-chain-btn` | api-slow | Run, stop | Stopped, no late response |
| CHN-LOG-26 | Cancel via Mod+. shortcut | api-slow | Run, Mod+. | same as 25 |
| CHN-LOG-27 | Cancel then immediate re-run works | api-slow | stop, run | second run Passed/Running, first stays Stopped |
| CHN-LOG-28 | Re-run full from card menu | polish-run-log | menu Re-run | new run, same trigger |
| CHN-LOG-29a | Re-run upTo / fromHere / single preserve subset - upTo | med-req3 | Run "up to" the middle node, re-run it from the run card menu | new run step set equals the original (up to) |
| CHN-LOG-29b | Re-run upTo / fromHere / single preserve subset - fromHere | med-req3 | Run "from here" at the middle node, re-run it from the run card menu | new run step set equals the original (from here) |
| CHN-LOG-29c | Re-run upTo / fromHere / single preserve subset - single | med-req3 | Run a single node, re-run it from the run card menu | new run contains only that node |
| CHN-LOG-30 | Re-run gated when anchor node deleted | polish-run-log deleted-anchor | open | Re-run disabled |
| CHN-LOG-31 | Page header LastRunStatus follows each state (`chain-history-label`, `chain-<kind>`) | api-single/fail | run both | label text/kind |
| CHN-LOG-32 | Dock stays consistent when graph edited mid-history (removed node chip) | api-single | run, delete node | chip, no crash (complements UO:2245) |
| CHN-LOG-33a | Dock height and collapse persist across reload (collapsed bar summary shows status) - collapse state persists | api-single | Run, collapse the dock, reload | dock still collapsed; bar summary shows the run status |
| CHN-LOG-33b | Dock height and collapse persist across reload (collapsed bar summary shows status) - dock height persists | api-single | Run, resize the dock, reload | dock height restored (complements UO:2245 resize) |
| CHN-LOG-34 | Run select dropdown switches runs and selected step resets | polish-run-log | open `RunSelect`, pick older run | summary header and rows swap; no stale step detail |
| CHN-LOG-35a | Run card shows trigger label (full, single, from here, up to) and duration - full label | med-req3 | Run the whole chain | run card shows the full trigger label and a duration |
| CHN-LOG-35b | Run card shows trigger label (full, single, from here, up to) and duration - single label | med-req3 | Run a single node | run card shows the single trigger label |
| CHN-LOG-35c | Run card shows trigger label (full, single, from here, up to) and duration - from here label | med-req3 | Run from a node ("from here") | run card shows the from-here trigger label |
| CHN-LOG-35d | Run card shows trigger label (full, single, from here, up to) and duration - up to label | med-req3 | Run up to a node | run card shows the up-to trigger label |
| CHN-LOG-36 | Virtualisation: more than 50 rows (VIRTUALIZE_THRESHOLD) still searchable and scrollable | loop-large (60 items via `/api/list-60`) | Run, search last item | row reachable; counts equal 60 iterations |
| CHN-LOG-37 | History cap of 50 runs per chain (MAX_RUNS_PER_CHAIN) prunes the oldest VERIFY | api-single | seed 50 runs, run once more | list length stays 50, newest first, oldest gone |
| CHN-LOG-38 | Step detail copy buttons and Escape closes detail pane | api-inject-hdr | open detail, copy, Esc | clipboard has value (VERIFY grant); pane closes |
| CHN-LOG-39 | Failed-run error summary in RunSummaryHeader names first failure and links to the step | api-fail500 | Run, click link | step selected and scrolled into view |

Run-log total: **39**.

### 5.5 Bug-verification scenarios (CHN-BUG; seeds `qa-e2e-bug-*`)
Procedure per bug: write the scenario asserting the DESIRED behavior; if it fails, the source is fixed in scope (minimal) and this test is the regression. If the current behavior is intentional (decision recorded in section 12) the test asserts documented behavior instead; ambiguous items require asking the user first (section 12.3). AF # in brackets.
| ID | AF | Scenario | Desired assertion |
|---|---|---|---|
| CHN-BUG-01a | 1 | Condition `>= 5` and `<= 5` with value 5 - >= with 5 | branch taken for `>= 5` with value 5 (or UI rejects the operator); never silent NO_BRANCH_MATCHED with no explanation |
| CHN-BUG-01b | 1 | Condition `>= 5` and `<= 5` with value 5 - <= with 5 | branch taken for `<= 5` with value 5 (or UI rejects the operator); never silent NO_BRANCH_MATCHED with no explanation |
| CHN-BUG-02a | 2 | Context menu vs Mod+D on Condition and Delay - Condition | on a Condition, the menu offers Duplicate and it matches Mod+D (decided, section 12 item 7) |
| CHN-BUG-02b | 2 | Context menu vs Mod+D on Condition and Delay - Delay | on a Delay, the menu offers duplicate exactly when Mod+D duplicates (decided, section 12 item 7) |
| CHN-BUG-03 | 3 | Select lone Collect, Mod+D | no orphan collect with empty loopId, or banner explains; Run state matches |
| CHN-BUG-04 | 4 | Delete a Collect alone | loop unpaired banner, Run disabled, undo restores |
| CHN-BUG-05a | 5 | Copy/paste Loop, Merge, Subchain, Collect, API - unsupported types skipped with toast | unsupported types (Loop, Merge, Subchain, Collect, API) are refused with toast clipboardSkipped; no nodes added |
| CHN-BUG-05b | 5 | Copy/paste Loop, Merge, Subchain, Collect, API - supported types paste at +40px | supported types (Delay, Condition, Display, Evaluate, Validate) paste at +40px offset |
| CHN-BUG-06 | 6 | Loop with failing iteration | DOCUMENT AS INTENDED (source comment marks it a product decision; no user question): loop node passed with `loop-iterations-failed` warning on canvas and log; failed iteration rows visible; chain status per engine rule. Test asserts exactly this and fails if behaviour changes |
| CHN-BUG-07 | 7 | Nested loops split across a subchain (loop depth 3 in parent, +1 in child) | Desired: limit enforced (LOOP_DEPTH_EXCEEDED or SCHEDULER_DEPTH_EXCEEDED surfaces as a failed step) or banner; never unbounded. Decided (section 12 item 7): loopDepth is forwarded across the Sub-chain boundary |
| CHN-BUG-08 | 8 | Bad JSONPath edge | target step FAILED with a visible extraction error line (section 12 item 7); run ends Failed |
| CHN-BUG-09 | 9 | Display with two inbound edges | Run is blocked by the display-multiple-inputs banner until one inbound edge is removed (section 12 item 7) |
| CHN-BUG-10 | 10 | Single-node run on an injected edge | toast warns that injections are ignored; step Input shows the unresolved variable warning (section 12 item 7) |
| CHN-BUG-11a | 11 | Ghost placement: Esc cancels; click on toolbar/UI does not place - Esc cancels placement | Esc cancels the pending placement; no stray node, node count unchanged |
| CHN-BUG-11b | 11 | Ghost placement: Esc cancels; click on toolbar/UI does not place - click on UI does not place | clicking a toolbar control does not place the pending block; no stray node |
| CHN-BUG-12 | 12 | Merge any with slow in-flight lane | DOCUMENTED (section 12 item 7): lane ends skipped on canvas, log row and summary (skipped 1, aborted 0); run Passed |
| CHN-BUG-13 | 13 | Dismiss a banner, edit graph (node-id signature changes) | banner reappears; dismiss persistence behaves as designed |
| CHN-BUG-14a | 14 | Run delete + undo + reload; clear runs with pending deletes - delete, undo, reload | delete a run, let the undo window pass, reload: run gone and undo not offered |
| CHN-BUG-14b | 14 | Run delete + undo + reload; clear runs with pending deletes - clear runs with pending deletes | clear runs while a delete is pending, reload: run list empty (pending delete finalized) |
| CHN-BUG-15 | 15 | Add two Start blocks; connect into Start | toast, single Start (overlaps S-STR-09/10: BUG-15 asserts the toast text and persistence after reload only) |
| CHN-BUG-16a | 16 | Loop alias `index` / `1abc` - alias index rejected by panel | panel rejects alias `index` (role=alert, save blocked); runtime LOOP_INVALID_ALIAS for the seeded invalid chain is owned by S-LOP-09b |
| CHN-BUG-16b | 16 | Loop alias `index` / `1abc` - alias 1abc rejected by panel | panel rejects alias `1abc` (role=alert, save blocked) |
| CHN-BUG-17 | 17 | Filter Failed then re-run passing | filter falls back to All, rows visible (overlaps LOG-09; BUG-17 asserts no stale empty list) |
| CHN-BUG-18a | 18 | Nudge/auto-layout/shortcuts during run; shortcuts in editable targets - nudge ignored while running | nudge and auto-layout keys are ignored while the chain is running; no node moves |
| CHN-BUG-18b | 18 | Nudge/auto-layout/shortcuts during run; shortcuts in editable targets - shortcuts ignored in editable targets | typing text containing shortcut keys in a focused input fires no canvas shortcut |
| CHN-BUG-19 | AC 5 | CANVAS-18 (UO:4700) React Flow warning #015 trips consoleGuard | root-cause: nudge/drag before node init; wait for node `data-id` ready + initialized state before keypress, or fix the source cause; passes with `--repeat-each=5` |

Bug total: **19**.

### 5.6 Cross-cutting (CHN-X, optional hardening; counted separately)
| ID | Title | Seed | Expect |
|---|---|---|---|
| CHN-X-01 | Persistence of every block type config across reload | polish-blocks | each node keeps its configuration after reload |
| CHN-X-02 | Undo/redo of each config edit | polish-blocks | each config edit is reverted and reapplied |
| CHN-X-03 | Responsive: run log at 390px width with a complex run | cx-fanout-merge | run log remains usable at phone width |
| CHN-X-04 | Keyboard-only: add, connect, configure, run, open a step | api-single | whole flow possible without a pointer |
| CHN-X-05 | Clear nodes after a run purges badges | api-single | canvas and badges reset |
| CHN-X-06 | Deep-link to an unknown chain id does not crash (VERIFY fallback UI) | none | page renders fallback title, no console error |

## 6. Source changes allowed (minimal testids; tracked in the implementation tasks)
Add `data-testid` for: Condition panel (`condition-config-variable`, `-branch-<id>-expression`, `-branch-<id>-label`, `-add-branch-btn`, `-remove-branch-<id>-btn`, `-save-btn`); Loop panel (`loop-config-source-path`, `-item-alias`, `-max-iterations`, `-save-btn`); Evaluate panel (`evaluate-config-code`, `-alias`, `-test-btn`, `-save-btn`); Validate panel (`validate-config-schema`, `-source-path`, `-save-btn`); Collect panel (`collect-config-loop`); NodeToolbar buttons; NodeContextMenu items; DeletableEdge delete (ArrowConfigPanel testids live in the arrow-config folder, see below); RunFilterTabs (`run-filter-tab-<kind>`); NodeAssertionsPanel controls (source, operator, value, enable toggle; names discovered in P0.2); arrow-config files `ArrowConfigPanelBody.tsx`, `InjectionEditor.tsx`, `DisplayExtractor.tsx` (handle type, injection row remove, extractor picker); `GeneralSection.tsx` (`chain-concurrency-input`). Also a consoleGuard allow-list for the expected 599 HTTP_STATUS mock `console.error` in CHN-S-API-12 (scoped helper in `qa.ts`, default behavior unchanged). Anything beyond testids requires a real-bug decision (CHN-BUG).

## 7. Testing strategy
- Framework: Playwright (chromium), specs in `e2e/qa/` tagged `@qa`; seeded via `seededPage`; hermetic network. UI-authored scenarios only where authoring itself is under test (CHN-S-STR, CHN-S-CND-06, S-SUB-04); everything else is seeded for speed and determinism.
- Determinism: slow-route delays only where cancel/running is needed; assert states with `expect.poll`/web-first assertions, never sleeps; each test independent; 2 workers.
- Each scenario asserts canvas (node badge, error strip, banner, handles, footer) AND run log (step state, error line/code, tab content, counts, bar). A scenario missing either surface is rejected in review.
- Gate: all of 202 existing + new tests green; new specs stable under `--repeat-each=3`; CANVAS-18 green; `qaSeedSchema.spec` green after `qa:seed:build`; `bunx tsc --noEmit` and lint clean at the end.

## 8. Boundaries
- Always: use `installChainRoutes`; add seeds to `chain-e2e.json` and rebuild `qa-seed.init.js` (never hand-edit it); `getByTestId`/role selectors; assert canvas + run log; fix real bugs with a regression test.
- Ask first: changing runner/engine behavior beyond bug fixes in 5.5; new dependencies; changing playwright config; dropping existing tests (dedupe).
- Never: use `npm`; run the server; commit; `waitForTimeout`; bypass `consoleGuard` globally; add chain features; write unit tests.

## 9. Core risk
Selectors for Condition/Loop/Evaluate/Validate/Collect panels (no testids today) and the unverified engine behaviors behind the 19 bug scenarios. Milestone 1 therefore delivers: testids (section 6), new seeds/routes/helpers, CHN-BUG-19 (CANVAS-18 green), then one Simple spec file end to end before fanning out.

## 10. Task phases (for PLAN/TASKS; authoritative order)
- Phase 0: Foundation. Testids, routes, seeds, helpers, consoleGuard allow-list, `qa:seed:build`, CANVAS-18 fix, vertical slice S-API-01.
- Phase 1: Simple specs (3 per-node files plus `chain-e2e-canvas.spec.ts` for GR/CV): API/Start/Delay, logic nodes, flow nodes, canvas/validation.
- Phase 2: Run log (47).
- Phase 3: Medium (40).
- Phase 4: Bug verification, fixes and regressions (26, BUG-19 lands in Phase 0).
- Phase 5: Complex (11).
- Phase 6: Cross-cutting, Gherkin <-> test parity check (`e2e/scenarios/chain/check-parity.sh`), matrix audit, dedupe.
- Phase 7: Static checks, walkthrough, full-suite and `--repeat-each=3` gate.
Each phase ends with a checkpoint running the full chain command from section 2.

## 11. Success criteria
- Counts (scenario IDs = Gherkin scenarios): Simple 140, Canvas/validation (GR+CV) 15, Medium 40, Complex 11, Run-log 47, Bug 26, Cross-cutting 6 = **285 IDs** (244 base IDs + 35 from 30 sub-ID splits + 6 additions: S-API-21/22, GR-06..08, X-06). Final suite about 487 tests (202 existing + 285 new), minus 4 deduped.
- Full chain e2e suite green; zero flaky across `--repeat-each=3`.
- Matrix (section 4) has no empty cell; every one of the 11 node types has H, C, E, X scenarios each asserted on canvas and log.
- All 26 bug scenarios resolved: fixed with regression or documented as intended.

## 12. Resolved decisions
1. **Assertions (S-API-13, LOG-16):** decide per scenario. UI authoring for the API-node assertion-config scenarios (the config itself is under test); seeded config everywhere else.
2. **Condition `>=` / `<=`:** SUPPORT them. Treated as a bug: fix the evaluator and add a regression test (CHN-BUG-01 asserts `>=`/`<=` with value 5 takes the branch; also covers boundary and non-numeric operands).
3. **Ambiguous suspected bugs** (e.g. loop "passed" with failed iterations, bad extraction path => "skipped", subchain loop depth, Mod+D duplicate inconsistencies): the implementer MUST STOP and ask the user, one item at a time via AskUserQuestion, before changing behaviour. Until answered, the CHN-BUG test for that item is written but marked `test.fixme` with the question recorded. Clear bugs (unambiguous defect, e.g. `>=`/`<=`) are fixed automatically with a regression test.
4. **Console guard:** add a narrowly-scoped allowlist entry for the expected 599 mock error only (the exact `console.error` emitted by `installChainRoutes` for unmocked hosts, used by CHN-S-API-12). Default guard behaviour is unchanged for every other message and test.
5. **Dedupe:** remove the 4 overlapping existing tests identified in section 4: CS:2605 (Start override), CS:2757 (Evaluate flow), CS:3217 (3-item loop), CS:3125 (parallel lanes). Their coverage is retained by UO:409, UO:454, UO:518 and PM:16 respectively. Removal happens only in the final cross-cutting phase, after the full suite is green.
6. **Review addendum (source-verified):** (a) BUG-06 is an intentional product decision in the Loop executor (iteration failures yield a passed loop plus warning): document as intended, no user question. (b) BUG-16: the Loop panel already rejects invalid aliases; runtime also returns LOOP_INVALID_ALIAS. (c) Chain concurrency is configured on `/settings` (GeneralSection), not on the chain page. (d) The `installChainRoutes` 599 envelope is an HTTP_STATUS failure; REQUEST_FAILED needs a `route.abort()` endpoint (`/api/abort`). (e) Banner types in source: cycle, merge, start-only, loop-unpaired, collect-unresolved, loop-nesting-depth, loop-body-unconnected, loop-body-misses-collect, subchain-invalid. (f) BUG-07 stays ambiguous (STOP and ask) and references LOOP_DEPTH_EXCEEDED / SCHEDULER_DEPTH_EXCEEDED.
7. **Phase 4 bug decisions (code-analysed; supersede "STOP and ask" in item 3 and 6(f) and the "pending product decision" wording in 5.5 rows). Implementers proceed without asking; each test asserts the DESIRED behaviour below, no `test.fixme`.**
   - **BUG-02 (Duplicate on Condition/Delay): FIX, support Duplicate in both menu and Mod+D.** Mod+D already duplicates them (`useChainStore.duplicateNode` default branch clones the block). Cloning is safe: Condition `branches[].id` are only matched together with the owning node id (`edge.sourceRequestId` + `branchId`), and edges are not cloned. Change `canDuplicate` to `true` for `condition` and `delay` in `src/components/chain/blockRegistry.ts` (single source of truth; the menu in `NodeContextMenu.tsx` and the guard in `ChainCanvasPanels.tsx` read it). No other source change. Test: menu shows Duplicate on both, click and Mod+D each add exactly one copy with the same config and no copied edges.
   - **BUG-06 (Loop passed with failing iterations): DOCUMENT AS INTENDED, no source change.** Confirmed in `executors/loop.ts` (comment "product decision", `loop-iterations-failed` warning). Test asserts: loop node passed with warning on canvas and log, failed iteration rows visible under the Failed filter, chain status derived by the existing rule (`hadFailure` in `hooks/useChainRun.ts` is set by any step update with state `failed`, so a run containing failed iteration steps is Failed; assert whatever the seeded run actually yields and pin it).
   - **BUG-07 (loop depth across a subchain): FIX, propagate `loopDepth` across the Sub-chain boundary.** `schedulerDepth` already propagates through `runNestedChain` but `loopDepth` does not (the Loop executor adds 1 to `context.loopDepth`; `runSubChainNode` and `SubchainExecutorContext` never forward it), so a depth-3 loop in the parent plus a loop in the child starts at depth 0. Fix: forward `loopDepth: env.opts.loopDepth ?? 0` in `runSubChainNode` (`src/lib/chainRunner.ts`), add `loopDepth?: number` to `SubchainExecutorContext` and pass `loopDepth` to the nested `runChain` in `runNestedChain` (`src/lib/chainRunner/executors/subchain.ts`). Result: the inner Loop fails with `LOOP_DEPTH_EXCEEDED` (surfaces as a failed step re-raised on the Sub-chain step). The authoring-time banner (`loop-nesting-depth`) stays within a single graph; no cross-chain banner. Update `subchain.spec.ts` with a unit case.
   - **BUG-08 (bad JSONPath on edge): FIX, the target step FAILS instead of being skipped.** In `executors/apiExecutor.ts` the extraction-failure branch calls `onUpdate(nodeId, "skipped", ...)` and records `state: "skipped"`; change both to `"failed"` (keep `EXTRACTION_FAILED` code and `ERROR_KIND.EXTRACTION`, which `ChainNode.tsx` already renders as "extract failed"). This matches Validate, Loop and Display, which already fail on extraction errors. The run then ends Failed (`hadFailure`), downstream normal edges are blocked, and a `fail` handle on that node fires. Update the affected `apiExecutor.spec.ts` assertions. Condition keeps its existing behaviour (no matching branch fails).
   - **BUG-09 (Display with two inbound edges): FIX, block Run with a validation banner (not "first edge only").** Display reads one source (`displayExecutor` uses `incomingEdges[0]`), so a second inbound edge is silently ignored and ordering-dependent. Follow the existing blocker pattern: add `getMultiInboundDisplayIds(blocks, edges)` beside the other validators in `components/chain/canvas/hooks/chainConnectionRules.ts`; expose `multiInboundDisplayIds` from `app/chain/[collectionId]/useChainStructureValidation.ts`; add `hasMultiInboundDisplay` and reason `displayMultipleInputs` to `lib/chainRunBlock.ts` (and the reason-to-message map in `ChainPageHeader.tsx`); add banner type `display-multiple-inputs` in `CanvasBanner.tsx` and an entry in `ChainValidationBanners.tsx`; add en/fr/ja `messages/*/chain.json` keys (message plus run-blocked reason). Persisted/seeded chains are covered because this is a graph check, not a connect-time guard. Test: banner visible, Run disabled with the reason, deleting one edge clears both.
   - **BUG-10 (single-node run on an injected edge): FIX as a visible warning, no resolution from the last run.** `handleRunSingleNode` in `hooks/useChainRun.ts` runs with `edges: []`, so injections are dropped (silently when the request has no `{{alias}}` placeholder). Resolving from the previous run would require seeding `runChain` with an initial `runState`, which the engine does not support, so it is out of scope. Fix: in `handleRunSingleNode`, count the node's incoming extraction edges that carry injections (small pure helper next to `filterGraphByNodeIds` in `lib/chainRunner/runGraph.ts`) and, when greater than zero, show `toast.warning` with a new `chain.json` message (en/fr/ja) such as "Injections from upstream nodes are ignored when running a single node. Use Run up to here to include them." The existing unresolved-variable warning on the step Input remains and is asserted too. Test asserts the toast and the unresolved warning, and that the request ran alone.
   - **BUG-12 (Merge "any" with in-flight lane): DOCUMENT AS INTENDED, lane ends `skipped` (not `aborted`), no source change expected.** The engine already vocabulary-aligns: `scheduler.settleNode` records a cut lane as `skipped` with `MERGE_ALREADY_RESOLVED` after `schedulerLanes` mutes the lane's own terminal update, and `aborted` is reserved for a user Stop. Existing `e2e/qa/parallel-merge.spec.ts` already asserts skipped count 1 and no failed count. CHN-BUG-12 must additionally assert the same state on the canvas node, in the run log row and in the summary counts (skipped 1, aborted 0), run status Passed. If the log or canvas shows `aborted` or `running` for that lane, treat it as a defect and fix in `scheduler.ts` (`settleNode`/`cutLane`) or `stepRecording.ts`. CHN-S-MRG-07 resolves the same way ("aborted vs skipped distinction" = skipped).
