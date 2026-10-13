# Spec: Close the Test-Coverage Gap Report (Requestr)

Branch: `feature/ai-agent` (single branch, single PR). Status: DRAFT; open questions resolved (section 4).
Source audit: `agent_docs/test-coverage-gaps/audit/coverage-{environments,collections-sidebar,chains,request-builder,tabs,settings-tools,realtime-graphql-history}.md` (cited below as ENV, COL, CHN, REQ, TAB, SET, RT; "§3" = Missing unit tests, "§4" = Missing e2e scenarios, "§5" = Weak tests).

## Assumptions (correct me now or I proceed)
1. "High + Medium" mapping: unit tests use the report's High/Med lists as written. E2E reports use different labels; mapping is ENV/TAB/RT "High/Med" as written; COL and REQ `P0 = High`, `P1 = Medium`, `P2 = Low`; SET `P1 = High`, `P2 = Medium`, `P3 = Low`. Everything else is a Low follow-up (section 10).
2. Test runners: `bun run test` (vitest, colocated `*.spec.ts(x)`) and `bun run test:e2e` (Playwright, `e2e/*.spec.ts`, `e2e/qa/*.spec.ts`). Never `npm`.
3. Items whose target file is under `src/components/reactbits/` get no tests (none are expected).
4. Counts below are as-enumerated; some audit items overlap across reports (section 6). Each overlap is owned by exactly one item so it is built once.
5. New unit tests follow the repo's `*.spec.ts(x)` convention. `src/lib/dotenvImport.test.ts` is renamed to `.spec.ts` only if touched.

## 1. Objective
Close the audit's gap report so the maintainer can trust the suite, and so future auditors re-running the gap check find an accurate trail.

Success criteria (all testable):
1. All 9 surfaced bugs plus the env-name-uniqueness change (B10) are either fixed with a regression test that failed first, or (if not reproducible) documented and dropped. No unreproduced bug is "fixed".
2. Every High + Medium gap enumerated in sections 6 and 7 has a unit or e2e test.
3. New e2e tests hit a local mock server only: no `dummyjson.com`, `httpbin.org`, `echo.websocket.org`, `countries.trevorblades.com`.
4. `.feature.md` files match the current UI; `check-parity.sh` prints its failure reason instead of exiting 1 silently.
5. `bun run test` and `bun run test:e2e` are both green.
6. A final re-audit pass lists anything still uncovered (Phase 4).

Users: the Requestr maintainer; secondary, future auditors.

## 2. Tech stack and commands
Next.js (App Router), TypeScript, Zustand stores (`src/stores/use<Name>Store.ts`), vitest 4 (jsdom), Playwright `@playwright/test` ^1.59, Biome lint, bun.

| Purpose | Command |
|---|---|
| Unit, all | `bun run test` |
| Unit, one file | `bun run test src/stores/useCollectionsStore.spec.ts` |
| E2E, all | `bun run test:e2e` |
| E2E, one file | `bunx playwright test e2e/import.spec.ts` |
| Lint | `bun run lint:check` |
| Type check (only after a phase is fully done) | `bun run typecheck` |
| Chain ID parity | `bash e2e/scenarios/chain/check-ids.sh` and `bash e2e/scenarios/chain/check-parity.sh` |
| App server | Never started manually; it is always running (Playwright `webServer` reuses it) |

## 3. Project structure (where new work goes)
```
src/**/X.spec.ts(x)            colocated unit tests (new files named after the component)
e2e/<area>.spec.ts             e2e per area (new: e2e/import.spec.ts)
e2e/scenarios/*.feature.md     scenario docs (one per area)
e2e/fixtures/                  helpers; chainRoutes.ts = existing page.route mock of /api/proxy (chain only)
e2e/support/mock-server/       NEW: local echo/mock server (see section 8)
playwright.config.ts           webServer entries (Next.js on :3000 + mock server)
agent_docs/test-coverage-gaps/ this SPEC.md, audit/, later PLAN.md / TASKS.md
```
Code style: follow `~/.claude/skills/code-style`, `typescript-best-practices`; named constants not magic numbers; functions under ~30 lines; comment why not what; no empty catch. Testing style: Arrange/Act/Assert, test names describe behavior, prefer real stores over heavy mocks (REQ §5, ENV §5 criticize mock-only tests), use `data-testid` not CSS classes (TAB §5).

## 4. Confirmed decisions (answers to the former Open Questions)
| # | Decision |
|---|---|
| D1 | B9: CONFIRMED. Record failed HTTP requests (network errors, timeouts, non-2xx) and reopen with the correct tab type. GraphQL/WS/Socket.IO history stays out of scope. |
| D2 | B7: ONLY fix "closing a tab disconnects its socket" (WebSocket and Socket.IO). The handshake-headers half is DROPPED: native browser `WebSocket` cannot set custom handshake headers (client: `src/stores/useConnectionStore.ts`). No Headers-tab changes, no `extraHeaders` work. Documented as a known browser limitation; moved to out-of-scope. |
| D3 | B2: REMOVE the "Restart Tour" button from Settings > General (Data Management). The tour stays disabled (`MainLayout.tsx` comment untouched). Check for code that becomes dead (e.g. `restartTour` in `useFirstTimeUser` if only that button used it) and remove only what becomes unused; no other refactors. Regression test: button not rendered. |
| D4 | Add `socket.io` and `ws` (plus needed types, e.g. `@types/ws`) as devDependencies for the mock server. |
| D5 | SSL e2e: local HTTPS listener with a self-signed cert generated at startup; e2e asserts the request fails with SSL verify ON and succeeds with it OFF. |
| D6 | Concurrency input: empty allowed while typing; on blur revert to last valid value; out-of-range clamps to 1-8; non-numeric ignored. Unit-tested. |
| D7 | Duplicate env names are BLOCKED on create and rename (trimmed, case-insensitive match against other environments): inline error, no save. Becomes B10 (in scope). Already-persisted duplicates (e.g. two "GitHub") must keep loading; validation applies only on create/rename. Env e2e relying on duplicates is adjusted. |
| D8 | Multi-value Set-Cookie and GET-with-body: characterization tests that document current behavior; NO fix. |

## 5. Phases and acceptance criteria
Phases are sequential; do not start the next until the previous is green (`bun run test`; Phase 3 also `bun run test:e2e`).

### Phase 1: Fix the 9 bugs + env-name uniqueness (B10) (reproduce with a failing test FIRST)
Protocol per bug (B10 is a confirmed change, same failing-test-first protocol): (a) write failing test, (b) confirm it fails for the stated reason, (c) fix minimally, (d) test passes, (e) fixes stay in this phase. If a bug cannot be reproduced, record it in section 9 (Bug Log) as "not reproducible, dropped" and make no code change. Unit-level regression tests live in the Phase 1 task; the matching High/Med unit/e2e items in sections 6-7 that depend on the bug reference it below.

| # | Bug | Repro test (must fail first) | Fix AC | Source |
|---|---|---|---|---|
| B1 | Language switching does nothing: `src/i18n/request.ts` hard-codes locale `"en"` | Test that with locale `fr`/`ja` the resolved messages are the fr/ja bundle (`src/i18n/messages.ts`), and `LanguageSection` selection changes a rendered string | Selected locale drives loaded messages and `<html lang>` (`HtmlLangSetter`); persists across reload. Existing `messages.parity.spec.ts` stays green | SET §1, §3 High (LanguageSection+request.ts+HtmlLangSetter), SET §4 #5 |
| B2 | Restart Tour does nothing (tour is disabled at `src/components/layout/MainLayout.tsx:~199`) | Test: `GeneralSection` does NOT render the Restart Tour button (fails now) | Per D3: button removed from Settings > General; tour stays disabled; remove/update tests that asserted the button (`GeneralSection.spec`, `SettingsPageClient` wiring); remove `restartTour` and related props/i18n keys ONLY if they become unused (check fr/ja parity spec stays green) | SET §1, §3 High |
| B3 | SSL verify toggle does nothing: `sslVerify` sent to `src/app/api/proxy/route.ts` but never read | `route.spec.ts`: with `sslVerify:false` the upstream call is made with TLS verification disabled (assert on the option passed to the upstream agent/fetch); with `true`/omitted it is verified | Proxy honors `sslVerify`. Regression test per REQ §3 High (route.ts). Must not weaken the default (verify on) | REQ §1, §3; SET §2 |
| B4 | Pre-request script `environment.set` does not reach `{{var}}`: vars resolve before script runs. Related, unconfirmed: `tab.auth` is passed to `runRequest` without `{{var}}` substitution | (a) `useSendRequest.spec`: pre-script `environment.set("token","x")` then URL/header/body `{{token}}` resolves to `x`; (b) payload asserted exactly: `tab.auth` bearer/basic/apikey with `{{token}}` reaches `runRequest` resolved | Ordering: run pre-script, then resolve. Auth fields are resolved at send. If (b) shows auth is already resolved, document and drop that half | REQ §2 rows "Scripts: pre-request", "Auth var substitution"; REQ §3 High useSendRequest |
| B5 | `TabListDropdown` keeps search text after selecting a tab or "Close all" (`setOpen(false)` bypasses `handleOpenChange`) | `TabListDropdown.spec.tsx`: type search, select row, reopen -> search is empty; same after Close all | Search reset on every close path (single close handler). Added with TAB §3 High TabListDropdown spec | TAB §2 row "Dropdown search reset on close" |
| B6 | Socket.IO `connect_error` hidden: following `disconnect` handler resets error to null; the existing test "socket.io connect_error disconnects and clears error after disconnect handler" asserts that | Correct that test first so it asserts the error is retained (fails), then fix | Error from `connect_error` stays visible until next connect attempt; Connect re-enabled; UI shows the error (the only feature-shaped UI here, minimal). The old test is rewritten, not deleted | RT §2, §5 |
| B7 | Closing a tab does not disconnect its socket (WebSocket and Socket.IO leak) | `useTabsStore`/`useConnectionStore` spec: closing a connected ws/socketio tab calls disconnect for that tab (fails now); also closeAll, closeOthers, closeTabsForRequest | Every tab-removal path disconnects that tab's socket. Handshake headers NOT changed (D2: known browser limitation; Headers tab untouched) | RT §2 row "Tab close disconnects" |
| B8 | Settings opens on Appearance though General is first in nav | `SettingsPageClient` default active section equals first item of `SETTINGS_SECTIONS` | Default section = `SETTINGS_SECTIONS[0]` (single source of truth). No URL deep-linking | SET §1 |
| B9 | History scope (confirmed, D1): failed HTTP requests are not recorded; `HistoryItem` always reopens as type `"http"` | `useSendRequest.spec`: network error, timeout, non-2xx each call `addEntry` with status/error info; `HistoryItem.spec`: reopened tab type matches what was recorded | Failed HTTP requests recorded (network error, timeout, non-2xx); entries reopen with the correct tab type. GraphQL/WS/Socket.IO recording stays out of scope; the unit test locking GraphQL as "no history" (`useSendRequest.spec` "runs GraphQL request ... without history entry") is kept and renamed to state it is intentional | RT §2, §5; REQ §2 |
| B10 | Env name uniqueness (D7, small product change): create/rename allow duplicates | `EnvListPanel`/`EnvManagerDialog`/`SidebarMainTab` + store: creating or renaming to a name equal (trimmed, case-insensitive) to another env shows an inline error and does not save (fails now); persisted legacy duplicates still hydrate and render | Validation in one shared helper used by all three entry points (DRY); rename to its own current name allowed; legacy duplicates load unchanged and remain selectable by id | ENV §1, §3 Med, §4 #7 |

### Phase 2: Unit tests (all High + Medium)
AC: every row in section 6 has a spec that asserts behavior (not just rendering); tests that overlap a Phase 1 bug reuse the regression test; `bun run test` green. Weak-test rewrites listed in 6.8 are included.

### Phase 3: E2E infra, then E2E tests
3-0 (first, user decision): fix the `check-parity.sh` silent `exit 1` (section 9) so every Phase 3 gate can run both parity scripts.
3a (infra, section 8): local mock server up via Playwright `webServer`; smoke spec proves each protocol works. AC: `bun run test:e2e` starts it with no manual step.
3a-2 (after the infra gate): seeded QA regression spec `e2e/qa/bugfix-regressions.spec.ts` for the UI-visible Phase 1 fixes (B1, B2, B5, B6, B8, B10). Phase 1 verifies bugs with unit/component tests only; this is a user-approved deviation from the planner.md seeded-QA-in-phase rule, with e2e evidence deferred to Phase 3 where the mock server exists.
3b (e2e): every row in section 7 implemented against the mock server; `waitForTimeout` not used in new tests; `data-testid`/role locators only.

### Phase 4: Cleanup
- Docs/parity (section 9). Scenario files are written in Phase 3 (`/e2e scenarios`, gated before any `/e2e write`); Phase 4 only re-verifies the parity script fix (made at the start of Phase 3), lints scenario IDs against test titles, and corrects any drift left.
- Final re-audit: re-run the seven area checks (per audit method) against the merged state; produce `agent_docs/test-coverage-gaps/REAUDIT.md`-style list in the PR description (not a new repo doc unless the maintainer asks) of anything still uncovered, split into "Low follow-up" and "new".
- AC: all success criteria hold; a single PR from `feature/ai-agent` is opened only when the user asks (no commit or PR is made autonomously).

## 6. Unit test list (High + Medium) - 92 items
ID format `U-<AREA>-nn`. H = High, M = Medium. Bug link in last column where relevant.

### 6.1 Environments (ENV §3) - 15
| ID | P | Target | What to assert |
|---|---|---|---|
| U-ENV-01 | H | `src/components/environment/EnvVariableTable.tsx` `handleEnvFile`/drop/Import button | singular/plural success toast; "No variables found in file"; read failure; `dropHighlight` on dragover/leave; dotfile accepted |
| U-ENV-02 | H | `EnvVariableTable.tsx` `handleBulkPaste` | multi-line paste in key/initial/current calls `bulkImportEnvVars`, `preventDefault`, toast; single-line paste unaffected; "No KEY=VALUE lines" error |
| U-ENV-03 | H | `EnvListPanel.commitName`, `EnvManagerDialog` header commit, `SidebarMainTab` inline create | empty/whitespace name falls back to default name |
| U-ENV-04 | H | `src/lib/resolveRequest.ts` / `useSendRequest` | `{{var}}` substituted in bearer, basic user/pass, apikey, JSON body, form fields, query params, path params (ties to B4) |
| U-ENV-05 | H | `useEnvironmentsStore` `getVariable` (`||`) vs `buildActiveEnvVars`/`resolveVariables` | empty `currentValue` and empty `initialValue` behave consistently; pick one rule, document, fix the odd one out |
| U-ENV-06 | M | `src/lib/dotenvImport.ts` `parseDotEnvContent` | `export KEY=v`, inline comments, value containing `=`, CRLF, empty value, BOM |
| U-ENV-07 | M | `SidebarMainTab` environments | empty state, Active badge, click to activate, delete confirm/cancel, delete-active clears selection |
| U-ENV-08 | M | `EnvListPanel` | Enter commits, Escape cancels rename; delete-confirm cancel; pre-existing duplicate names (hydrated legacy data) keep distinct rows, selection by id |
| U-ENV-09 | M | `EnvVariableTable` | unchecking secret hides eye and resets visibility; empty-key row; secret not leaked in placeholder; assert masked state before toggling (fixes ENV §5 weak test) |
| U-ENV-10 | M | `EnvManagerDialog` | close behavior (X, Esc); selection when active env deleted |
| U-ENV-11 | M | `CreateNewDropdown` "New Environment" | triggers `isCreatingEnv` |
| U-ENV-12 | M | `src/components/settings/GlobalSection.tsx` (new spec) | base URL change and header table writes to `useSettingsStore` |
| U-ENV-13 | M | UrlBar variable highlight | resolved vs unresolved token classes via `tokenizeVariables` |
| U-ENV-14 | M | `variableResolver.resolveVariables` | whitespace `{{ a }}`, nested, undefined vs empty-string (`??`) |
| U-ENV-15 | M | Env name uniqueness (B10) | shared validator: trimmed + case-insensitive; create and rename in `EnvListPanel`, `EnvManagerDialog`, `SidebarMainTab` show inline error, no save; rename to own name OK; legacy duplicates hydrate |

### 6.2 Collections / sidebar / import (COL §3) - 13
| ID | P | Target | What to assert |
|---|---|---|---|
| U-COL-01 | H | `useCollectionsStore` `createFolder`/`renameFolder`/`duplicateFolder`/`deleteFolder` | nested create; rename blank falls back; deep duplicate gets new ids, remaps `parentFolderId`, clones requests; delete cascades subfolders + requests + closes tabs |
| U-COL-02 | H | `src/lib/importScanner.ts` | `scanFileContent` detection order (Insomnia vs OpenAPI vs Postman), `scanOpenApiText`, `scanCurlText`, error messages (unmocked) |
| U-COL-03 | H | `src/lib/postmanParser.ts` (new spec) | `isPostmanCollection`, `parsePostmanCollection` nested folders, auth types, bodies, variables, `PostmanParseError` when no requests |
| U-COL-04 | H | `src/lib/postmanExporter.ts` (new spec) | `exportToPostmanCollection` round-trip with parser (folders, bodies, auth); `downloadPostmanCollection/Request` |
| U-COL-05 | H | `src/components/layout/SidebarSearch.tsx` (new spec) | name/URL/case-insensitive filtering, envs, chains, grouping, empty state; click reuses existing tab, opens env manager with id, navigates to chain; clear (X) |
| U-COL-06 | M | `CreateNewDropdown.tsx` | each item calls `openTab` with the right TAB_TYPE, `setIsCreatingCollection`, `setIsCreatingEnv`, `onNewChain`, `onImport` |
| U-COL-07 | M | `CollectionRequestTree.tsx` | nested folder render, `countDescendantRequests`, folder menu (New Folder/Rename/Duplicate/Delete confirm), blank-rename fallback, auto-expand parent |
| U-COL-08 | M | `src/stores/useFolderExpandStore.ts` (new spec) | toggle/setExpanded/expandAll/collapseAll/toggleAll/isAllExpanded; persistence (`rq_collapsed_folders`); corrupt JSON and blocked storage fallback |
| U-COL-09 | M | `SidebarMainTab.tsx` | section persistence (`readStoredSections`/`persistSections`, corrupt value, storage throw -> console.warn); expand/collapse-all button state; env delete confirm; Escape/blank in new-env input |
| U-COL-10 | M | `HealthDot.tsx` / `HealthPopover.tsx` | color thresholds at 94/95/79/80; hidden below min sample; popover content (rewrites weak HealthDot.spec) |
| U-COL-11 | M | `RequestItem.tsx` | Copy as cURL success and clipboard-failure toast; Export as Postman; health dot gated by `showHealthMonitor` and non-empty url; duplicate preserves `folderId` |
| U-COL-12 | M | `ImportDialog.tsx`, `app/import/page.tsx` | Insomnia and OpenAPI branches (toast, collection created); drag-drop; tab switch resets state; scan failure leaves store untouched; page: Insomnia/OpenAPI file |
| U-COL-13 | M | `LeftPanel.tsx` | "+" Import opens dialog; JSON Visualize/Compare links; Hub tab renders `HubTab`; fix misleading test name "shows cross-resource search results" and assert real results |

### 6.3 Chains (CHN §3) - 9
| ID | P | Target | What to assert |
|---|---|---|---|
| U-CHN-01 | H | `src/lib/chainRunner/scheduler.ts`, `schedulerQueue.ts`, `schedulerLanes.ts` (new specs) | `dispatchReady` honors limit and skips already-recorded nodes; drain stops after abort; lane assign/reuse/release; concurrency 0/negative/NaN/non-integer passed to `runChain` (decide: guard in runner; test the guard) |
| U-CHN-02 | H | `GeneralSection.tsx` concurrency input (D6) | empty allowed while typing (not written to store); blur with empty/invalid reverts to last valid value; "0"/"99"/"-3"/"3.7" clamp to 1-8 (rounded); "abc" ignored; min/max attrs. If the draft/blur behavior is absent in `GeneralSection.tsx` today, write the failing test first, then implement it (D6). Owner of the overlap with U-SET-03 |
| U-CHN-03 | H | `src/hooks/useHydrateChainPreferences.ts` (new spec) | hydrates persisted concurrency after mount |
| U-CHN-04 | M | `src/app/chain/[collectionId]/useChainCycle.ts` (new spec) | returns NO_CYCLE; picks edge on cycle |
| U-CHN-05 | M | `ArrowConfigPanelBody.tsx`, `ArrowConfigInjectionPreviewList.tsx` | render, edits, preview list |
| U-CHN-06 | M | `canvas/hooks/chainNodeBuilders.ts`, `blockNodeFactory.ts`, `ChainCanvasFlow.tsx`, `ChainCanvasPanels.tsx` | node building per block type; panels |
| U-CHN-07 | M | `run-log/NestedSteps.tsx`, `StepWarnings.tsx`, `RunCardMenu.tsx` | render and actions |
| U-CHN-08 | M | `nodes/useNodeToolbarActions.ts`, `panels/StartInputRow.tsx`, `AliasCollisionWarning.tsx` | actions; start input row edits; collision warning |
| U-CHN-09 | M | `chainRunnerAbort.spec` (extend, currently 1 test) | abort mid-flight at concurrency>1 for every executor type; abort during Loop/Subchain |

### 6.4 Request builder (REQ §3) - 18
| ID | P | Target | What to assert |
|---|---|---|---|
| U-REQ-01 | H | `src/lib/requestRunner.ts` `buildBody`/`buildHeaders` (via `runRequest`) | urlencoded encoding and empty->null; xml/urlencoded default Content-Type; user Content-Type in any case not duplicated (fix case-sensitive check if reproduced); basic auth unicode password (`btoa` throws); empty bearer; text/html; form-data fallthrough |
| U-REQ-02 | H | `requestRunner.executeProxy` | `code === "TIMEOUT"` -> `RequestError` type `"timeout"`; `sslVerify`/`followRedirects`/`timeoutMs` defaults in payload |
| U-REQ-03 | H | `src/app/api/proxy/route.ts` | 504 on `AbortError`; `timeoutMs` clamp (1_000..600_000, non-number -> default); body+headers forwarded; method uppercased; X-Timing headers; `sslVerify` (B3); multi-value Set-Cookie: CHARACTERIZATION test documenting current (collapsed) behavior, no fix (D8) |
| U-REQ-04 | H | `src/hooks/useSendRequest.ts` | auth var resolution (B4); post-script error toast; post-script logs merge; re-send aborts previous request; per-tab overrides vs global for sslVerify/followRedirects/timeoutMs, asserting the exact payload passed to `runRequest`; body-less HEAD/GET; GET-with-body: CHARACTERIZATION test documenting current behavior (body sent / fetch throws), no fix (D8) |
| U-REQ-05 | H | `src/lib/scriptRunner.ts` | async/rejected promise; infinite loop (document: no guard, or add guard only if B4 work requires); `request.headers.delete/get`, `url.set`, `body.set` flow; `environment.get` fallback ""; invalid-JSON `response.json()`; console level prefixes |
| U-REQ-06 | H | `src/lib/utils.ts` `buildFinalUrl` | duplicate query (URL + table), repeated `:param`, path value with `/` or space, `{{var}}` in value, disabled rows, port `:8080` not a param |
| U-REQ-07 | H | `utils.ts` `syncParamsFromUrl`/`buildUrlWithParams`/`parseQueryString` | duplicate keys, empty values, `+` vs `%20`, fragment, relative URLs, malformed percent-encoding |
| U-REQ-08 | M | `ParamsEditor.tsx` (new spec) | query edit updates URL; path params read-only; disabled rows leave URL |
| U-REQ-09 | M | `AdvancedTab.tsx` (new spec) | timeout draft parse/clamp, blank -> undefined, SSL switch + "reset to global", follow-redirects switch |
| U-REQ-10 | M | `RequestBreadcrumb.tsx` (new spec) | unsaved, saved, collection missing |
| U-REQ-11 | M | `CodeGenPanel.tsx` + `CodeGenDialog.tsx` (new specs) | language switching, copy, variable resolution, secret redaction toggle. Also owns SET "CodeGenPanel" High (showCodeGen collapsed/expanded, `codeGenLang` persisted, "tab" variant always expanded) |
| U-REQ-12 | M | `src/lib/codeGenerators.ts` | auth variants, urlencoded/form-data, quote/newline escaping in all 9 languages, api-key query, JSON bodies for Go/PHP/Ruby/Java/C#; replace pattern-grep tests with exact snippet assertions |
| U-REQ-13 | M | `src/lib/curlParser.ts` | `-F`, `--json`, `-G`, `-I`, `--url`, `-b`, `-d @file`, quotes/escapes, multiple `-d`, empty `-H`, `--data-binary` |
| U-REQ-14 | M | `UrlBar.tsx` | `handlePaste` cURL, `handleCopyCurl` failure, HEAD/OPTIONS items + checkmark, Cmd+Enter in input |
| U-REQ-15 | M | `useKeyboardShortcuts.ts` | Cmd+S (macOS) -> `onSave` |
| U-REQ-16 | M | `HeadersEditor.tsx` | add/edit/disable/delete (currently only AI tests) |
| U-REQ-17 | M | `AuthEditor.tsx` | bearer and "none" clear; tokens containing `{{var}}` |
| U-REQ-18 | M | `SaveRequestModal.tsx` | folder choice, empty-name validation, duplicate names (overlaps COL Low item; owned here) |

### 6.5 Tabs (TAB §3) - 10
| ID | P | Target | What to assert |
|---|---|---|---|
| U-TAB-01 | H | `TabListDropdown.tsx` (new `TabListDropdown.spec.tsx`) | count header, case-insensitive/trimmed/fallback "New Request" filter, "No tabs found", select activates and closes, Enter/Space, active highlight, dirty dot, row X calls `handleCloseTab` without selecting, Close all -> `handleCloseAll` (dirty -> `pendingBulkClose`), search cleared on reopen (B5 regression) |
| U-TAB-02 | H | `TabBar.tsx` bulk-close dialog | `confirmBulkClose` for "others"/"all", dirty count one vs many text, cancel |
| U-TAB-03 | H | `TabBar.tsx` single-close dialog | Cancel keeps tab, `pendingCloseTabId` cleared |
| U-TAB-04 | H | `MainLayout.tsx` | `handleCloseActiveTab`, `handleCloseAllTabs` dirty branch, `beforeunload` handler |
| U-TAB-05 | M | `Tab.tsx` (new `Tab.spec.tsx`) | icon per type, dirty dot, connection dot only when ws/socketio connected (owner of RT Tab dot item), color dot, Enter/Space select, X keyboard close, X stopPropagation |
| U-TAB-06 | M | `TabContextMenu` | Set Label apply/clear, Delete request confirm, rename Escape/empty, Duplicate for graphql/ws |
| U-TAB-07 | M | `TabBar` drag/drop | dragstart/drop -> `reorderTabs(from,to)`; same index no call; dragend resets |
| U-TAB-08 | M | `TabBar` overflow | "+" moves to right actions when `scrollWidth>clientWidth` (mock sizes); auto-scroll on add |
| U-TAB-09 | M | `RequestItem` dedupe | click on existing `requestId` activates instead of opening a duplicate |
| U-TAB-10 | M | `useKeyboardShortcuts` | Ctrl+[ at first / Ctrl+] at last = no-op; no tabs; Ctrl+T |

### 6.6 Settings and tools (SET §3) - 14
| ID | P | Target | What to assert |
|---|---|---|---|
| U-SET-01 | H | `CodeGenPanel.tsx` | owned by U-REQ-11 (not double-counted); listed here for traceability |
| U-SET-02 | H | `LanguageSection.tsx`, `src/i18n/request.ts`, `HtmlLangSetter.tsx` | selecting fr/ja sets locale and `document.documentElement.lang`; exposes B1 |
| U-SET-03 | H | `GeneralSection.tsx` | toggles call `setSetting("showHealthMonitor"/"showCodeGen")`; concurrency owned by U-CHN-02; Clear History button invokes callback; Restart Tour button is NOT rendered (B2 regression) |
| U-SET-04 | H | `SettingsPageClient` | Clear History cancel keeps history; default section (B8) |
| U-SET-06 | H | `JsonVisualizePage.tsx` (`src/components/json-visualize/`) | render, invalid JSON, tree expand/collapse, search |
| U-SET-07 | M | `GlobalSection` | owned by U-ENV-12 |
| U-SET-08 | M | `ProxySection.tsx` | switches reflect props, `setSetting` keys, placeholder i18n |
| U-SET-09 | M | `AppearanceSection.tsx` + `useThemeAccent` | accent click handler with rgb, active ring, mounted gating, CSS vars set, no-op when undefined |
| U-SET-10 | M | `ClearHistoryDialog.tsx` | cancel/Esc closes, confirm label (also RT Med; owned here) |
| U-SET-11 | M | `SettingsNav` | active state, all six sections, i18n labels |
| U-SET-12 | M | `RequestItem` health indicator | owned by U-COL-11 |
| U-SET-13 | M | `LeftPanel` tool links | hrefs `/transform`, `/json-visualize`, `/json-compare`, settings button (owned by U-COL-13) |
| U-SET-14 | M | `useUIStore` `readChainConcurrency` | corrupt / "" storage; `Math.round` of decimals |
| U-SET-15 | M | `DiffTree.tsx` | added/removed/changed rendering |

Note: U-SET-01, 07, 12, 13 are pointers to items owned elsewhere; they are not extra work. Net new unit work in 5.6 = 11.

### 6.7 GraphQL / WS / Socket.IO / History (RT §3) - 13
| ID | P | Target | What to assert |
|---|---|---|---|
| U-RT-01 | H | `src/lib/graphqlIntrospection.ts` `fetchGraphQLSchema`, `formatTypeRef` | network failure, proxy error, non-JSON, `errors[]`, missing `__schema`, `__` filtering, header enabled/key filtering |
| U-RT-02 | H | `GraphQLTabs.tsx` `handleFieldSnippet` | empty query, ends with `}`, duplicate root field, indentation |
| U-RT-03 | H | `useConnectionStore.ts` | Socket.IO `connect_error` surfaces (B6); ws `onclose` preserves error; tab close disconnects ws and socketio (B7). Handshake headers: not tested/changed (D2) |
| U-RT-04 | H | `useSendRequest` GraphQL | `sendForce` bypass; env-resolved variables/operationName; error path (setError/toast); abort; history behavior per B9 (GraphQL stays unrecorded) |
| U-RT-05 | H | `ConnectButton.tsx` (new spec) | disabled for empty URL; Connecting spinner; Disconnect; env-variable URL resolution |
| U-RT-06 | M | `GraphQLSchemaExplorer.tsx` | idle/loading/error/success; search; type expand; `buildArgsString`, `buildFieldSnippet`, `buildSubfieldLines`, `argPlaceholder` |
| U-RT-07 | M | `src/lib/historyExport.ts` + `HistoryList` export menu | `csvCell` escaping (comma/quote/newline), JSON rounding, `buildExportFilename`, `downloadFile` |
| U-RT-08 | M | `MessageLog.tsx` | empty state, sent/received `data-direction`, clear click |
| U-RT-09 | M | `WebSocketTabs` / `SocketIOTabs` (own spec file for SIO) | empty draft no-op; draft cleared after send; send disabled while connecting; blank event -> "message"; emitted event name and payload |
| U-RT-10 | M | `ClearHistoryDialog` | owned by U-SET-10 |
| U-RT-11 | M | `HistoryList.tsx` | method filter, healthKey match, export hidden in compact, sample cards in empty state |
| U-RT-12 | M | `HistoryItem` | open restores headers/body/auth/scripts and correct tab type (B9); truncated URL |
| U-RT-13 | M | `Tab.tsx` connection dot | owned by U-TAB-05 |

Net new unit work in 5.7 = 11 (U-RT-10, 13 are pointers).

### 6.8 Weak unit tests to rewrite (inside the items above)
`SidebarMainTab.spec` "embeds collection tree and chain list" (presence-only); `LeftPanel.spec` cross-resource test; `HealthDot.spec`; `GeneralSection.spec` (single test; drop any Restart Tour assertion); `HeadersEditor.spec` (AI-only); `scriptRunner.spec` "isolates env helpers" (rename: scripts are not sandboxed); `route.spec` (no body/timeout); `useSendRequest.spec` (assert exact payload); `useConnectionStore.spec` connect_error (B6); `WebSocketTabs.spec` headers test (stays as render test; rename so it no longer implies headers reach the handshake, D2).

Unit totals: 15 + 13 + 9 + 18 + 10 + 14 + 13 = 92 enumerated (U-SET-05 OnboardingTour spec removed per D3; U-ENV-15 added per D7); 8 are pointers to items owned elsewhere, so 84 distinct work items.

## 7. E2E scenario list (High + Medium) - 77
All run against the mock server (section 8). Mocked product behavior (AI wand) uses `page.route`. ID `E-<AREA>-nn`. Each also gets a `.feature.md` scenario (written in Phase 3, before any test).

### 7.1 Environments (ENV §4) - 12
| ID | P | Scenario |
|---|---|---|
| E-ENV-01 | H | Active env Dev `token=abc123`, header `Authorization: Bearer {{token}}`, send -> echo shows `Bearer abc123` |
| E-ENV-02 | H | Env list, variables and active env persist after reload |
| E-ENV-03 | H | `{{baseUrl}}` highlighted resolved vs unresolved; unresolved send shows warning with "send anyway" |
| E-ENV-04 | H | Paste multi-line `KEY=value` into a cell -> rows created, success toast |
| E-ENV-05 | H | Import `.env` via `setInputFiles` on `import-env-btn` input -> variables listed |
| E-ENV-06 | M | Delete the active env -> selector shows "No Environment" |
| E-ENV-07 | M | Creating or renaming an env to an existing name (any case, surrounding spaces) shows inline error and does not save (B10); replaces the old duplicate-names scenario. A legacy-duplicates seed (two "GitHub" in IndexedDB) still loads and both are selectable |
| E-ENV-08 | M | Empty name committed on rename/create -> default name |
| E-ENV-09 | M | Variable in JSON body and bearer auth -> resolved values reach the server |
| E-ENV-10 | M | Sidebar "+" -> Environment, type name, env appears, click -> Active badge |
| E-ENV-11 | M | initial=A, current=B -> request uses B; clearing current -> A |
| E-ENV-12 | M | Adjust existing env e2e that relied on duplicate names or name-based testids (`env-list-item-<name>`) to use unique names / id-based testids (maintenance item) |

### 7.2 Collections / import (COL §4) - 9
| ID | P | Scenario |
|---|---|---|
| E-COL-01 | P0 | Import Postman v2.1 with nested folders via Import dialog -> collection, folders, requests in tree with nesting (new `e2e/import.spec.ts`) |
| E-COL-02 | P0 | Import non-parsable file -> error shown, sidebar unchanged |
| E-COL-03 | P0 | Folder CRUD: New Folder, rename, add request, duplicate, delete (children removed) |
| E-COL-04 | P0 | Sidebar search: matching groups; click opens/activates tab; no-results; clear (X) |
| E-COL-05 | P1 | "+" menu parametrized: HTTP, GraphQL, WebSocket, Socket.IO, Collection, Environment, Chain, Import |
| E-COL-06 | P1 | Import Insomnia and OpenAPI (JSON and YAML), cURL via dialog populates a new tab |
| E-COL-07 | P1 | Reload persistence: collapsed folder, collapsed section, collections |
| E-COL-08 | P1 | Request actions from sidebar menu: rename, duplicate "(copy)", Export as Postman (download event), Copy as cURL (clipboard) |
| E-COL-09 | P1 | Collection "Export as Postman" -> valid `.json` download with folders/requests |

### 7.3 Chains (CHN §4) - 7
| ID | P | Scenario |
|---|---|---|
| E-CHN-01 | H | Settings concurrency input (D6): 0 / 99 / -3 clamp to 1..8; "abc" ignored; cleared while typing is allowed and blur reverts to last valid value; default 4 on fresh profile; persists after reload (owner of SET P2 #6) |
| E-CHN-02 | H | Concurrency 2 with 4 independent slow requests -> exactly 2 lanes overlap, never 3+ (uses mock server `delay`, overlap measured from server-side timestamps) |
| E-CHN-03 | H | Cyclic chain: Run blocked, banner names cycle nodes |
| E-CHN-04 | M | Concurrency 1 with Loop body and Sub-chain: still run; outer lanes obey setting |
| E-CHN-05 | M | Forced migration failure (init script) -> Retry / Open read-only recovers |
| E-CHN-06 | M | Sidebar search by chain name shows only matching chains (shares helper with E-COL-04) |
| E-CHN-07 | M | Rename chain to empty or duplicate name -> old name kept or error shown |

### 7.4 Request builder (REQ §4) - 15
| ID | P | Scenario |
|---|---|---|
| E-REQ-01 | P0 | Edit URL of saved request, Cmd/Ctrl+S -> dirty dot gone, success toast, edit persists on reopen |
| E-REQ-02 | P0 | Breadcrumb "New Request > unsaved"; after save "<Collection> > <name>" |
| E-REQ-03 | P0 | Short timeout in Advanced vs slow endpoint -> timeout error state (not generic network error) |
| E-REQ-04 | P0 | Disabled header/param is NOT received by echo (rewrites weak "Disable ..." tests) |
| E-REQ-05 | P0 | Undefined `{{baseUrl}}` -> warning; "Send anyway" dispatches; with active env resolves in URL, header, body, auth |
| E-REQ-06 | P0 | Cancelled request returns UI to idle (no failure state), resend works (rewrites "Cancel an in-flight request", which currently expects an error) |
| E-REQ-07 | P1 | Method menu lists 7 methods with checkmark; HEAD returns headers, empty body, 200 |
| E-REQ-08 | P1 | `?a=1&a=2&b=` -> three rows; edit updates URL; `%20`/unicode round-trip |
| E-REQ-09 | P1 | Follow redirects off -> 3xx + Location; on -> final 200 (mock server redirect) |
| E-REQ-10 | P1 | Form-data with one disabled field (existing doc scenario) -> echo shows only enabled field |
| E-REQ-11 | P1 | Throwing pre-script -> error toast, request still runs, Console shows logs; post-script `environment.set` makes next `{{token}}` resolve |
| E-REQ-12 | P1 | Code-gen across all 9 languages contain method, URL, header, body; Copy to clipboard (owner of SET P1 #2) |
| E-REQ-13 | P1 | Share button generates link; opening in new context restores request |
| E-REQ-14 | P1 | cURL pasted into URL bar populates tab + "cURL imported" toast; malformed cURL -> error toast, tab unchanged |
| E-REQ-15 | P1 | Response over display limit -> truncation message; Download gives full body |

### 7.5 Tabs (TAB §4) - 12
| ID | P | Scenario |
|---|---|---|
| E-TAB-01 | H | 3 tabs, dropdown row click -> that tab active, popover closes |
| E-TAB-02 | H | Dirty + clean tabs, dropdown "Close all" -> bulk dialog with count; Cancel keeps all; Confirm clears |
| E-TAB-03 | H | Distinct names (rename via ctx menu), lowercase partial search -> only matches (case-insensitive) |
| E-TAB-04 | H | Dirty + other tab, ctx "Close Other Tabs" -> bulk dialog (Cancel and Close All) |
| E-TAB-05 | H | Reload restores same tabs (dirty edits lost, active = first) |
| E-TAB-06 | M | Dirty tab + Ctrl+W -> unsaved dialog |
| E-TAB-07 | M | Click a saved request in sidebar twice -> one tab, activated |
| E-TAB-08 | M | Ctrl+[ / Ctrl+] change active tab |
| E-TAB-09 | M | Drag tab 1 onto tab 3 -> order changes |
| E-TAB-10 | M | Dirty tab in dropdown shows blue dot; hover X closes with guard |
| E-TAB-11 | M | Last tab closed -> empty state, chevron gone |
| E-TAB-12 | M | Duplicate / Rename / Set Label from ctx menu reflected |

### 7.6 Settings and tools (SET §4) - 11
| ID | P | Scenario |
|---|---|---|
| E-SET-01 | P1 | Health toggle off -> no health dot in collection row; on -> returns |
| E-SET-02 | P1 | Code-gen toggle on -> panel shows cURL; Python changes snippet; off hides (shares helper with E-REQ-12) |
| E-SET-03 | P1 | Theme/accent/toggle persist after reload |
| E-SET-04 | P1 | Clear History confirm -> History tab empty; Cancel keeps entries |
| E-SET-05 | P1 | Language Francais -> reload -> `html lang="fr"` and French strings (B1) |
| E-SET-06 | P2 | Concurrency owned by E-CHN-01 (pointer) |
| E-SET-07 | P2 | Settings > General does not show a Restart Tour button (B2, D3) |
| E-SET-08 | P2 | Global base URL + header, relative-URL request hits base URL with header |
| E-SET-09 | P2 | Custom proxy URL -> `/api/proxy` payload contains `proxyUrl` |
| E-SET-10 | P2 | Sidebar icons navigate to /transform, /json-visualize, /json-compare; paste JSON -> result visible |
| E-SET-11 | P2 | SSL verify (B3, D5): request to the mock server's self-signed HTTPS listener fails with SSL verify ON and succeeds with it OFF |

Also: the SSL toggle e2e (`settings.spec`) is replaced by E-SET-11 (real self-signed HTTPS target), and the redirects test moves to the mock server (opportunistic migration allowed here since the test is being rewritten for B3/E-REQ-09).

### 7.7 GraphQL / WS / Socket.IO / History (RT §4) - 11
| ID | P | Scenario |
|---|---|---|
| E-RT-01 | H | Per B9 (D1): a failed HTTP request appears in History and reopens as http tab; GraphQL send is asserted NOT recorded (explicit, documented) |
| E-RT-02 | H | Socket.IO to unreachable URL -> error visible, Connect re-enabled (B6) |
| E-RT-03 | H | WS invalid URL -> error shown, no stuck "Connecting" |
| E-RT-04 | H | Connected WS tab closed -> server sees close (B7); same for Socket.IO. (Handshake headers: out of scope, D2) |
| E-RT-05 | H | GraphQL header added -> Send -> server received it (documented, unimplemented scenario "Set custom headers") |
| E-RT-06 | M | Schema explorer fetch against local GraphQL -> Query fields; clicking field inserts snippet |
| E-RT-07 | M | GraphQL server returns `errors[]` or 400 -> error status/body displayed |
| E-RT-08 | M | History sidebar search filters; clear restores; no-match state |
| E-RT-09 | M | Open history item with headers/body -> tab has them (and method) |
| E-RT-10 | M | WS connected, Clear in message log -> empty |
| E-RT-11 | M | Socket.IO custom event name -> sent entry; server echo received |

E2E totals: 12 + 9 + 7 + 15 + 12 + 11 + 11 = 77 enumerated; E-SET-06 is a pointer and E-ENV-12 is maintenance, so 76 distinct new/changed scenarios (75 excluding E-ENV-12).

## 8. E2E infrastructure: local mock server
Decision: one local server started by Playwright `webServer` (second entry, replacing the current `bash scripts/run-socketio-echo.sh` entry).

Findings that shape this:
- `playwright.config.ts` already references `scripts/run-socketio-echo.sh` and `http://127.0.0.1:3333/socket.io/...`, but **`scripts/run-socketio-echo.sh` does not exist in the repo** (`scripts/` holds only `build-qa-seed-js.ts`, `demo-*.cjs`, `seed-legacy-chain.mjs`; the file was only ever in commit `bfe94b8` and is not tracked). `e2e/socketio.spec.ts` reads `SOCKETIO_TEST_URL` (default `http://127.0.0.1:3333`). So the existing `webServer` entry cannot start today. The new server takes over port 3333 and the same `SOCKETIO_TEST_URL` default, so `socketio.spec.ts` keeps working unchanged.
- `socket.io` (server) and `ws` are not in `package.json` (only `socket.io-client`, `graphql`). Decision D4: add `socket.io`, `ws`, `@types/ws` as devDependencies (via `bun add -d`).
- `e2e/fixtures/chainRoutes.ts` mocks `/api/proxy` with `page.route` for chain tests (hermetic, 599 for unmocked). That stays as is. The mock server is for non-chain specs where the real proxy must run (headers, timeouts, redirects, TLS flags). Both coexist; chain tests are not migrated.

Requirements:
| Capability | Requirement |
|---|---|
| Location/start | `e2e/support/mock-server/` (TS, run with `bun`); `webServer` entry `bun e2e/support/mock-server/index.ts`, `url` health endpoint, `reuseExistingServer: !process.env.CI`; base URL exported by one helper (`MOCK_BASE_URL`, default `http://127.0.0.1:3333`) |
| HTTP echo | `ANY /echo` returns JSON of method, headers, query, parsed body incl. `application/x-www-form-urlencoded` and `multipart/form-data` (fields + file names), raw body |
| Controls | `?status=<code>` and `?delay=<ms>` on any path; `GET /redirect?to=<url>&status=301|302|307` and chained redirects; `/slow`; Set-Cookie multi-value endpoint |
| Large/binary | `GET /large?bytes=<n>` for the display-limit scenario (E-REQ-15) and a binary endpoint |
| Request log | `GET /__requests` returns what the server received (headers/time) so tests can prove "disabled header not sent" and lane overlap; `POST /__reset` |
| WebSocket echo | `ws://127.0.0.1:3333/ws` echoes frames; records connection and close events, queryable via `/__requests` (tab-close test) |
| Socket.IO | `/socket.io`: connect, `message` echo, custom named event echo, forced connect error (e.g. `?fail=1` or auth rejection middleware) |
| GraphQL | `POST /graphql` small schema with introspection (Query fields incl. args), echo of received headers, `errors[]` response and 400 variant triggered by operation name or header |
| HTTPS (D5) | Second listener (e.g. `https://127.0.0.1:3334`) with a self-signed cert generated at server startup with the system `openssl` CLI (no committed key material); serves `/echo`; used by E-SET-11. Next.js proxy route must reach it with `sslVerify:false` and be refused with `sslVerify:true` |
| Isolation | Per-test namespacing via a `x-test-id`/path prefix or `__reset`, since specs run with 2 workers in parallel |
| Docs | Short usage note in `e2e/fixtures/README.md` |

AC for 3a: smoke spec `e2e/mock-server.spec.ts` exercises each capability; `bun run test:e2e` brings the server up cold with no manual step; CI-safe (no external network).

## 9. Docs and parity cleanup (parity fix: start of Phase 3; docs lint and re-verification: Phase 4)
| Item | Action |
|---|---|
| `check-parity.sh` silent exit 1 (CHN §6) | Likely cause: `set -euo pipefail` with `grep` finding no match inside `list_titles` (and `playwright --list` failure), killing the script before any `echo`. Reproduce, then: capture playwright `--list` stdout/stderr and exit code, print "FAILED: <step>" with the captured output, handle the no-match grep path (`|| true` only where emptiness is valid and then validate non-empty explicitly). AC: forced failures (bad base URL, missing playwright) print a reason; success path unchanged (285/285). Also run `check-ids.sh` |
| `requests.feature.md` | Add the 6 undocumented script scenarios present in `requests.spec.ts` (Scripts tab default, console.log, post-script status, header injection, `json()`, persistence) |
| `body.feature.md` | "Disable a form-data field" is documented but unimplemented: implemented by E-REQ-10 |
| `environments.feature.md` | Drift: "New Environment + confirm" -> UI is "+ Add Environment" with inline rename; split/merge "Add a variable"/"Edit a variable" to match spec; header scenario implemented by E-ENV-01; add E-ENV-02..11 |
| `history.feature.md` | "right-click > Delete" -> hover trash button; "method, URL, status, duration" -> relative time (no duration); add failed-request recording (B9) and E-RT-08/09 |
| `settings.feature.md` | Shortcuts: doc says 3 groups, UI/e2e has 5 (fix doc, loosen brittle e2e assert to required groups); add General (default section), Global, Language, Clear History, concurrency, code-gen, no Restart Tour button, SSL on/off |
| `tabs.feature.md` | Add dropdown select/Close all/search, bulk dialog, rename/duplicate/label, drag, shortcuts, reload; fix "Close a dirty tab" (Cancel/Close only, no Save option exists) |
| `import.feature.md` | 4 scenarios documented, 0 implemented: implemented by E-COL-01/02/06 |
| `graphql.feature.md` | "Set custom headers" implemented by E-RT-05; add errors, schema explorer |
| `collections.feature.md`, `websocket.feature.md`, `socketio.feature.md`, `auth.feature.md`, `response.feature.md` | Add scenarios for new e2e only; verify each existing scenario still maps 1:1 to a test title |
| E2E lint of docs | Every new `E-*` scenario appears in its `.feature.md` and vice versa (manual check like chain parity; extend `check-parity.sh` only if trivial) |
| Bug Log | Append to PR description: for B1..B10 status (fixed / not reproducible and dropped) |

## 10. Out of scope and Low follow-ups
Out of scope (do not build): WebSocket handshake headers from the Headers tab (known browser limitation, D2; Socket.IO `extraHeaders` also not done); re-enabling the onboarding tour (D3); multi-value Set-Cookie and GET-with-body fixes (characterization tests only, D8); OAuth auth; inherit-auth-from-collection; raw/binary/graphql body; folder drag-and-drop; collection duplicate; env duplicate; shortcut customization; settings URL deep-linking; recording GraphQL/WS/Socket.IO in history; WS/Socket.IO auto-reconnect; message-log filtering; request-level timeout in the chain runner; chain duplicate; TemplateGalleryModal (orphan: decision to delete is a follow-up, not done here); migrating EXISTING live-service e2e tests to the mock server (opportunistic, except the ones rewritten above).

Low follow-ups (listed, not done):
- ENV: `src/app/environments/page.tsx` render; created/deleted toasts; hydrate with no DB; `EnvAutocompleteInput` keyboard/mouse/secret; e2e: "No Environment" then send, Manage Environments footer, modal close via X/Esc, Settings Global base URL + header, delete-confirm cancel keeps env.
- COL: `VirtualizedRequestList`; `SaveRequestModal` blank name/folder (partly in U-REQ-18); `CollectionTree` blank/Escape/delete-cancel; `moveRequest` dead-code check, `loadDemoChain`; `openapiParser` YAML/`$ref`/servers/auth; `insomniaParser` nested/env/GraphQL; e2e P2: health dot, header icons/Hub tab, delete-cancel/long list, sidebar env rename/delete.
- CHN: `types.ts`, `executors/index.ts`, `chainConstants.ts`, `chainFixturesWindow`, `ChainDevProvider`, `useChainErrorMessage`, `schemaPlaceholder`, `CopyButton`, `SectionHeading`, `PickerTabs/PickerStates`, `ConnectionFeedback`, `useNodeCache`; rename validation unit; e2e: multi-lane Stop at concurrency 4; weak-test cleanup (8 `waitForTimeout`, localStorage-seeded concurrency, `nodeStateStyles.spec` class coupling).
- REQ: `requestTemplates.templateToTabState`; `mergeKvHeaders`/`prependGlobalBaseUrl`/`isRelativeOrPathOnlyUrl` direct; `scriptLinter.ts`; `ShareButton` disabled states; ResponsePanel truncation/empty/invalid JSON unit; e2e P2: AI wand, api-key query in final URL, multiple Set-Cookie, HEAD/204 empty state, SSL persist/reset. Script sandbox/security (`new Function`, no timeout) documented only.
- TAB: `useTabsStore` edge cases (`closeOtherTabs` unknown id empties tabs, out-of-range reorder, hydrate activeTabId); e2e: tab-type icons, narrow-viewport "+" relocation.
- SET: `constants.ts` order/ids, `THEME_OPTIONS`; Transform jsonpath success + mode switch, `JsonCompareEditor`; `useSettingsStore` partial hydrate; e2e P3: default section/deep link, shortcut modifier Ctrl vs Cmd.
- RT: `requestRunner` GraphQL api-key-in-query / `variables:null` / empty operationName / invalid JSON; history store DB-failure toasts; `formatSocketIoPayload` numbers/arrays; e2e: export CSV/JSON, Clear History cancel (covered by E-SET-04), reload restores GraphQL/WS tab state, invalid GraphQL variables JSON error.
- Weak e2e not rewritten above: `tabs.spec` class selectors (`span.bg-method-accent`, `span.bg-orange-400`) -> use `tab-dirty-indicator` testid when touched; `collections.spec` unscoped text locators; `home.spec` loose `getByLabel("Settings")`.

## 11. Testing strategy
- Unit: vitest, colocated. Prefer real Zustand stores with reset between tests (`useXStore.setState`), fake timers where debounced, mock only network/IndexedDB boundaries. Each bug: failing test committed in the same task as the fix.
- E2E: Playwright against production build + mock server; no external hosts; no `waitForTimeout`; web-first assertions; testids over CSS classes; seed via existing `e2e/fixtures/seed` / `qa-seed` where appropriate. Workers stay at 2 locally.
- Verification per phase: Phase 1/2 `bun run test` + `bun run lint:check`; Phase 3 `bun run test:e2e`; Phase 4 both, plus `check-ids.sh`/`check-parity.sh`. `tsc` only after a phase is complete.
- Definition of done per item: test exists, fails when the behavior is broken (mutation sanity check on bug fixes and on rewritten weak tests), passes now.

## 12. Boundaries
- Always: failing test before fix; run affected specs after each change; use `bun`; named constants; keep fixes minimal and scoped to the 9 bugs; update the `.feature.md` in the same task as the e2e test; use testids.
- Ask first: adding dependencies beyond the approved `socket.io`, `ws`, `@types/ws`; changing `playwright.config.ts` webServer/ports/workers; changing CI config; changing proxy behavior beyond reading `sslVerify`; deciding which behavior is "correct" when code and docs disagree and the product intent is unclear; any new UI beyond the Socket.IO error display, the env-name inline error (B10), and removal of the Restart Tour button.
- Never: commit unless told (and no Claude/Anthropic mention in commit messages); run the dev/prod server manually; run `npm` anywhere; delete or weaken a failing test to go green (rewrite to assert correct behavior instead, with the reason noted); add cosmetic refactors; touch `src/components/reactbits/` tests; record GraphQL/WS/Socket.IO in history; call live external services from new tests.

## 13. Open Questions
None. All former open questions were answered; see section 4 (Confirmed decisions D1-D8).

## 14. Summary of scope numbers
Bugs: 9 plus B10 env-name uniqueness (each with failing-test-first regression test). Unit items: 92 enumerated (84 distinct after pointer dedupe) across 7 areas. E2E scenarios: 77 enumerated (76 distinct, incl. one maintenance item). Infra: 1 local mock server (HTTP, HTTPS self-signed, WS, Socket.IO, GraphQL). Docs: 11 `.feature.md` touched + `check-parity.sh`.
