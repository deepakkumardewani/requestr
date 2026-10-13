# Coverage audit: HTTP Request Builder (Send and Save)

Read-only audit. Date 2026-10-08, branch feature/ai-agent.

## 1) Files inspected

Source:
- src/lib: requestRunner, resolveRequest, variableResolver, utils (buildFinalUrl, buildUrlWithParams, syncParamsFromUrl, parseQueryString, parsePathParams, mergeKvHeaders, prependGlobalBaseUrl), curlParser, curlGenerator, curlToRequest, codeGenerators, scriptRunner, bodyFormData, shareLink, requestTemplates, activeEnvVars, responseMetrics, timingParser, methodColors, constants
- src/app/api/proxy/route.ts (+ spec)
- src/hooks: useSendRequest, useSaveRequest, useKeyboardShortcuts
- src/components/request: UrlBar, ParamsEditor, HeadersEditor, AuthEditor, BodyEditor, ScriptEditor, AdvancedTab, CurlEditor, CodeGenPanel, CodeGenDialog, ShareButton, ShareModal, TemplateGalleryModal, RequestTabs, tabs/HttpTabs
- src/components/response: ResponsePanel, HeadersViewer, and the other response viewers
- src/components/layout/RequestBreadcrumb.tsx, src/components/collections/SaveRequestModal.tsx, src/components/common/KVTable.tsx
- src/types/index.ts

Tests:
- Specs for all of the above
- e2e/requests.spec.ts, auth.spec.ts, body.spec.ts, response.spec.ts (plus grep of tabs, collections and settings specs)
- e2e/scenarios/{requests,auth,body,response}.feature.md

Reality check against the brief:
- Auth types are only none, bearer, basic and api-key (header or query). There is NO OAuth and NO "inherit from collection".
- Body types are only none, json, xml, text, html, form-data and urlencoded. There is NO binary, NO raw type and NO graphql body. GraphQL is a separate tab type.
- The magic-wand button is the AI Request Builder (`ai-builder-wand-btn`), not a template gallery.
- TemplateGalleryModal is not mounted anywhere (orphan). Templates are used only through common/SampleRequestCards.
- Code gen has 9 languages: cURL, fetch, axios, Python, Go, Ruby, Java, C#, PHP. It is shown in ResponsePanel as a tab and in RequestItem via CodeGenDialog.
- The proxy accepts `sslVerify` from the client but route.ts never reads it, so the SSL toggle is a no-op (see 3 and 4).

## 2) Coverage matrix

Legend: U = unit, E = e2e. "none" means no test found.

| Behavior | Unit | E2E | Notes |
|---|---|---|---|
| Method dropdown: select method | UrlBar.spec "method selector updates tab method" | requests.spec "Change HTTP method" (GET to PUT) | Only 1 method changed per layer. Checkmark on selected and per-method badge colors have no assertion. |
| Method colors / palette | methodColors.spec (all methods) | none | OK |
| HEAD / OPTIONS / DELETE send behavior | none | none | No test that HEAD sends no body or OPTIONS works. The body editor is still shown for GET/HEAD and the body is still sent (runRequest ignores method). |
| GET with a body | none | none | buildBody sends the body regardless of method, and fetch will throw on GET with body. Untested. |
| URL input, Cmd/Ctrl+Enter sends | UrlBar.spec "renders URL input and send triggers send"; useKeyboardShortcuts.spec Ctrl/Cmd+Enter | none (button click only) | Cmd+Enter inside the URL input not e2e-tested. |
| URL to params sync (typing a query) | utils.spec syncParamsFromUrl (2 tests) | requests.spec "Send a request with query parameters" | Edge cases untested: duplicate keys, empty value, `a=` with no value, `+` vs %20, fragment `#`, URL with `{{var}}` containing `?`. |
| Params to URL sync (table edit) | utils.spec buildUrlWithParams (2 tests) | requests.spec "Disable a query parameter" (asserts URL string) | ParamsEditor has NO spec. Duplicate keys are not covered. Preserving the `#fragment` is not covered. |
| Disabled param rows | buildUrlWithParams "no enabled params" | "Disable a query parameter" | Re-enable path not tested. |
| Path params (:id) | utils.spec parsePathParams, buildFinalUrl "encodes path params" | requests.spec "Send a request with path parameters" | Path-param value with `/` or spaces, and two params sharing a name, are untested. `replace` only replaces the first occurrence. |
| Query encoding at send | buildFinalUrl (1 test) | none | Not tested: `{{var}}` in a param, double-encoding when the URL already holds `?a=1` AND the table has the same key. buildFinalUrl appends both `existingQuery` and params, so duplicates may result. See Weak. |
| Headers add / disable / delete | KVTable.spec (update, delete, add draft) | requests.spec "custom headers", "Disable a request header" | The disable e2e only asserts 200, so it does not prove the header was not sent. |
| Headers: merge with global headers, case-insensitive override | resolveRequest.spec "merges global and tab headers"; utils.mergeKvHeaders indirectly | none | mergeKvHeaders has no direct spec (disabled/blank-key handling untested). |
| AI "Suggest headers" | HeadersEditor.spec (5 tests) | none | HeadersEditor.spec covers ONLY the AI button; add/edit/delete of headers is not tested there. |
| Auto headers (Content-Type from body, Authorization) | requestRunner.spec "posts merged headers and JSON body" (json only) | body.spec / auth.spec (via echo) | xml, urlencoded and the user-supplied Content-Type-wins case are untested in the runner. The case-sensitive `headers["Content-Type"]` check misses a user-set lowercase `content-type`, giving a duplicate header. NOT tested. |
| Auth none | AuthEditor.spec (switch shows fields) | auth.spec "no authentication", "Clear authentication" | OK |
| Auth bearer | curlGenerator.spec "bearer"; requestRunner.spec (token) | auth.spec "Bearer token" | Empty token produces `Bearer ` and is untested. |
| Auth basic | AuthEditor.spec "basic auth updates"; curlGenerator.spec | auth.spec "Basic Auth" | `btoa` throws on non-Latin1 (unicode password). Untested; this is a likely crash in runRequest. |
| Auth api-key header | curlGenerator.spec | auth.spec "API Key in header" | OK |
| Auth api-key query | requestRunner.spec "appends api-key to query" | auth.spec "API Key in query parameter" | Not covered: the key is appended after the URL even when the URL has a `#fragment`; the key is not shown in the URL bar. |
| Auth var substitution ({{token}}) | codeGenerators.spec resolveTabStateVars (redaction) | none | Send path resolves headers/url/body but is `tab.auth` resolved at send? `useSendRequest` passes `tab.auth` unresolved to runRequest. Possible bug: `{{token}}` in auth is not substituted at send time. Untested. |
| Body none | BodyEditor.spec "none shows empty state" | body.spec "no body" | OK |
| Body json | BodyEditor.spec "switching to JSON"; curlGenerator | body.spec "JSON body" | Invalid-JSON handling and beautify are untested. |
| Body xml / text / html | BodyEditor AI test lists types; requestRunner has no xml test | body.spec xml, text | html type has no e2e or runner test. text and html do not get a default Content-Type (only json/xml/urlencoded do). Untested. |
| Body form-data | BodyEditor.spec "form-data shows KV table"; curlGenerator.spec; bodyFormData.spec (12) | body.spec "form-data body" | The runner sends `body.content` for form-data (NOT multipart, comment says unsupported). No file upload. No Content-Type boundary. The scenario passes only because the echo accepts anything. |
| Body urlencoded | curlGenerator.spec; bodyFormData.spec | body.spec "URL-encoded body" | requestRunner.buildBody urlencoded branch (encodeURIComponent, empty to null) has NO unit test. |
| Body "Disable a form-data field" | none | none (scenario exists in body.feature.md but is NOT implemented) | Mismatch (see 4). |
| Body binary / raw / graphql | n/a | n/a | Not implemented. Document as a feature gap only. |
| Scripts: pre-request | scriptRunner.spec (4 tests) | requests.spec "Pre-script console.log", "injects a request header" | Pre-script env.set is not reflected in `{{var}}`, since variables are resolved BEFORE the script runs. |
| Scripts: post-response | scriptRunner.spec (3) | requests.spec "Post-script reads response status", "parses response JSON" | `response.headers.get` ok. |
| Script errors | scriptRunner.spec "returns script error" (pre+post); useSendRequest.spec "surfaces pre-script errors via toast but continues" | none | Post-script error toast is untested at hook level. |
| Script sandbox / security | none | none | `new Function` with no isolation (window, fetch, localStorage reachable). No timeout, so `while(true)` freezes the tab. Async scripts / unhandled promise rejections are untested. |
| Script persistence between pre/post | none | requests.spec "Script content persists when switching" | OK |
| Script AI | ScriptEditor.spec (8) | none | Only AI paths are tested; the lint/check-syntax (scriptLinter.ts) has NO spec. |
| Advanced: timeout | none (AdvancedTab has no spec) | none | Clamp (max 600_000, min 1 s in proxy), blank resets to default, non-numeric input untested. DEFAULT 30_000 is passed through in useSendRequest.spec only indirectly. |
| Advanced: timeout error | requestRunner.spec covers only network/parse/proxy errors (NO "TIMEOUT" test); proxy route.spec NO 504 test | none | RequestError type "timeout" and proxy `AbortError` to 504 are completely untested. |
| Advanced: follow redirects | proxy route.spec "redirect manual" | none | requestRunner defaulting (tab > global) untested apart from the proxy. |
| Advanced: SSL verify | none | none | route.ts ignores `sslVerify`. The setting has no effect. Likely product bug; also an untested toggle. |
| Env var substitution at send | resolveRequest.spec (about 25 tests), variableResolver.spec (8); useSendRequest.spec "resolves ... exactly once" | environments.spec (outside this area; not verified) | Missing: variable in auth, nested variable `{{a}}` resolving to `{{b}}`, hyphenated name (documented as unsupported). |
| Unresolved-variable guard | useSendRequest.spec (HTTP block, force bypass, GraphQL block); resolveRequest.spec (6) | none | The warning banner and "Send anyway" are not e2e-tested. |
| Global base URL | resolveRequest.spec "prepends global base URL"; utils.prependGlobalBaseUrl no direct spec | settings.spec (not verified) | |
| Send success | useSendRequest.spec "runs HTTP GET and logs history" | requests.spec "Send a GET request" etc. | Real dummyjson.com network in e2e (see Weak). |
| Send error (network) | requestRunner.spec "network RequestError"; useSendRequest "handles request failure" | response.spec "network error state" | OK |
| Send error (proxy 4xx/5xx upstream) | proxy route.spec 502 | response.spec "4xx/5xx details" | OK |
| Send timeout | none | none | See Advanced. |
| Cancel | useSendRequest.spec "cancel clears loading flag"; requestRunner.spec "passes AbortSignal"; UrlBar.spec "Cancel invokes cancel" | requests.spec "Cancel an in-flight request" | Resend aborts the previous request (`abortRef.abort`). Untested. After cancel the e2e expects an ERROR state, which is arguably a UX bug (cancel shown as "Failed to reach proxy"). |
| Large response / limits | proxy route.spec "413 Content-Length", "413 actual body" | none | MAX_RESPONSE_DISPLAY_BYTES (10MB) UI truncation has no test. |
| Binary / non-UTF8 response | none | none | `upstream.text()` corrupts binary. Images preview isn't handled. |
| Response status / color | none for badge | response.spec "status code and color" | |
| Response time / size | responseMetrics.spec (request size only) | response.spec "size and duration" | |
| Timing waterfall | timingParser.spec, TimingWaterfall.spec | response.spec "timing breakdown" | |
| Pretty / raw / preview | ResponsePanelTabs.spec (auto-detect, toggle) | response.spec pretty/raw/HTML preview | Invalid JSON with a JSON content-type, empty body, and HEAD (empty) responses are untested. |
| Response headers | HeadersViewer.spec (classify, group, collapse) | response.spec "headers in a table" | |
| Response cookies | none | none | No Set-Cookie handling exists in code (headers are a plain Record, so multi-value Set-Cookie headers are collapsed by the proxy `headers.forEach`). Feature gap and probable bug. |
| Copy / download response | none | response.spec copy, download | |
| Error explainer | ErrorExplainer.spec, errorExplainer.spec | response.spec | |
| Save new request (modal: collection or new collection) | SaveRequestModal.spec (5); useSaveRequest.spec "opens save modal" | collections.spec "Save a new request to a collection", "...to a new collection" | Folder selection inside the modal is not tested; duplicate name, empty name validation not tested. |
| Save existing (Cmd+S) | useSaveRequest.spec "updates collection request, clears dirty"; useKeyboardShortcuts.spec "onSave on Ctrl+S" | none | No e2e for Ctrl/Cmd+S on a saved request; no e2e for the toast. `useKeyboardShortcuts` handles only `e.ctrlKey`? Cmd+S is said to work, only Cmd+K/Enter have Cmd tests. Cmd+S unit test is missing. |
| Dirty state / unsaved indicator | useTabsStore.spec, TabBar.spec | tabs.spec "close a dirty tab", "makeTabDirty" | Dirty after editing params/headers/body/auth (not just URL) untested; dirty cleared after save has only the hook-level test. |
| Breadcrumb "New Request > unsaved" | none (RequestBreadcrumb has NO spec) | none | Saved state "Collection > name" and the fallback (request deleted) invisible placeholder also untested. |
| cURL export (copy) | curlGenerator.spec (14); CurlEditor.spec "renders generated cURL" | requests.spec "Export a request as cURL" | Does not test `--insecure`, form-data file, variable resolution/secret exposure in the copied cURL (handleCopyCurl resolves vars). |
| cURL import (paste + popover) | curlParser.spec (12), curlToRequest.spec, CurlEditor.spec; UrlBar.handlePaste has no test | requests.spec "Import a request from a cURL command" | Not covered: `-d @file`, `--json`, `-G`, `-b`, `--url`, `-F` multipart, `$'..'` quoting, double-quote escapes, `-I` (HEAD), `--compressed`. -F form-data is not in the supported flag list. Pasting cURL into the URL bar (handlePaste) is untested. |
| Code gen: cURL | curlGenerator.spec | none | |
| Code gen: fetch / axios / Python / Ruby / Java / C# / PHP / Go | codeGenerators.spec (1 to 3 tests per language) | none | One or two happy-path asserts per language. No coverage of auth, api-key query, urlencoded, form-data, headers escaping, quotes in body, unicode. CodeGenPanel (language switch, copy) has NO spec. CodeGenDialog from RequestItem has none. |
| Copy (URL / cURL) | none for toast failure | requests.spec "Export as cURL" (clipboard) | handleCopyCurl failure toast untested. |
| Share link | shareLink.spec (14), ShareModal.spec (3), shareServer.spec, shareRateLimitLocal.spec | none | ShareButton disabled state (no URL / non-http) untested. Opening a shared link (fetchSharePayload to open tab) has lib-level tests but no e2e. |
| AI request builder (wand) | UrlBar.spec (7 tests) | none | |
| Template gallery | none | none | TemplateGalleryModal is not mounted. requestTemplates.ts (`templateToTabState`) has no spec. |
| RequestTabs (Params/Headers/Auth/Body/Scripts/Advanced) | RequestTabs.spec, HttpTabs.spec | requests.spec (tab clicks) | Badges (counts) and Advanced tab not e2e-tested. |
| History entry on send | useSendRequest.spec "logs history" | history.spec (outside area) | |

## 3) Missing unit tests

High
- src/lib/requestRunner.ts `buildBody` / `buildHeaders` (not exported; test via runRequest): urlencoded body encoding and empty-fields null; xml and urlencoded default Content-Type; user-supplied Content-Type (any case) is not overridden or duplicated; basic auth with unicode password (btoa throws); empty bearer; text/html body; form-data fallthrough.
- src/lib/requestRunner.ts `executeProxy`: `code === "TIMEOUT"` gives RequestError type "timeout"; `sslVerify`, `followRedirects` and `timeoutMs` defaults in the payload.
- src/app/api/proxy/route.ts: 504 TIMEOUT on AbortError; timeoutMs clamping (1_000..600_000, non-number falls to default); request body and headers actually forwarded upstream; method uppercased; X-Timing headers; `sslVerify` is ignored (documents bug); multi-value Set-Cookie.
- src/hooks/useSendRequest.ts: auth `{{var}}` is not resolved at send (possible bug); post-script error toast; post-script runs and its logs merge; previous request aborted on re-send; per-tab overrides of sslVerify, followRedirects and timeoutMs vs the global setting; body-less HEAD/GET.
- src/lib/scriptRunner.ts: async script / rejected promise handling, infinite loop (no guard), `requestly.request.headers.delete/get`, `url.set`, `body.set` overrides flowing through, `environment.get` fallback to "", post-script `response.json()` with invalid JSON, console levels formatting (warn/error/info prefix).
- src/lib/utils.ts `buildFinalUrl`: duplicate query (URL query and table both present), repeated `:param`, path value with `/` or space, `{{var}}` in value, disabled rows, port colon `:8080` not treated as param.
- src/lib/utils.ts `syncParamsFromUrl`/`buildUrlWithParams`/`parseQueryString`: duplicate keys, empty values, `+` vs `%20`, fragment, relative URLs, malformed percent-encoding.

Medium
- src/components/request/ParamsEditor.tsx (no spec): query edit updates URL, path params read-only, disabled rows leave the URL.
- src/components/request/AdvancedTab.tsx (no spec): timeout draft parsing and clamp, blank resets to undefined, SSL switch with "reset to global", follow-redirects switch.
- src/components/layout/RequestBreadcrumb.tsx (no spec): unsaved, saved, collection missing.
- src/components/request/CodeGenPanel.tsx and CodeGenDialog.tsx (no spec): language switching, copy, variable resolution, secret redaction toggle.
- src/lib/codeGenerators.ts: auth variants, urlencoded/form-data, quote and newline escaping in every language, `api-key` query for each, and Go/PHP/Ruby/Java/C# bodies for JSON.
- src/lib/curlParser.ts: `-F`, `--json`, `-G`, `-I`, `--url`, `-b`, `-d @file`, quotes and escapes, multiple `-d`, `-H` with empty value, `--data-binary`.
- src/components/request/UrlBar.tsx `handlePaste` (cURL paste into URL), `handleCopyCurl` failure path, HEAD/OPTIONS menu items and checkmark, Cmd+Enter in URL input.
- src/hooks/useKeyboardShortcuts.ts: Cmd+S (macOS) for `onSave`.
- src/components/request/HeadersEditor.tsx: add / edit / disable / delete (only the AI button is tested).
- src/components/request/AuthEditor.tsx: bearer and "none" clear; tokens containing `{{var}}`.
- src/components/collections/SaveRequestModal.tsx: folder choice, empty-name validation, duplicate names.

Low
- src/lib/requestTemplates.ts `templateToTabState` and every template's shape; decide whether TemplateGalleryModal should be deleted.
- src/lib/utils.ts `mergeKvHeaders`, `prependGlobalBaseUrl`, `isRelativeOrPathOnlyUrl` direct tests.
- src/lib/scriptLinter.ts (no spec).
- src/components/request/ShareButton.tsx disabled states.
- ResponsePanel: truncation above MAX_RESPONSE_DISPLAY_BYTES; empty body; invalid JSON under a JSON content-type.

## 4) Missing e2e scenarios (prioritized)

P0
1. Given a saved request, When I edit the URL and press Cmd/Ctrl+S, Then the dirty dot disappears, a success toast shows and reopening the request keeps the edit.
2. Given an unsaved tab, Then the breadcrumb reads "New Request > unsaved"; When I save into a collection, Then it reads "<Collection> > <name>".
3. Given a request to an endpoint slower than a short timeout set in Advanced, When I send, Then a timeout error state (not the generic network error) is shown.
4. Given a request to a mocked/echo endpoint, When I disable a header or a param, Then the echo response proves the header or param was not sent (current disable tests only check 200).
5. Given a URL containing `{{baseUrl}}` with the variable undefined, When I send, Then the unresolved-variables warning appears and "Send anyway" dispatches it. With an active environment, Then it resolves in URL, header, body and auth.
6. Given a cancelled request, Then the UI returns to idle (no failure toast / error state) and sending again works.

P1
7. Given the method menu, When I open it, Then all 7 methods are listed with a checkmark on the selected one; HEAD returns headers with an empty body and a status 200.
8. Given a URL with `?a=1&a=2&b=`, When I open Params, Then three rows appear; editing a value updates the URL; typing `%20` or a unicode value round-trips.
9. Given Advanced, When I toggle follow redirects off and call a redirecting endpoint, Then status 3xx and a Location header are shown; when on, the final 200 is shown.
10. Given a form-data body with one disabled field (existing scenario "Disable a form-data field"), When I send, Then the echo shows only the enabled field.
11. Given a pre-script that throws, When I send, Then an error toast appears, the request still runs and the Console tab shows logs; a post-script `environment.set` makes the next request resolve `{{token}}`.
12. Given the code-gen tab, When I switch across all 9 languages, Then each snippet contains method, URL, header and body, and Copy puts it in the clipboard.
13. Given a share button on an http tab, When I click it, Then a link is generated and opening it in a new context restores the request (secrets handling per product spec).
14. Given a cURL pasted straight into the URL bar, Then the tab fields are populated and a toast shows "cURL imported"; a malformed cURL shows an error toast and leaves the tab unchanged.
15. Given a response over the display limit, Then a truncation message is shown and Download still gives the full body.

P2
16. Given the wand button, When I describe a request (AI mocked), Then Apply fills method, URL, headers and body.
17. Given a request with api-key in query, Then the final URL (history entry or copied cURL) contains the key.
18. Given a response with multiple Set-Cookie headers, Then all cookies are listed (currently collapsed; likely product gap).
19. Given a HEAD or 204 response, Then Pretty/Raw show an empty state.
20. Given the Advanced SSL toggle, Then the setting persists per request and "reset to global" restores it (and document that it has no server effect).

Scenario doc vs implementation mismatches
- requests.feature.md lists 11 scenarios, all 11 are implemented. requests.spec.ts has 6 extra script tests (Scripts tab default, console.log, post-script status, header injection, json(), persistence) that are NOT in the feature file; add them to the doc.
- auth.feature.md: 6 of 6 implemented.
- body.feature.md: "Disable a form-data field" is documented and NOT implemented in body.spec.ts. 6 of 7 implemented.
- response.feature.md: 11 of 11 implemented.
- No scenario exists for: save/Cmd+S, breadcrumb, Advanced, share, code gen, templates, variables (environments.feature.md may cover variables), HEAD/OPTIONS.

## 5) Weak tests

- e2e/requests.spec.ts "Disable a request header" and "Disable a query parameter": final assertion is only status 200, which would also pass if the header or param were still sent. Query test does check the URL string, header test checks nothing about the request.
- e2e (requests, auth, body, response): all hit live https://dummyjson.com with no `page.route` mocks, so they are network-dependent and can flake or fail offline; timing/size assertions depend on a third party.
- e2e/requests.spec.ts "Cancel an in-flight request": passes when the result is `response-error-state` containing "Failed to reach the proxy server|abort|cancel", which encodes arguably wrong behavior (cancel presented as a failure) and the regex is loose.
- e2e/body.spec.ts "form-data body": passes while the runner does not send multipart (content only), so it does not prove real form-data semantics.
- e2e/auth.spec.ts API key and Bearer: only assert 200 and echo if the echo asserts; verify they assert the received header value (not confirmed in this audit).
- src/hooks/useSendRequest.spec.ts: mocks runRequest and the resolver; it never checks the exact payload passed for auth, sslVerify, followRedirects or timeoutMs, so the unresolved-auth-variable issue goes unnoticed.
- src/components/request/UrlBar.spec.tsx "method selector updates tab method": exercises one method; four of the seven UrlBar tests depend on mocked children, and 7 of 12 tests are about the AI builder rather than core send/save.
- src/components/request/HeadersEditor.spec.tsx: file name suggests editor coverage but all 5 tests are about AI suggestions.
- src/components/request/AuthEditor.spec.tsx: bearer and "none" are not in the spec; only 4 tests.
- src/lib/codeGenerators.spec.ts: one or two substring assertions per language; Go/PHP "emit CURLOPT_CUSTOMREQUEST and net/http patterns" is a pattern grep that would pass with broken output.
- src/lib/scriptRunner.spec.ts "isolates env helpers from outer scope": scripts are not sandboxed at all (`new Function`), so the name over-claims.
- src/app/api/proxy/route.spec.ts: no body-forwarding or timeout assertions, so the happy-path test could pass if headers/body were dropped (not confirmed).
- src/lib/utils.spec.ts `syncParamsFromUrl` (2 tests) and `buildFinalUrl` (1 test) cover the most bug-prone URL logic with a single happy path each.
