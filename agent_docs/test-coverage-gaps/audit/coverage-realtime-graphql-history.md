# Coverage audit: GraphQL, WebSocket, Socket.IO, History

## 1) Files inspected
Source: src/stores/{useConnectionStore,useHistoryStore,useTabsStore}.ts, src/hooks/{useSendRequest,useSaveRequest}.ts,
src/lib/{graphqlIntrospection,requestRunner,historyExport,constants}.ts, src/components/request/{ConnectButton,MessageLog,GraphQLSchemaExplorer}.tsx,
src/components/request/tabs/{GraphQL,WebSocket,SocketIO}Tabs.tsx, src/components/history/{HistoryList,HistoryItem}.tsx,
src/components/settings/ClearHistoryDialog.tsx, src/app/settings/SettingsPageClient.tsx, src/components/layout/{Tab,TabContextMenu}.tsx.
Tests: src/stores/{useConnectionStore,useHistoryStore}.spec.ts, src/components/history/*.spec.tsx, src/components/request/tabs/{GraphQL,WebSocket}Tabs.spec.tsx
(WebSocketTabs.spec also holds SocketIOTabs), src/hooks/useSendRequest.spec.ts, src/lib/{requestRunner,resolveRequest}.spec.ts,
e2e/{graphql,websocket,socketio,history}.spec.ts and e2e/scenarios/{graphql,websocket,socketio,history}.feature.md.
No src/app/api route is specific to these areas (GraphQL goes via /api/proxy; WS/Socket.IO are direct from the browser).
There is NO spec for: ConnectButton, MessageLog, GraphQLSchemaExplorer, SocketIOTabs (only 2 trivial tests), graphqlIntrospection.ts, historyExport.ts, ClearHistoryDialog, Tab connection dot.

## 2) Coverage matrix
Code facts that shape the matrix: GraphQL send returns BEFORE addEntry (never in history); history is HTTP-only and success-only (failed requests are not recorded);
HistoryItem always reopens as type "http"; no date grouping; no operationName UI input; WS/Socket.IO headers editor is not passed to connect(); Socket.IO only listens to "message" event;
no auto-reconnect; closeTab never calls disconnect; save is http-only (useSaveRequest.ts:22).

| Behavior | Unit | E2E | Notes |
|---|---|---|---|
| GraphQL query editor updates store | GraphQLTabs.spec "query tab shows editor and updates store" | graphql.spec "sends a query..." | ok |
| GraphQL variables editor | GraphQLTabs.spec "switching to variables tab..." | graphql.spec "sends variables..." | ok |
| Variables not an object -> parse error | requestRunner.spec "throws parse RequestError when variables JSON is not an object" | none | invalid JSON syntax (vs non-object) and `null` variables untested |
| operationName sent in body | requestRunner.spec "builds POST body with query, variables, and operationName" | none | No UI to set operationName (only context-menu duplicate copies it) - feature gap |
| Empty query warns | useSendRequest.spec "warns when GraphQL query resolves empty" | none | |
| Unresolved {{var}} blocks send | useSendRequest.spec "blocks GraphQL send when unresolved..." (headers); resolveRequest.spec (url/query) | none | sendForce path for GraphQL untested |
| Env var in variables / operationName resolved | none | none | resolveVariables(tab.variables) untested |
| GraphQL headers | GraphQLTabs.spec "headers badge when headers present" | NONE (scenario "Set custom headers" documented, not implemented) | doc/e2e mismatch |
| GraphQL auth (bearer/api-key in query) | requestRunner api-key-in-query branch not directly tested for GraphQL | e2e only checks Auth tab visible | |
| GraphQL errors (HTTP error, `errors[]` in 200 body, network) | useSendRequest catch path generic only | none | |
| Cancel in-flight GraphQL | none specific | none | |
| Schema explorer fetch/search/snippets | NONE | NONE | 497-line component, zero tests |
| fetchGraphQLSchema (proxy fail, parse, errors[], missing __schema, filters __ types) | NONE | NONE | pure logic, easy to test |
| formatTypeRef | NONE | NONE | |
| handleFieldSnippet (dedup root field, indent, append before `}`) | NONE | NONE | |
| Clear query button, schema toggle, Auth dot | NONE | NONE | |
| Save GraphQL to collection | none (save is http-only) | none | likely gap: Save does nothing for graphql/ws/socketio |
| GraphQL recorded in History | useSendRequest.spec "runs GraphQL request ... without history entry" (asserts NO history) | none | locks in current behavior; contradicts user expectation |
| WS connect / disconnect state | useConnectionStore.spec "WebSocket connect opens...", "disconnect clears state..." | websocket.spec connect + disconnect | e2e depends on public wss://echo.websocket.org |
| WS connection error | spec "constructor error calls setError", "onerror surfaces error" | none | onclose retains error: untested; error UI display untested |
| WS Connecting state / disabled when URL empty / variable-resolved URL | none (ConnectButton no spec) | none | |
| WS send text | store spec "sendWebSocketMessage sends when open/returns false when not open" | websocket.spec "send shows sent entry; echo shows received" | |
| WS send empty draft ignored; draft cleared after send; JSON payload | none | none | |
| WS receive + 1000 cap | spec "onmessage appends log with cap" | websocket.spec echo | binary (Blob) message -> String(ev.data) untested |
| Log clear | WebSocketTabs.spec "clear log empties message log" | none | |
| Log filtering | not implemented (no filter) | - | documented-nowhere |
| Auto-reconnect | not implemented (WS); Socket.IO default reconnection disabled by manual disconnect on connect_error | none | |
| Second connect replaces previous | spec "second connect closes previous WebSocket" | none | |
| Handshake headers / query params | NOT implemented: HeadersEditor shown but never passed to connect(); query params only via URL | none | UI misleading; headers tab tested only for render (WebSocketTabs.spec "switching to headers...") |
| Tab close disconnects | NOT implemented (closeTab does not call disconnect) | none | socket leak; only Tab.tsx shows connection dot (no spec for dot) |
| Tab connection dot | none (TabBar.spec mocks it) | none | |
| Socket.IO connect / disconnect | spec "socket.io disconnect handler resets connection" | socketio.spec connect + disconnect | e2e needs local server on :3333 (SOCKETIO_TEST_URL) |
| Socket.IO connect_error | spec "socket.io connect_error disconnects and clears error after disconnect handler" | none | WEAK: name says "clears error"; so user never sees connection error - possible bug |
| Socket.IO emit event+data | spec "emitSocketIoMessage sends when connected / false when not connected / no ref" | socketio.spec emit | emit with custom event name e2e not exercised (verify) ; eventName default "message" when blank untested |
| Socket.IO receive | spec "socket.io message formats JSON object and null", "String fallback when JSON.stringify throws" | socketio.spec echo | only the "message" event is listened; arbitrary named events (socket.onAny) never received - gap/feature |
| Socket.IO emit payload parsed as JSON? | sent as raw string always | none | JSON payload emitted as string; untested/undocumented |
| History entry on HTTP send | useSendRequest.spec (http addEntry) | history.spec "History entry is created..." | e2e hits live dummyjson.com |
| History entry for failed/aborted request | none | none | not recorded by design; untested |
| History for GraphQL / WS / Socket.IO | negative unit only | none | not recorded |
| Date grouping | not implemented | - | |
| History search | HistoryList.spec "filters by url substring from filter prop", "uses UI store history filter...", "shows no matches..." | none | method filter and healthKey match untested; sidebar search input e2e missing |
| Open from history | HistoryItem.spec "opens new tab...", "activates existing tab with same method and url" | history.spec "Open a history entry..." | e2e only checks URL, not headers/body/method; doc says pre-populated headers/body |
| Delete single | HistoryItem.spec "delete removes entry..." ; store "deleteEntry removes entry and calls DB delete" | history.spec "Delete a single history entry" | doc says right-click > Delete; impl is hover trash button (MISMATCH) |
| Clear all | store "clearHistory empties entries and clears DB" | history.spec "Clear all history" | ClearHistoryDialog no spec; Cancel path untested; GeneralSection.spec exists (not checked for clear btn) |
| Limit/eviction (200) | store "addEntry trims to MAX_HISTORY_ENTRIES and deletes overflow from DB" | none | fine |
| Persistence / hydrate | store "hydrate loads...", "early-returns", "shows toast on failure" | history.spec "persists after page reload" | persist/delete/clear DB error toasts untested |
| Compact mode 20 cap | HistoryList.spec "compact mode shows at most 20" | none | |
| Export CSV/JSON | NONE (historyExport.ts no spec; HistoryList export handlers untested) | none | csvCell escaping untested |
| Doc: entry shows "duration" | n/a | history.spec checks url+status only | HistoryItem shows relative time, not duration (doc mismatch) |
| Health metrics from history | store getMetricsForKey/getRecentTimesForKey tests | none | out of scope |

## 3) Missing unit tests
High
- src/lib/graphqlIntrospection.ts `fetchGraphQLSchema`, `formatTypeRef`: network failure, proxy error, non-JSON, `errors[]`, missing __schema, `__` filtering, header enabled/key filtering.
- src/components/request/tabs/GraphQLTabs.tsx `handleFieldSnippet`: empty query, ends with `}`, duplicate root field, indentation.
- src/stores/useConnectionStore.ts: Socket.IO connect_error surfaces error to UI (current behavior clears it), ws onclose preserves error, unmount/tab close disconnect (feature absent - add test with fix).
- src/hooks/useSendRequest.ts GraphQL: sendForce bypass, env-resolved variables/operationName, error path (setError/toast), abort. Decide GraphQL history behavior and test it.
- src/components/request/ConnectButton.tsx: Connect disabled for empty URL, Connecting spinner, Disconnect, env-variable URL resolution.
Med
- src/components/request/GraphQLSchemaExplorer.tsx: fetch idle/loading/error/success, search filter, type expand, snippet generation (buildArgsString, buildFieldSnippet, buildSubfieldLines, argPlaceholder).
- src/lib/historyExport.ts: csvCell escaping (comma/quote/newline), JSON rounding, buildExportFilename, downloadFile; HistoryList export menu.
- src/components/request/MessageLog.tsx: empty state, sent/received styling via data-direction, clear click.
- WebSocketTabs: empty draft no-op, draft cleared after send, Enter/send disabled when connecting. SocketIOTabs: blank event -> "message", emitted event name & payload, own spec file (currently 2 tests inside WebSocketTabs.spec).
- src/components/settings/ClearHistoryDialog.tsx: confirm and cancel.
- src/components/history/HistoryList.tsx: method filter, healthKey match, export hidden in compact, sample cards in empty state.
- HistoryItem: open restores headers/body/auth/scripts; truncated URL.
- Tab.tsx connection dot for ws/socketio.
Low
- requestRunner GraphQL: api-key-in-query auth, `variables: null`, empty operationName omitted, invalid JSON syntax.
- historyStore persistEntry/deleteEntryFromDB/clearHistoryFromDB toast on DB failure; getDB null.
- formatSocketIoPayload edge: numbers/arrays.

## 4) Missing e2e scenarios (prioritized)
1. (High) Given GraphQL request sent / When History opened / Then entry appears (or explicit test asserting it does not) - decide product intent.
2. (High) Given Socket.IO URL unreachable / When Connect / Then an error is visible and Connect re-enabled.
3. (High) Given WS URL invalid / When Connect / Then error shown, no stuck "Connecting".
4. (High) Given connected WS tab / When tab closed / Then connection is closed (server sees close) - currently leaks.
5. (High) Given GraphQL tab with header added / When Send / Then request carries header (scenario "Set custom headers" in graphql.feature.md has no test).
6. (Med) Given schema explorer / When Fetch Schema against countries API / Then Query fields listed; click field inserts snippet in editor.
7. (Med) Given GraphQL server returns errors[] or 400 / When Send / Then error status/body displayed.
8. (Med) Given history with several entries / When typing in sidebar search / Then list filters; clear search restores; no-match state.
9. (Med) Given history item with headers/body / When opened / Then tab has those headers and body (doc scenario promises this).
10. (Med) Given WS connected / When Clear in message log / Then log empty.
11. (Med) Given Socket.IO with custom event name / When Send / Then sent entry; server echo received.
12. (Low) Given >N history entries / When export CSV/JSON / Then download file content.
13. (Low) Given Settings Clear History dialog / When Cancel / Then history remains.
14. (Low) Given sent GraphQL/WS tabs / When reload / Then tab state (query/variables/log) restored.
15. (Low) Given variables invalid JSON in GraphQL / When Send / Then parse error shown.

## 5) Weak tests and doc mismatches
- e2e websocket/socketio: depend on external wss://echo.websocket.org and a local server on :3333 - flaky/environment-dependent; no skip guard if server absent.
- e2e graphql: hits live https://countries.trevorblades.com/; assert only `contains "countries"/"Brazil"`. Status badge "200" only in first test.
- e2e "GraphQL tab shows ... tabs" only checks visibility.
- e2e history: all use live dummyjson.com; "Open into new tab" only asserts URL (not headers/body/method as scenario states); no assertion of duration/method as scenario 1 states.
- Scenario mismatches: history.feature "right-click > Delete" vs hover trash button; "method, URL, status, duration" vs item shows relative time (no duration); graphql.feature has "Set custom headers" with no e2e test; all 4 feature docs have no scenario for errors, clear log, tab close, schema explorer, search, export.
- useSendRequest.spec "runs GraphQL request and stores response without history entry" cements GraphQL-not-in-history; if unintentional it will mask a bug.
- useConnectionStore.spec "socket.io connect_error disconnects and clears error after disconnect handler" asserts the error is wiped (disconnect handler resets error: null) - likely user-visible bug protected by test.
- WebSocketTabs.spec "switching to headers shows KV header columns" implies headers matter for connect; they do not.
- SocketIOTabs coverage: 2 shallow tests ("send disabled when disconnected", "event name field updates").
- HistoryList.spec uses mocked stores; no test for method/healthKey matching branch.
