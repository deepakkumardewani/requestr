# Coverage Audit: Sidebar + Collections + Import

## 1) Files inspected

Source: `src/components/layout/{LeftPanel,SidebarMainTab,SidebarSearch,CreateNewDropdown}.tsx`, `src/components/collections/{CollectionTree,CollectionRequestTree,RequestItem,HealthDot,HealthPopover,SaveRequestModal,VirtualizedRequestList}.tsx`, `src/components/import/ImportDialog.tsx`, `src/app/import/page.tsx`, `src/stores/{useCollectionsStore,useFolderExpandStore,useUIStore}.ts`, `src/lib/{importScanner,postmanParser,postmanExporter,openapiParser,insomniaParser,healthMonitor,dotenvImport}.ts`.

Specs: `LeftPanel.spec`, `SidebarMainTab.spec`, `CollectionTree.spec`, `RequestItem.spec`, `HealthDot.spec`, `SaveRequestModal.spec`, `ImportDialog.spec`, `app/import/page.spec`, `useCollectionsStore.spec`, `useUIStore.spec`, `healthMonitor.spec`, `insomniaParser.spec`, `openapiParser.test`, `curlParser/curlToRequest.spec`.

E2E: `e2e/collections.spec.ts`, `e2e/home.spec.ts`, `e2e/requests.spec.ts` (cURL URL-bar import), `e2e/history.spec.ts` (tab switch only). Scenario docs: `collections.feature.md` (9 scenarios), `import.feature.md` (4 scenarios).

Structural facts verified:
- **No `e2e/import.spec.ts` exists.** All 4 import scenarios are documented-only. The one real cURL e2e is the UrlBar `import-curl-btn` flow in `requests.spec.ts` ("Import a request from a cURL command"), which does not use ImportDialog.
- **No spec files** for: `SidebarSearch`, `CreateNewDropdown`, `HealthPopover`, `VirtualizedRequestList`, `CollectionRequestTree` (folders), `useFolderExpandStore`, `postmanParser`, `postmanExporter`, `importScanner`, `dotenvImport` (only `dotenvImport.test.ts` exists, out of scope).
- **No drag-and-drop** for collections/requests exists in code (only TabBar and the ImportDialog file drop zone), and no UI for `moveRequest`. There is also no collection duplicate. Do not expect tests for these. They are product gaps, not test gaps.
- `.feature.md` collections scenarios all have a matching e2e test (names match); no mismatch there. Import: 0 of 4 implemented as e2e.

## 2) Coverage matrix

| Behavior | Unit | E2E | Notes |
|---|---|---|---|
| Header: logo/brand | LeftPanel.spec "renders app header..." | home.spec "should load and display branding" | OK |
| Header icon: Transform Playground nav | none (only Settings link) | home.spec "navigate to Transform Playground" | OK |
| Header icon: JSON Visualize nav (also fires store reset on click) | none | none | Gap |
| Header icon: JSON Compare nav | none | none | Gap |
| Header icon: Settings nav | LeftPanel.spec "Settings control links to settings route" | home.spec "navigate to Settings" | OK |
| Tabs Collections/History switch | LeftPanel.spec "switches sidebar tab content..." | history.spec (clicks history tab) | OK |
| Global/Hub tab (renders HubTab) | affordance render only | none | Weak |
| "+" menu: HTTP opens HTTP tab | none | requests/collections via `openTab` helper (indirect) | No unit |
| "+" menu: GraphQL | none | graphql.spec (uses trigger) | OK-ish |
| "+" menu: WebSocket / Socket.IO | none | websocket.spec, socketio.spec | OK-ish |
| "+" menu: Collection sets creating flag, input appears | useUIStore "setIsCreatingCollection and setIsCreatingEnv toggle"; CollectionTree "reveals new collection input" | collections.spec "Create a new collection" | OK |
| "+" menu: Environment | SidebarMainTab "creates environment on Enter..." (store flag path) | environments.spec (not verified through "+" menu) | Dropdown item itself untested |
| "+" menu: Chain | SidebarMainTab 'New chain calls onNewChain' (section button, not menu) | chain.spec uses `create-chain-item` | OK e2e |
| "+" menu: Import opens dialog | none (LeftPanel opens ImportDialog via `isImportOpen`, untested) | none | Gap |
| Search filter: requests by name or URL, case-insensitive | none | none | Gap |
| Search: environments (click opens env manager focused) | none | none | Gap |
| Search: chains (click navigates) | none | none | Gap |
| Search: click request reuses existing tab vs opens new | none | none | Gap |
| Search: no results message | LeftPanel.spec "shows cross-resource search results..." (asserts only no-results) | none | Weak (name misleading) |
| Search: clear (X) button | none | none | Gap |
| Search on History tab filters history | LeftPanel.spec "search input updates and passes filter..." | history.spec (maybe) | OK |
| Sections COLLECTIONS/ENVIRONMENTS/CHAINS render | SidebarMainTab "renders ... section labels", "embeds collection tree and chain list" | none | Unit only |
| Section collapse persistence (localStorage `SIDEBAR_SECTIONS_STORAGE_KEY`, defaults, corrupt/blocked storage) | none | none | Gap |
| Section auto-expand on create | SidebarMainTab auto-expands (3 tests) | none | OK |
| Expand/collapse-all folders toggle | none | none | Gap |
| Environments empty state | SidebarMainTab "shows empty environments state..." | none | OK |
| Environment create via inline input (Enter) | SidebarMainTab test | environments.spec | OK |
| Environment create Escape/blank cancel | none | none | Gap |
| Environment rename/delete from sidebar (pendingDeleteId confirm) | none | environments.spec (unverified for sidebar) | Gap |
| Collection create (Enter, non-empty) | CollectionTree "creates a collection when Enter..."; store "createCollection" | collections.spec "Create a new collection" | OK |
| Collection create with empty/whitespace name, Escape, duplicate names | none | none | Gap |
| Collections empty state | CollectionTree "shows empty state..." | none | OK |
| Collection rename (commit on blur) | CollectionTree "opens rename flow..."; store "renameCollection" | collections.spec "Rename a collection" (Enter) | OK; empty-name and Escape untested |
| Collection delete + confirm | CollectionTree "opens delete confirmation..."; store "deleteCollection removes nested requests and closes tabs", "cascades chain" | collections.spec "Delete a collection" | OK; cancel path untested |
| Collection expand/collapse | CollectionTree "expands accordion..." | collections.spec "Collection collapses and expands" | OK |
| Collection request count badge | CollectionTree "renders collections with names and request counts" | none | OK |
| Collection menu: New Folder | none | none | Gap |
| Collection export "Export as Postman" | none | none | Gap (no spec for `postmanExporter`) |
| Folder create (nested, null parent), rename, duplicate (deep), delete (cascade) | none (store `createFolder/renameFolder/duplicateFolder/deleteFolder` not in useCollectionsStore.spec) | none | **High gap** |
| Folder nesting render, descendant request count (`countDescendantRequests`) | none | none | Gap |
| Folder expand persistence (`useFolderExpandStore`, `rq_collapsed_folders`) | none | none | Gap |
| Folder rename blank falls back to old name | none | none | Gap |
| Request open from sidebar (new tab) | RequestItem "opens a new tab when clicked..." | collections.spec "Open a saved request from the sidebar" | OK |
| Request open reuses existing tab | RequestItem "activates existing tab..." | none | Unit only |
| Request rename | RequestItem "starts inline rename..." | none | Unit only |
| Request duplicate (name "(copy)", same folder) | RequestItem "duplicate adds a copied request..." | none | Unit only; folderId carry-over unasserted |
| Request delete + confirm | RequestItem "delete confirmation removes request"; store "deleteRequest removes request and closes tab" | collections.spec "Delete a request from a collection" | OK |
| Request Copy as cURL (clipboard failure toast) | none in RequestItem.spec | requests.spec "Export a request as cURL" (URL bar) | Gap for sidebar menu |
| Request Export as Postman | none | none | Gap |
| Request move between collections | store "moveRequest changes collection id" | none | No UI in code (dead action?) |
| Request update/dirty indicator | store "updateRequest patches fields" | collections.spec "Update a saved request shows dirty indicator and saves" | OK |
| Save request modal: pick collection, name, save | SaveRequestModal.spec (5 tests) | collections.spec "Save a new request..." | OK |
| Save to new collection from modal | SaveRequestModal "creates new collection...", "switches to new-collection UI" | collections.spec "Save a request to a new collection..." | OK |
| Save modal: blank name validation, save into a folder | none | none | Gap |
| Virtualized list (cap MAX_VISIBLE=10, ITEM_HEIGHT=32, many items) | none | none | Gap |
| Health dot: shown only when `showHealthMonitor` and url set | none | none | Gap |
| Health dot colors (>=95 green, >=80 amber, else red) | HealthDot.spec only one success case, no color assertion | none | Weak |
| Health metrics (normaliseUrl, key, min sample, p50/p95, window) | healthMonitor.spec (4 describes) | none | OK |
| Health dot hidden below min sample size; HealthPopover content/"view in history" | none | none | Gap |
| Hydrate / persistence of collections | store "hydrate ...", "persistCollection error surfaces toast" | clearCollectionsDB helper only | No reload-persistence e2e |
| Bulk import to store (`bulkImportCollection`, `importParsedPostmanCollection`) | store "bulkImportCollection merges..." | none | `importParsedPostmanCollection` untested directly |
| Import dialog: open, Cancel, Scan disabled until input | ImportDialog.spec (3 tests) | none | Unit only |
| Import cURL (dialog) | ImportDialog "scans and imports valid cURL", "shows cURL parse error" | none (only UrlBar cURL e2e) | Documented scenario not implemented |
| Import Postman (file) | ImportDialog "scans Postman JSON file then imports on confirm"; page.spec "imports Postman collection v2.1" | none | Documented-only e2e; folder nesting preservation not asserted |
| Import Insomnia | insomniaParser.spec (parser only); no dialog/page test | none | Gap at integration level |
| Import OpenAPI | openapiParser.test (3 tests); no dialog/page test | none | Gap; YAML path untested |
| Import invalid file error | ImportDialog "shows scan error on unrecognized JSON file"; page.spec "invalid JSON", "unsupported shape" | none | Documented-only e2e |
| Import: drag-drop onto zone, file extension accept, empty file | none | none | Gap |
| Import page `/import` Raw JSON tab (Requestly format) | page.spec (3 tests) | none | OK unit |
| Import "imports nothing" on failure (no partial state) | not asserted | none | Gap |

## 3) Missing unit tests

**High**
- `src/stores/useCollectionsStore.ts`: `createFolder`, `renameFolder`, `duplicateFolder` (nested subtree, new ids, parentFolderId remap, requests cloned), `deleteFolder` (cascade to subfolders + requests + closes tabs). Zero coverage for the whole folder feature.
- `src/lib/importScanner.ts`: `scanFileContent` format detection ordering (Insomnia vs OpenAPI vs Postman), `scanOpenApiText`, `scanCurlText`, error messages. Only exercised indirectly with mocks.
- `src/lib/postmanParser.ts`: `isPostmanCollection`, `parsePostmanCollection` (nested folders, auth types, bodies, `PostmanParseError` for no requests, variables). No spec.
- `src/lib/postmanExporter.ts`: `exportToPostmanCollection` round-trip (folders, bodies, auth), `downloadPostmanCollection/Request`. No spec.
- `src/components/layout/SidebarSearch.tsx`: `SidebarSearchResults` filtering (name/URL/case, envs, chains), grouping, empty state, click handlers (existing tab reuse, env manager open with id, chain navigation), `SidebarSearchInput` clear button.

**Medium**
- `src/components/layout/CreateNewDropdown.tsx`: each item invokes the correct action (`openTab` with each TAB_TYPE, `setIsCreatingCollection`, `setIsCreatingEnv`, `onNewChain`, `onImport`).
- `src/components/collections/CollectionRequestTree.tsx`: nested folder render, `countDescendantRequests`, folder menu (New Folder/Rename/Duplicate/Delete confirm), rename blank fallback, auto-expand parent on subfolder create.
- `src/stores/useFolderExpandStore.ts`: toggle/setExpanded/expandAll/collapseAll/toggleAll/isAllExpanded; persistence; corrupt JSON and blocked storage fallback.
- `SidebarMainTab.tsx`: section open/close persistence (`readStoredSections`/`persistSections`, corrupt value, storage throw -> console.warn), expand/collapse-all button state, environment delete confirm, Escape/blank in new env input.
- `HealthDot.tsx`: color thresholds at 94/95/79/80 boundaries, hidden when below sample size; `HealthPopover.tsx` content.
- `RequestItem.tsx`: Copy as cURL success/clipboard-failure toast, Export as Postman, health dot gated by `showHealthMonitor` and empty url; duplicate preserves `folderId`.
- `ImportDialog.tsx`: Insomnia and OpenAPI import branches (toast, collection created), drag-drop, tab switch resets state, scan failure leaves store untouched. `app/import/page.tsx`: Insomnia/OpenAPI file.
- `LeftPanel.tsx`: "+" Import opens dialog; JSON Visualize/Compare links; Hub tab renders `HubTab`.

**Low**
- `VirtualizedRequestList.tsx`: renders <=10 rows height cap, large list only mounts visible rows.
- `SaveRequestModal`: blank name validation, destination folder.
- `CollectionTree`: blank/whitespace name on create, Escape cancels create/rename, delete cancel keeps collection.
- Store: `moveRequest` has no UI caller (verify if dead code); `loadDemoChain`.
- `openapiParser`: YAML input, `$ref` resolution, multiple servers, query params, auth schemes.
- `insomniaParser`: nested folder groups, env vars, GraphQL requests.

## 4) Missing e2e scenarios (prioritized)

1. **P0** Import Postman: Given Import dialog open, When I upload a Postman v2.1 file with nested folders, Then collection + folders + requests appear in the sidebar tree with nesting preserved (documented in import.feature.md, not implemented; create `e2e/import.spec.ts`).
2. **P0** Import invalid file: Given dialog open, When I upload a non-parsable file, Then an error shows and the sidebar is unchanged (documented, not implemented).
3. **P0** Folder CRUD: Given a collection, When I choose New Folder, rename it, add a request, duplicate and delete it, Then the tree reflects each step and deleting removes child requests (no scenario doc either).
4. **P0** Sidebar search: Given collections/envs/chains with known names, When I type a term, Then matching groups show; clicking a request opens (or activates) its tab; "no results" shows for a miss; clear (X) restores the tree.
5. **P1** "+" menu: When I select each of HTTP, GraphQL, WebSocket, Socket.IO, Collection, Environment, Chain, Import, Then the matching tab/input/dialog appears (single parametrized test).
6. **P1** Import Insomnia and OpenAPI (JSON and YAML) via the dialog; Import cURL via dialog opens populated new tab (scenarios 2 and 3 of import.feature.md).
7. **P1** Persistence: Given collections with a collapsed folder and a collapsed section, When I reload, Then collapse state and collections persist.
8. **P1** Request actions: rename, duplicate ("(copy)"), Export as Postman (download event), Copy as cURL (clipboard) from the sidebar menu.
9. **P1** Collection "Export as Postman": When I export, Then a valid `.json` download with the collection's folders/requests occurs.
10. **P2** Health dot: Given >= min sample history for a saved request, When sidebar renders, Then dot color matches rate; popover opens; hidden when setting `showHealthMonitor` is off.
11. **P2** Header icon buttons: JSON Visualize and JSON Compare navigate; Global/Hub tab shows hub content; switching tabs keeps search query behavior.
12. **P2** Delete collection cancel keeps data; empty/whitespace collection name is rejected; long list (>10 requests) scrolls in virtualized list.
13. **P2** Environment rename/delete from sidebar with confirm.

## 5) Weak tests

- `LeftPanel.spec` "shows cross-resource search results when query is set on collections tab": name promises cross-resource results but only asserts the no-results text. Real results (requests/envs/chains) are never rendered in any test.
- `HealthDot.spec` (single test): asserts only `/success/i` label and any `\d+%`; no color, no tooltip/popover, no threshold, no hidden state. `HealthPopover` untested.
- `SidebarMainTab.spec` "embeds collection tree and chain list": presence check only (mocked children likely), no behavior.
- `LeftPanel.spec` "renders ... tab affordances": presence-only; Hub tab content never verified.
- `home.spec`: only asserts branding text and 2 of 4 header icons; `getByLabel("Settings")` is a loose locator that could match other elements.
- `collections.spec` uses `page.getByText("My Collection")`/`getByText("My API")` (non-scoped text locators, could match toasts or tab titles) and `.not.toBeVisible()` for deletion; plus `.first()` on `collection-item-*` selection, so tests assume a single collection. "Collection collapses and expands" is not dependent on persistence. The e2e suite never tests folders, search, export, import, or reload persistence.
- `import.feature.md` scenarios give a false sense of coverage: 4 documented, 0 e2e; the cURL e2e that exists tests the URL bar, not the Import dialog.
- `ImportDialog.spec` "scans Postman JSON file then imports on confirm": likely mocks scanner/store (verify), so it doesn't prove folder nesting is preserved; `useCollectionsStore.spec` "bulkImportCollection merges..." does not cover folders (default `folders = []`).
- `RequestItem.spec` "duplicate adds a copied request": doesn't assert `folderId`, name suffix details beyond collection membership (verify), nor tab/sidebar side effects.
- `useUIStore.spec` covers `setIsCreatingCollection/Env` flags only as booleans; no integration with the dropdown.
