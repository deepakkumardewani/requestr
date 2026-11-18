# Chain E2E: infrastructure and coverage analysis

Branch: feature/chaining-ui-overhaul. Read-only analysis; generated 2026-10-04.

## 1. Playwright setup

- Config: `playwright.config.ts`. `testDir: ./e2e`, `testIgnore: **/_*.spec.ts` (so `e2e/qa/_template.spec.ts` is a copy-me skeleton), `fullyParallel: true`, workers = 1 on CI, otherwise 2 (more workers cause flaky timeouts against the prebuilt server), retries 2 on CI only, reporter `html`, trace `retain-on-failure`, single project `chromium` (Desktop Chrome).
- baseURL: `PLAYWRIGHT_TEST_BASE_URL ?? http://127.0.0.1:3000`. If that env var is set, `webServer` is disabled. Otherwise two webServers start (both `reuseExistingServer` outside CI): `bun run build && bun run start` on :3000 (production build, deliberately not `next dev`), and `bash scripts/run-socketio-echo.sh` on :3333 (local Socket.IO echo).
- Browsers: Chromium headless shell was NOT installed on this machine; `bunx playwright install chromium` was needed before any test could run.
- Scripts (package.json): `test:e2e` = `playwright test`; `test:e2e:ui`; `test:qa` = `playwright test --grep @qa --reporter=line`; `qa:seed:build` = `bun scripts/build-qa-seed-js.ts && biome check --write e2e/fixtures/qa-seed.init.js`.
- Run examples: `bunx playwright test e2e/chain.spec.ts`, `bunx playwright test e2e/qa/<feature>.spec.ts [--repeat-each=2]`, `bun run test:qa`. With a server already running: `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test ...`.

### Layout of `e2e/`

- Flat per-area specs: `auth, body, chain, collections, environments, graphql, history, home, requests, response, settings, socketio, tabs, websocket .spec.ts`. Plain specs import from `@playwright/test`.
- `e2e/qa/`: seeded walkthrough specs tagged `@qa` (`chaining-ui-overhaul.spec.ts` 4913 lines, `parallel-merge.spec.ts`, `_template.spec.ts`).
- `e2e/scenarios/*.feature.md`: Gherkin-style scenario docs per area (`chain.feature.md` has 105 scenarios). Markdown, `## Scenario:` headings, Given/When/Then, not executable.
- `e2e/fixtures/`: `qa.ts`, `qaSeed.ts`, `qaHelpers.ts`, `chainRoutes.ts`, `qa-seed.init.js` (generated, never hand-edit), `README.md`, `seed/*.json` + `seed/index.ts`.
- `e2e/dummyjson-api-reference.md`: reference for the real dummyjson API used by non-chain specs.

### Fixtures, helpers, conventions

- `fixtures/qa.ts` exports `test`/`expect` extended with: `seededPage` (seeds IndexedDB via init script before first navigation), `consoleGuard` (auto: fails ANY test on console error, console warning or pageerror, unfiltered), `snap(name)` (screenshot to `agent_docs/qa/<spec-basename>/<name>.png`).
- `fixtures/qaSeed.ts` `seedQaData(page)`: `page.addInitScript` opens the IDB (name/version/stores from `src/lib/idbSchema.ts`), puts environments, collections, requests, folders, history, chains, chainRuns, legacy `chainConfigs`, and a legacy standalone chain. Guarded by sessionStorage flag `e2e-qa-seeded` so reloads do not re-seed.
- `fixtures/qaHelpers.ts` exports: `openTab, createCollection, saveRequestToCollection, createChain, addApiRequest, addApiRequestViaBlockMenu, countIdbRecords, seedSyntheticRequests`. Layout helper picks `[data-testid=desktop-layout|mobile-layout]` by viewport width 768.
- `fixtures/chainRoutes.ts` `installChainRoutes(page)`: see section 2.
- No page-object classes; specs use inline helper functions (chain.spec.ts has ~400 lines of local helpers before the describe).
- Selectors: `getByTestId` dominates (452 uses in chain.spec.ts), plus `getByRole`. Template rules: no `waitForTimeout`, no CSS selectors, one `test()` per checklist item, end with `snap()`, never bypass consoleGuard.
- Naming/tags: describe titles end in `@qa` for the seeded suite (e.g. `"Chain UI polish — P3 @qa"`); test titles carry requirement IDs as prefixes (`CANVAS-n`, `RUNLOG-n`, `EMPTY-n`, `PICKER-n`, `PERSIST-n`). `chain.spec.ts` tests are untagged and not seeded: `beforeEach` clears the chains/collections/history/tabs IndexedDB stores and builds state through the UI. `socketio.spec.ts` uses `describe.configure({mode:"serial"})`.

## 2. QA seeded data and network

- Seeds: `e2e/fixtures/seed/*.json`, merged by `loadSeedData()` in `seed/index.ts` (array keys merged and deduped by `id`, duplicates throw; scalar/object keys must be unique). Adding a file needs `bun run qa:seed:build` to regenerate `qa-seed.init.js` (used by `agent-browser --init-script`); `src/lib/qaSeedSchema.spec.ts` fails if drifted. IDB_VERSION is 5.
- Files: `base.json` (env `qa-env-1` with `baseUrl`, collection `qa-collection-1`, requests), `chaining.json`, `chain-polish.json`, `chain-polish-layout.json`, `chain-polish-canvas.json`, `chain-polish-picker.json` (also collections, folders, requests, history).
- Chain shape: `{id, scope:"standalone", schemaVersion:5, name, blocks[], nodeIds[] (request ids), edges[], nodePositions}`; edges may carry `injections` (`sourceJsonPath` -> `targetField`/`targetKey`).
- Network: hermetic. `installChainRoutes` does `page.route("/api/proxy")`, parses the proxy payload URL, and fulfils by exact pathname with the proxy envelope (HTTP 200 wrapping `{status,statusText,headers,body}`): `/api/slow` (5000ms delay, 200), `/api/fast` (200), `/api/fail` (target 500), `/api/list` (3 items), `/api/token` (`data.token="secret-token-abc"`), `/api/echo` (echoes request headers/url). Any other target gets status 599 and `console.error`. So no live APIs for chain specs. Non-chain specs (requests, response, etc.) call real dummyjson/GraphQL; socketio uses the local echo on :3333.

### Chain seeds (request nodes use ids like `qa-req-*`; blocks are non-request nodes)

chaining.json:
- `qa-chain-mapping`: qa-req-users -> qa-req-user-detail, 1 edge with injection `$[0].id` -> path `id`, url `{{baseUrl}}/users/:id`.
- `qa-chain-failing`: qa-req-fail.
- `qa-chain-slow`: qa-req-slow (5s).
- `qa-chain-run-log`: qa-req-fast, qa-req-fail, no edges.
- `qa-chain-undo`: qa-req-undo-a, qa-req-undo-b.
- `qa-chain-shortcuts`: qa-req-shortcuts.
- `qa-chain-start-inputs`: Start block (`qaToken`) + qa-req-echo.
- `qa-chain-evaluate`: qa-req-token -> Evaluate -> qa-req-echo-eval (2 edges).
- `qa-chain-validate`: qa-req-fast -> Validate (schema, 3 missing fields).
- `qa-chain-loop`: qa-req-list -> Loop -> qa-req-fast -> Collect (3 edges).
- `qa-chain-parallel-lanes`: qa-req-parallel-slow, qa-req-parallel-fast, unwired.
- `qa-chain-merge-all`, `qa-chain-merge-any`: slow + fast requests into a Merge block (2 edges; mode all / any).
- `qa-chain-subchain-target`: qa-req-sub-body.
- Plus `legacyChainConfig` and `legacyStandaloneChain` for migration tests.

chain-polish.json (chains / chainRuns):
- `qa-polish-blocks`: all block types: Start, 2 Delay, Condition, Evaluate, Validate, Merge, Loop, Collect, Subchain, Display + qa-req-users, qa-req-user-detail (2 edges).
- `qa-polish-start-only`: Start.
- `qa-polish-last-run`: users, fail, fast + Delay (3 edges); runs `qa-polish-run-last` (failed, 4 steps) and `qa-polish-run-older` (passed, 3).
- `qa-polish-never-run`: users, fast (1 edge).
- `qa-polish-zero-step-run`: users; run with 0 steps.
- `qa-polish-empty`: nothing.
- `qa-polish-delay-only`: 1 Delay.
- `qa-polish-source-handles`: Start, Condition, 2 Loop, Delay (2 edges).
- `qa-polish-run-log`: users, fail, fast (2 edges); runs: failed(3), passed(3), from(2), upto(2), stopped(3), deleted-anchor(1), zero(0), skipped(3), single(1).
- `qa-polish-run-cap`: same requests; 50 runs `qa-polish-cap-00..49` (failed every 7th) for the history cap.
- `qa-polish-many-steps`: same requests; one 120-step run.

chain-polish-layout.json: `qa-polish-layout` (Start + 4 Delay, 3 edges), `qa-polish-60-nodes` (Start + 59 Delay, 59 edges).
chain-polish-canvas.json: `qa-p5-canvas` (qa-req-users + 3 Delay, 2 edges), `qa-p5-many` (60 Delay, 0 edges).
chain-polish-picker.json: `qa-pk-chain` (Start + qa-pk-c-1, qa-pk-c-2) plus extra collections/folders/requests/history for picker tests (150-request collection, nested folders, corrupt parents, etc.).

## 3. Existing chain specs

Totals: `e2e/chain.spec.ts` 71 tests, `e2e/qa/chaining-ui-overhaul.spec.ts` 126 tests, `e2e/qa/parallel-merge.spec.ts` 5 tests. Also incidental chain mentions in `settings.spec.ts` and `socketio.spec.ts` (not chain suites). Titles below were extracted mechanically (line number = definition line); the title text states what is asserted.

Node types exercised: API request, Start, Delay, Display, Evaluate, Validate, Condition, Loop, Collect, Merge, Sub-chain (Condition/Merge/Subchain in canvas-level or seeded form; chain.spec.ts adds Delay/Display/Evaluate/Validate/Condition via the block menu and checks they appear, Condition config saves). Run log states covered: running, passed, failed, stopped, skipped, zero-step, 120-step virtualization, 50-run cap, persistence across reload, filters, Re-run, keyboard listbox, resize/persist, a11y/contrast. Interactions: picker (tabs, search, multi-select, cURL, blank, folders, recent, virtualization), undo/redo, copy/paste, duplicate, marquee, align/distribute, snap, find, nudge, tips, context menus, shortcuts overlay, auto-layout.

### Suites by file

#### `e2e/chain.spec.ts`

- L411: [SUITE] "Chain"
- L428:  test("Create a standalone chain via the Create New dropdown"
- L443:  test("Chain page shows empty state when no APIs have been added"
- L459:  test("Run Chain button is disabled when the chain has no requests"
- L472:  test("Clear edges is in the header overflow menu and disabled with no edges"
- L486:  test("Rename a standalone chain from the sidebar"
- L509:  test("Delete a standalone chain from the sidebar"
- L546:  test("Open the API picker dialog from the empty state Add API button"
- L562:  test("API picker dialog has Collections and History tabs"
- L579:  test("API picker Collections tab shows empty state when no collections exist"
- L598:  test("API picker History tab shows empty state when no history exists"
- L617:  test("Dismiss the API picker dialog with Escape"
- L639:  test("Add multiple API nodes and verify request count updates"
- L691:  test("Block menu shows all five block types"
- L746:  test("Add a Delay block and verify it appears on the canvas with default delay"
- L777:  test("Add a Display block and verify it appears on the canvas"
- L809:  test("Add an Evaluate block and verify it appears on the canvas"
- L838:  test("Add a Validate block and verify it appears on the canvas"
- L867:  test("Add a Condition block and verify the config panel opens automatically"
- L898:  test("Condition block config panel can be saved and node remains on the canvas"
- L939:  test("Run a chain with a single API node shows passed count in header"
- L969:  test("Run a chain with multiple API nodes shows correct pass count"
- L1020:  test("API node shows failed count in header when request returns an error status"
- L1051:  test("Clear edges removes connections but keeps nodes on the canvas"
- L1133:  test("Add an API from a collection to the chain via the picker"
- L1197:  test("Picker shows labeled tabs and Enter on the lone active row adds it"
- L1231:  test("Picker marks a request already on the canvas as In chain"
- L1265:  test("Multi-add from the picker is undone with a single Cmd+Z"
- L1322:  test("Chain fixture provides deterministic responses without external requests"
- L1376:  test("Failing node shows an error strip on the canvas node"
- L1441:  test("Stop cancels a slow run and marks it stopped without a late response"
- L1482:  test("Right-clicking a Display node shows its own context menu"
- L1533:  test("Mapping data across an edge injects the value into the target request"
- L1657:  test("A request using {{baseUrl}} resolves against the active environment in a chain run"
- L1729:  test("Run log history survives a page reload"
- L1798:  test("Deleting a chain removes its persisted runs"
- L1856:  test("Run log dock opens automatically when a run starts"
- L1921:  test("Collapsed run log bar summarizes the last run and expands on click"
- L1946:  test("Clear all runs is in the run log options menu and confirms first"
- L1975:  test("Footer hints are hidden while the run log is expanded and return when collapsed"
- L1998:  test("Filtering the steps timeline by Failed hides non-failed steps"
- L2066:  test("Sub-chain steps appear nested and expandable under the Sub-chain step in the run log"
- L2173:  test("Each step-detail tab (Input/Output/Assertions/Extracted/Error) renders when selected"
- L2223:  test("Step-detail Input and Output tabs show the failed step's request and response content"
- L2269:  test("Clicking a step in the timeline selects the corresponding canvas node"
- L2317:  test("Deleting a node then pressing Cmd+Z restores it"
- L2379:  test("Dragging a node then pressing Cmd+Z returns it to its prior position"
- L2428:  test("? opens the shortcuts overlay showing the Chain canvas group"
- L2463:  test("Cmd+Shift+K opens the block menu while Cmd+K still opens the command palette"
- L2499:  test("Copy/paste reproduces blocks"
- L2542:  test("Adding a Start block and declaring inputs shows them on the canvas node"
- L2605:  test("A Start input override reaches a downstream request header"
- L2708:  test("Run with inputs button is hidden until the chain has a Start block"
- L2757:  test("Evaluate node result is injected into a downstream request header"
- L2890:  test("A literal {{alias}} typed directly into a request field resolves via a non-adjacent alias"
- L3060:  test("Validate node fails the chain when the response doesn't match the schema"
- L3125:  test("Two independent branches both run, concurrently rather than sequentially"
- L3217:  test("Loop over three items shows three iterations"
- L3382:    test(`Toolbar stays reachable on a ${block} block (hover card, move up, click Remove)`
- L3407:  test("Two stacked nodes: the upper node's body is still clickable"
- L3438:  test("Start default output handle connects to a Delay"
- L3463:  test("Clear all nodes then undo/redo in one step each, header follows node count"
- L3503:  test("Clear edges confirmation says the action is undoable"
- L3532:  test("Right-click on the empty pane adds a block at the click point"
- L3554:  test("Drag off a handle onto empty pane adds a connected block, one undo removes both"
- L3593:  test("Run is disabled for a Start-only chain and enabled for a lone Delay"
- L3619:  test("Empty overlay returns after clear-all and undo restores the nodes"
- L3675:  test("Marquee selects nodes and Align left lines them up"
- L3731:  test("Cmd+F with canvas focus opens Find node and Enter selects the node"
- L3756:  test("Arrow nudge moves the selection and one undo reverts the whole burst"
- L3786:  test("Hide tips persists after reload and Show tips restores them"

#### `e2e/qa/chaining-ui-overhaul.spec.ts`

- L38: [SUITE] "Chaining UI overhaul — QA walkthrough @qa"
- L39:  test("Legacy chain migrates and renders"
- L57:  test("Legacy standalone chain migrates and renders with nodes and positions intact"
- L80:  test("Edge click maps data, the value is injected, and {{baseUrl}} resolves"
- L162:  test("Error strip and Error tab show a failure"
- L199:  test("Stop cancels a slow run"
- L224:  test("Run log opens, filters, all five tabs show their content, selection syncs both ways, survives reload"
- L325:  test("Cmd+Z restores a deleted node"
- L359:  test("`?` overlay lists aliases; block-menu, `/` and select-all bindings fire; Cmd+K stays the palette"
- L409:  test("Start input override reaches a downstream request header"
- L454:  test("Evaluate result flows into a header"
- L491:  test("Validate lists three errors"
- L518:  test("A 3-item loop shows 3 iterations"
- L542:  test("Enter on a keyboard-focused Loop block opens its config panel"
- L567:  test("Two parallel branches render in two distinct lanes"
- L607:  test("Sub-chain steps nest"
- L657:    test(`L auto-layouts ${chainId} and the page stays responsive`
- L699:  test("Cmd+D on a selected API request node duplicates it"
- L807: [SUITE] "Chain UI polish — P1 @qa"
- L808:  test("CANVAS-1: the hover toolbar stays reachable on every block type"
- L823:  test("CANVAS-1: a node 20px above another keeps its body clickable"
- L844:  test("CANVAS-2: Start exposes one default output handle that can be wired"
- L861:  test("CANVAS-3: Clear all nodes confirms, cancels cleanly, and empties the chain"
- L891:  test("CANVAS-4: Clear edges says it is undoable and Cmd+Z brings the edges back"
- L913:  test("CANVAS-5: run badges are pruned with their node and not resurrected by undo"
- L947:  test("CANVAS-6: the header shows the persisted last run and opens it"
- L977:  test("CANVAS-7: the header counts nodes, not requests"
- L988:  test("CANVAS-8: Clear run results resets badges and keeps history"
- L1016:  test("CANVAS-9: toolbar tooltips show the registry shortcut"
- L1034:  test("RUNLOG-7: the header's relative time ticks and its tooltip shows the absolute time"
- L1055:  test("RUNLOG-8: counts read as words, not glyphs"
- L1124: [SUITE] "Chain UI polish — P2 @qa"
- L1125:  test("EMPTY-1: a Delay-only chain shows the canvas; an empty chain keeps the canvas under the overlay"
- L1142:  test("EMPTY-2: the overlay is a compact card with two buttons and no quick-add grid"
- L1169:  test("EMPTY-3: Add Start lands at the viewport center, the overlay and minimap react"
- L1193:  test("EMPTY-4: Tab reaches Add API then Add Start block, and / opens the block menu at 0 nodes"
- L1218:  test("EMPTY-5: zero nodes disable Run, show No nodes, hide drag hints and the minimap"
- L1234:  test("EMPTY-6: overlay copy matches the spec"
- L1248:  test("EMPTY-7: a Start-only chain shows the banner, and adding a Delay removes it"
- L1268:  test("EMPTY-8: the overlay never flashes while a populated chain loads"
- L1291:  test("EMPTY-9: the overlay keeps its legacy test ids and Add API text"
- L1305:  test("EMPTY-10: reduced motion removes the entrance animation"
- L1325:  test("CANVAS-10: right-click opens the block menu at the cursor; Esc closes it and refocuses the canvas; node menu is unaffected"
- L1359:  test("CANVAS-11: dropping a handle on empty pane opens the menu; Esc is a no-op; a pick connects with one undo"
- L1392:  test("CANVAS-11: a Loop body handle that already has an edge opens no menu"
- L1408:  test("CANVAS-12: the overlay button, toolbar menu and pane menu share one add-block behavior"
- L1435:  test("CANVAS-13: Run needs a runnable node and Cmd+Enter obeys the same gate"
- L1458:  test("CANVAS-22: the footer never hints at dragging nodes or edges on an empty canvas"
- L1600: [SUITE] "Chain UI polish — P3 @qa"
- L1603:  test("RUNLOG-1: the collapsed bar summarizes the last run, its variants, and truncates time before status"
- L1653:  test("RUNLOG-1: a live run reads Running with step progress"
- L1678:  test("RUNLOG-2: the whole collapsed bar is one button that click, Enter and Space expand"
- L1706:  test("RUNLOG-3: the expanded header shows the run count and its title area collapses the dock"
- L1727:  test("RUNLOG-4: run cards are two lines with trigger, counts and a deleted-anchor fallback"
- L1768:  test("RUNLOG-5: the row menu re-runs, copies and deletes with an undo toast"
- L1800:  test("RUNLOG-6: the run list is a listbox with arrow, Home, End, Enter and Delete keys"
- L1844:  test("RUNLOG-7: every relative time (cards, summary header, bar) ticks and carries an absolute tooltip"
- L1871:  test("RUNLOG-8: counts read as words in the card, tabs, header and bar (stopped included)"
- L1891:  test("RUNLOG-9: the latest run and its first failed step are auto-selected, and a user choice sticks"
- L1923:  test("RUNLOG-10: the summary header names the trigger, start time, duration and step count with a gated Re-run"
- L1953:  test("RUNLOG-11: count tabs filter the steps, hide empty buckets, and reset when their tab vanishes"
- L1983:  test("RUNLOG-12: the filter input narrows steps, announces the count, and Esc clears before collapsing"
- L2003:  test("RUNLOG-13: step rows align index, method, label, HTTP status and duration, without a Globe or lane dot"
- L2027:  test("RUNLOG-14: failed steps show an inline error line and open the Error tab on click"
- L2055:  test("RUNLOG-15: each empty situation shows its own message"
- L2089:  test("RUNLOG-16: the columns resize by drag and keys, persist across reload, and reset on double-click"
- L2140:  test("PERSIST-1: the stored list width clamps to 200-420 and a corrupt value falls back to 288"
- L2166:  test("PERSIST-2: the stored detail ratio clamps to 0.25-0.75 and a corrupt value falls back to 0.5"
- L2190:  test("RUNLOG-17: a dock narrower than 560px swaps the run list for a Select"
- L2216:  test("RUNLOG-18: Copy error and Copy response put the raw text on the clipboard and announce Copied"
- L2245:  test("RUNLOG-19: selecting a step selects its canvas node; a removed node shows a chip and selects nothing"
- L2264:  test("RUNLOG-20: the dock height resizes within 160px to 60% of the viewport and collapses to 32px"
- L2285:  test("RUNLOG-21: the footer hides its hints while expanded but keeps the unresolved-variables warning"
- L2305:  test("RUNLOG-22: the panel menu toggles auto-open and clears all runs behind a confirmation"
- L2337:  test("RUNLOG-23: dock text is at least 12px and status and muted text keep 4.5:1 contrast"
- L2419:  test("RUNLOG-24: a 120-step run mounts a bounded number of rows and still reaches the last one"
- L2442:  test("RUNLOG-25: Re-run replays the same subset, selects the new live run and returns focus to the top row"
- L2462:  test("RUNLOG-26: a stopped run reads Stopped with its own icon and tone, in the card, header and bar"
- L2496:  test("RUNLOG-27: the collapsed or expanded state persists across reload, and a run auto-opens a collapsed dock"
- L2521:  test("RUNLOG-28: the dock is a named region and its parts follow header, list, filters, steps, detail order"
- L2686: [SUITE] "Chain UI polish — P4 browse @qa"
- L2688:    test(`PICKER-1: a 400-char URL truncates with a tooltip and never scrolls horizontally at ${viewport.width}px`
- L2742:  test("PICKER-2: the three tabs are labelled and arrow keys switch them"
- L2770:  test("PICKER-2: the last selected tab is persisted across a reload"
- L2798:  test("PICKER-3: search ANDs tokens, highlights matches and offers a clear action on no results"
- L2827:  test("PICKER-3: a cURL query shows a suggestion that opens New request prefilled"
- L2843:  test("PICKER-3: a URL query shows a URL suggestion"
- L2853:  test("PICKER-4: method chips show counts, combine with search and disable at zero matches"
- L2891:  test("PICKER-5: nested folders keep their hierarchy, corrupt parents become roots, empty collections cannot expand"
- L2952:  test("PICKER-6: everything starts collapsed, Collapse all collapses, and clearing search restores expansion"
- L2996:  test("PICKER-6: expanding a single collection by click shows its rows and keeps others collapsed"
- L3006:  test("PICKER-7: the 150-request collection renders fewer than 80 DOM rows and scrolls"
- L3023:    test(`PICKER-7: Expand all on ${count} synthetic requests stays virtualized and non-blocking`
- L3057:  test("PICKER-9: a request row shows checkbox, method, name, URL path and toggles selection on click"
- L3082:  test("PICKER-9: the keyboard-active row is distinct and exposed through aria-activedescendant"
- L3097:  test("PICKER-13: History groups entries under day headers and dedupes identical method+URL"
- L3120:  test("PICKER-13: an empty history shows the empty state without crashing"
- L3132:  test("PICKER-18: collections hydrate behind a skeleton and settle without an error row"
- L3175:  test("PICKER-21: opening with 1,500 requests is quick and typing searches without blocking"
- L3206:  test("PICKER-22: the dialog is named and described and announces result and selection counts"
- L3229:  test("PICKER-23: every documented test id is present"
- L3597: [SUITE] "Chain UI polish — P4 add @qa"
- L3600:  test("PICKER-8: a keyboard-only user can search, move, select a range, add, and Esc clears search before closing"
- L3665:  test("PICKER-10: requests already in the chain show In chain, cannot be selected or added twice, and Show on canvas centers the node"
- L3716:  test("PICKER-11: multi-select shows a live footer count, survives tab switch and search, and caps at 100 with disabled rows"
- L3772:  test("PICKER-12: a multi-add stacks nodes right of the canvas in selection order as ONE undo; closing without confirming adds nothing"
- L3841:  test("PICKER-12: Add API after this, the pane menu and the default entry each place nodes at their own origin"
- L3884:  test("PICKER-14: New request creates a real request from valid multi-line cURL with Ctrl/Cmd+Enter, and invalid cURL blocks creation"
- L3939:  test("PICKER-14: Blank mode requires a URL, creates the typed request, and the same URL twice makes two requests"
- L3985:  test("PICKER-14: with zero collections the picker offers Add without saving and creates an unsaved node"
- L4015:  test("PICKER-15: the target picker shows the full path, resets the folder when the collection changes, and saves into the chosen folder"
- L4071:  test("PICKER-15: the folder tree gets a search box only above 8 folders"
- L4112:  test.describe("default viewport"
- L4115:    test("PICKER-16: every entry point opens the same dialog, and closing resets search and selection but keeps the last tab"
- L4191:    test("PICKER-17: a connect-drop add joins only the first new node and lands at the drop point; cancelling discards the pending connection"
- L4264:  test("PICKER-17: the empty-canvas overlay adds to an empty chain at the viewport origin and removes the overlay"
- L4285:  test("PICKER-19: Recent lists up to 5 recently run saved requests, hides while filtering and when empty"
- L4347:  test("PICKER-20: the footer hints keyboard use on first open, tints selected rows, and the hint stays dismissed for the session"
- L4384:  test("PICKER-24: a half-typed New request draft survives switching tabs and back, and resets when the dialog closes"
- L4557: [SUITE] "Chain UI polish — P5 @qa"
- L4558:  test("CANVAS-14: left-drag marquee selects, middle-drag pans, right-drag opens no menu"
- L4592:  test("CANVAS-15: snap toggle persists across reload and snaps drops to multiples of 16"
- L4631:  test("CANVAS-16: Cmd/Ctrl+F opens Find node only with canvas focus; empty state; 60 nodes virtualize"
- L4666:  test("CANVAS-16: Find node stays inert on an empty chain (the canvas is unmounted)"
- L4678:  test("CANVAS-17: F fits the selection when nodes are selected, otherwise fits everything"
- L4700:  test("CANVAS-18: arrows nudge 16px, Shift+arrow 160px, and a burst is one undo entry"
- L4737:  test("CANVAS-18: arrows do nothing without a selection or while typing in an input"
- L4753:  test("CANVAS-19: align and distribute from the selection menu, distribute disabled for 2, one undo"
- L4815:  test("CANVAS-20: a self-connection is muted and refused, and Success/Fail labels hide below 0.6 zoom"
- L4857:  test("CANVAS-21: tips are contextual, dismiss persists across reload, warnings stay, Show tips lives in the ? overlay"
- L4904:  test("CANVAS-21: dismissed tips with nothing to warn about render no footer"

#### `e2e/qa/parallel-merge.spec.ts`

- L15: [SUITE] "Parallel execution + Merge @qa"
- L16:  test("Two independent branches run concurrently, showing distinct lanes at concurrency 4"
- L60:  test("Merge in `all` mode waits for both branches and passes"
- L86:  test("Merge in `any` mode fires on the first branch and skips the remaining lane"
- L122:  test("Merge in `any` mode at default concurrency aborts the in-flight slow lane and skips it"
- L149:  test("Setting concurrency to 1 runs a two-branch chain sequentially"

(Template-literal tests: `chaining-ui-overhaul.spec.ts` L657 runs "L auto-layouts <chainId>" per layout chain; L3382 / chain-level loop runs "Toolbar stays reachable on a <block> block" per block type; PICKER-1, PICKER-7 loop over viewport widths and request counts.)

## 4. Skill: identify-e2e-scenarios (`~/.claude/skills/identify-e2e-scenarios/SKILL.md`)

- Purpose: analyse the codebase and output human-readable Gherkin `.feature` files only; it does NOT write Playwright tests.
- Steps: (1) Scope: single feature vs whole app. (2) Explore routes, views, key components, stores, feature flags, focusing on user-facing behaviour. (3) Derive scenarios. (4) Write one `.feature` per logical area under `features/` in the project root (e.g. `features/<area>/<name>.feature`), adapting to what exists. (5) Print a summary table.
- Scenario rules: one clear outcome each; declarative not imperative; independent (own `Given`); meaningful names; `Background` only for truly shared setup; each scenario ideally one `Then` outcome (closely related allowed); `And`/`But` sparingly.
- Breadth checklist: happy path, empty/zero state, error/invalid input, edge cases, navigation/deep-linking, persistence across reload, responsive/accessibility.
- Template: `Feature:` + `As a / I want to / So that`, optional `Background:`, `Scenario:` blocks with Given/When/Then/And.
- Output summary format: `## E2E Scenario Summary` table `| Feature file | Scenarios |`, then `**Total: N scenarios across M feature files**`, then a one-line note on what was intentionally omitted.
- Quality bar: QA engineer can understand without source; no imperative steps; no duplicates; fix before summary.
- Repo divergence: this project stores scenarios as Markdown at `e2e/scenarios/<area>.feature.md` (with `## Scenario:` headings), not `features/*.feature`; chain.feature.md already has 105 scenarios, including requirement-ID-tagged ones such as "(EMPTY-1, EMPTY-2, ...)".

## 5. Test run (2026-10-04)

Command: `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts --reporter=json` (existing server on :3000, 2 workers, ~221s).

Result: 202 tests, 201 passed, 1 failed, 0 flaky, 0 skipped.

(A first attempt failed every test with "Executable doesn't exist" because the Playwright Chromium headless shell was not installed; fixed with `bunx playwright install chromium`, which downloads to `~/Library/Caches/ms-playwright`, outside the repo.)

Failure:
- `e2e/qa/chaining-ui-overhaul.spec.ts:4700` "CANVAS-18: arrows nudge 16px, Shift+arrow 160px, and a burst is one undo entry": consoleGuard tripped by `console.warning: [React Flow]: It seems that you are trying to drag a node that is not initialized ... https://reactflow.dev/error#015`. The functional assertions did not fail first; the warning came from the auto guard. May be an app warning or timing (nudge before node init), worth a rerun/`--repeat-each` to see if it is flaky.

## Appendix: planner.md "### 4. Task breakdown" (verbatim)

```
### 4. Task breakdown

Invoke the `planning-and-task-breakdown` skill. Produce `agent_docs/TASKS.md` with:
- Phases (Phase 0, Phase 1, …) each ending in a 🔶 checkpoint
- Individual tasks (T0.1, T1.1, …) with **Kind** (implementation|e2e|gate|walkthrough|dod), **Files**, **Do**, **Acceptance**, **Verify** sections
- ☐ todo markers ready to be flipped to ✅ by the implementation loop
- Vertical slices where possible; ≤5 files per task
- Browser/UI Verify steps: if the project has a seeded QA harness (`e2e/fixtures/qa.ts`, `e2e/qa/`), write them as `bunx playwright test e2e/qa/<feature>.spec.ts` and add a task that writes that spec (one `test()` per checklist item, plus any seed data it needs). Use `agent-browser: …` only for purely visual or exploratory checks, and start it with the seed (`--init-script e2e/fixtures/qa-seed.init.js`).
- Gate/walkthrough tasks' Verify steps use the seeded QA specs (`bunx playwright test e2e/qa/<feature>.spec.ts --repeat-each=2` or `bun run test:qa`) plus the relevant suite commands (test/lint/typecheck/e2e) as evidence — never `agent-browser` alone as evidence for these.
```
