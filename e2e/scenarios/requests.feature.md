# Feature: HTTP Requests

As a user
I want to create and send HTTP requests
So that I can test and explore APIs

---

## Background

Given the app is loaded
And a new request tab is open

---

## Scenario: Send a GET request

When I enter a valid URL in the URL bar
And the method is set to GET
And I click the Send button
Then the response panel shows the response status
And the response body is displayed

---

## Scenario: Send a POST request with JSON body

When I select POST as the HTTP method
And I enter a valid URL
And I set the body type to JSON
And I enter valid JSON in the body editor
And I click Send
Then the response panel shows the response

---

## Scenario: Send a request with query parameters

When I enter a URL in the URL bar
And I add a key-value pair in the Params tab
Then the URL in the URL bar updates to include the query parameter
When I click Send
Then the request is sent with the query parameters appended

---

## Scenario: Send a request with custom headers

When I enter a URL in the URL bar
And I open the Headers tab
And I add a custom header key-value pair
And I click Send
Then the request is sent with the custom header included

---

# rewritten-by: E-REQ-06 (the existing test titled "Cancel an in-flight request" currently expects an error; it is replaced by the idle-state assertions in E-REQ-06)
## Scenario: Cancel an in-flight request

When I send a request that takes a while to respond
And I click the Cancel button while the request is loading
Then the request is aborted
And see E-REQ-06 for the expected post-cancel UI state

---

## Scenario: Change HTTP method

When I click the method dropdown in the URL bar
And I select a different HTTP method (e.g. PUT, DELETE, PATCH)
Then the method badge on the tab updates to the selected method

---

# strengthened-by: E-REQ-04 (server-side proof via the echo endpoint)
## Scenario: Disable a query parameter

Given I have one or more query parameters added
When I uncheck the toggle next to a parameter row
Then that parameter is excluded from the request URL
When I send the request
Then the disabled parameter is not sent

---

# strengthened-by: E-REQ-04 (server-side proof via the echo endpoint)
## Scenario: Disable a request header

Given I have one or more custom headers added
When I uncheck the toggle next to a header row
Then the header is excluded from the request
When I send the request
Then the disabled header is not included

---

## Scenario: Import a request from a cURL command

When I paste a cURL command into the URL bar
Then the URL, method, headers, and body are automatically populated from the cURL

---

## Scenario: Export a request as cURL

Given I have a request configured with URL, headers, and body
When I open the cURL tab in the request editor
Then a generated cURL command is shown
And I can copy it to clipboard

---

## Scenario: Send a request with path parameters

Given I enter a URL with a path parameter (e.g. /users/:id)
When I open the Params tab
Then the path parameter is listed separately under "Path Params"
When I set a value for the path parameter
Then the URL updates to include the substituted value

---

@medium
# evidence: src/components/request/ScriptEditor.tsx (request-tab-scripts, script-tab-pre, script-tab-post, pre-script-editor, post-script-editor), src/hooks/useSendRequest.ts
## Scenario: Open Scripts tab and see Pre-Request editor by default

# maps to e2e/requests.spec.ts: "Open Scripts tab and see Pre-Request editor by default"
When I click the "Scripts" tab in the request editor
Then the pre-request script editor is visible
And the "Pre-request" sub-tab is selected

---

@medium
# evidence: src/components/request/ScriptEditor.tsx (request-tab-scripts, script-tab-pre, script-tab-post, pre-script-editor, post-script-editor), src/hooks/useSendRequest.ts, src/components/response/ConsoleViewer.tsx (response-console-viewer)
## Scenario: Pre-script console.log output appears in Console tab

# maps to e2e/requests.spec.ts: "Pre-script console.log output appears in Console tab"
Given a pre-request script that calls console.log with a known message
When I send the request
And I open the Console tab in the response panel
Then the logged message is listed in the console viewer

---

@medium
# evidence: src/components/request/ScriptEditor.tsx (request-tab-scripts, script-tab-pre, script-tab-post, pre-script-editor, post-script-editor), src/hooks/useSendRequest.ts
## Scenario: Post-script reads response status via requestly.response.status

# maps to e2e/requests.spec.ts: "Post-script reads response status via requestly.response.status"
Given a post-response script that logs requestly.response.status
When I send the request
Then the Console tab shows the logged status code

---

@medium
# evidence: src/components/request/ScriptEditor.tsx (request-tab-scripts, script-tab-pre, script-tab-post, pre-script-editor, post-script-editor), src/hooks/useSendRequest.ts
## Scenario: Pre-script injects a request header and request succeeds

# maps to e2e/requests.spec.ts: "Pre-script injects a request header and request succeeds"
Given a pre-request script that adds a header via the requestly request API
When I send the request
Then the request succeeds
And the injected header is sent with the request

---

@medium
# evidence: src/components/request/ScriptEditor.tsx (request-tab-scripts, script-tab-pre, script-tab-post, pre-script-editor, post-script-editor), src/hooks/useSendRequest.ts
## Scenario: Post-script parses response JSON via requestly.response.json()

# maps to e2e/requests.spec.ts: "Post-script parses response JSON via requestly.response.json()"
Given a post-response script that logs a field from requestly.response.json()
When I send the request
Then the Console tab shows the parsed field value

---

@medium
# evidence: src/components/request/ScriptEditor.tsx (request-tab-scripts, script-tab-pre, script-tab-post, pre-script-editor, post-script-editor), src/hooks/useSendRequest.ts
## Scenario: Script content persists when switching between pre and post tabs

# maps to e2e/requests.spec.ts: "Script content persists when switching between pre and post tabs"
Given I typed different scripts into the Pre-request and Post-response editors
When I switch between the two sub-tabs
Then each editor still contains the script I typed

---

@critical
# evidence: src/components/layout/Tab.tsx (tab-dirty-indicator), src/components/request/UrlBar.tsx (save-request-btn, url-input), src/components/layout/RequestBreadcrumb.tsx
## Scenario: E-REQ-01: Edit the URL of a saved request and save with the keyboard shortcut

Given a saved request exists in a collection and is open in a tab
When I change the URL in the URL bar
Then the tab shows the dirty indicator (`tab-dirty-indicator`)
When I press Cmd/Ctrl+S
Then the dirty indicator disappears
And a success toast is shown
When I close the tab and reopen the request from the collection
Then the URL bar shows the edited URL

---

@critical
# evidence: src/components/layout/RequestBreadcrumb.tsx (unsaved branch vs collection > request branch), src/components/request/UrlBar.tsx (save-request-btn)
## Scenario: E-REQ-02: Breadcrumb reflects unsaved and saved state

Given a new request tab is open and never saved
Then the breadcrumb shows "New Request" followed by an italic "unsaved" label
When I save the request into a collection with the name "My Request"
Then the breadcrumb shows "<Collection name>" then "My Request"
And the "unsaved" label is gone

---

@critical
# evidence: src/components/request/AdvancedTab.tsx (request-timeout-seconds), src/hooks/useSendRequest.ts (timeoutMs), src/components/response/ResponsePanel.tsx (response-error-state)
## Scenario: E-REQ-03: Request timeout produces a timeout error state

Requests target the local mock server at MOCK_BASE_URL with a unique `x-test-id` header for isolation (see `e2e/fixtures/README.md`).
Given I open the Advanced tab and set the timeout (`request-timeout-seconds`) to 1 second
And the URL is `{MOCK_BASE_URL}/slow` (or `/echo?delay=3000`) with a unique `x-test-id`
When I click Send
Then the response panel shows the error state (`response-error-state`)
And the error message indicates a timeout
And it is not the generic network error message used for unreachable hosts
When I raise the timeout above the endpoint delay and Send again
Then the request succeeds with 200

---

@critical
# evidence: src/components/request/ParamsEditor.tsx and HeadersEditor.tsx (row toggles), mock-server GET /__requests and /echo
## Scenario: E-REQ-04: Disabled header and param are not received by the server

Requests target the local mock server at MOCK_BASE_URL with a unique `x-test-id` header for isolation (see `e2e/fixtures/README.md`).
Given a request to `{MOCK_BASE_URL}/echo` with a unique `x-test-id`
And two query params and two custom headers, one param and one header unchecked
When I click Send
Then the echo response shows only the enabled param and enabled header
And the disabled param and disabled header names are absent from the echoed query and headers
And the mock server's recorded request (`GET /__requests` for this test id) does not contain them either
And the URL bar does not include the disabled param

---

@critical
# evidence: src/components/response/ResponsePanel.tsx (unresolved-vars-banner, "Send anyway", "Fix in Environment Manager"), src/hooks/useSendRequest.ts (send(force)/sendForce)
## Scenario: E-REQ-05: Undefined variable warning and resolution with an active environment

Requests target the local mock server at MOCK_BASE_URL with a unique `x-test-id` header for isolation (see `e2e/fixtures/README.md`).
Given a request whose URL is `{{baseUrl}}/echo` and whose header, JSON body and auth token also use `{{...}}` variables
And no active environment defines them
When I click Send
Then the unresolved variables banner (`unresolved-vars-banner`) lists each `{{variable}}`
And no request reaches the mock server
When I click "Send anyway"
Then the request is dispatched with the literal placeholders
Given I create and activate an environment defining baseUrl (= MOCK_BASE_URL), a header value, a body value and a bearer token
When I click Send
Then no unresolved banner appears
And the echo shows the resolved URL, header, body and Authorization header values

---

@critical
# evidence: src/hooks/useSendRequest.ts (cancel(), catch branch setError), src/components/response/ResponsePanel.tsx (response-error-state, response-empty-state)
## Scenario: E-REQ-06: Cancelling a request returns the UI to idle

Note: today `cancel()` aborts the controller and the catch branch still calls `setError` and shows a "Request failed" toast; this scenario defines the intended behaviour (the app fix is tracked in SPEC.md) and replaces the existing weak test.
Given a request to `{MOCK_BASE_URL}/slow` with a unique `x-test-id`
When I click Send and then Cancel while loading
Then the loading state ends and the Send button is available again
And the response panel does not show the error state (`response-error-state`)
And no "Request failed" toast is shown
And the request is not recorded as a failed history entry
When I click Send again against a fast endpoint
Then a normal 200 response is shown

---

@high
# evidence: src/components/request/UrlBar.tsx (method-selector, method-<name> testids), src/lib/constants.ts (HTTP_METHODS)
## Scenario: E-REQ-07: Method menu lists all seven methods and HEAD returns headers only

Requests target the local mock server at MOCK_BASE_URL with a unique `x-test-id` header for isolation (see `e2e/fixtures/README.md`).
When I open the method selector (`method-selector`)
Then seven options are listed: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
And the current method has a checkmark
When I select HEAD and send to `{MOCK_BASE_URL}/echo`
Then the status is 200
And the response headers are listed
And the response body is empty

---

@high
# evidence: src/components/request/UrlBar.tsx (url-input), src/components/request/ParamsEditor.tsx
## Scenario: E-REQ-08: Query string parsing, editing and encoding round-trip

When I type `{MOCK_BASE_URL}/echo?a=1&a=2&b=` in the URL bar
Then the Params tab shows three rows: a=1, a=2, b=(empty)
When I edit the value of the second `a` row
Then the URL bar updates to reflect the edit and keeps the repeated key
When I enter `?q=hello%20world&name=%E2%9C%93` (space and unicode)
Then the Params tab shows the decoded values
And after Send the echo shows the same decoded query values
And reopening the Params tab does not double-encode them

---

@high
# evidence: src/components/settings/ProxySection.tsx (follow-redirects-switch), src/types/index.ts (per-request follow-redirects override), mock-server GET /redirect
## Scenario: E-REQ-09: Follow redirects toggle controls redirect handling

Requests target the local mock server at MOCK_BASE_URL with a unique `x-test-id` header for isolation (see `e2e/fixtures/README.md`).
Note: replaces the existing settings redirects test that hits a live service.
Given the URL `{MOCK_BASE_URL}/redirect?to=/echo&status=302`
And "Follow redirects" is turned off
When I click Send
Then the status is 302
And the response headers contain a Location header pointing to /echo
When I turn "Follow redirects" on and Send again
Then the final status is 200
And the body is the echo response

---

@high
# evidence: src/components/request/CodeGenPanel.tsx (code-gen-panel, code-gen-lang-select, "Copied to clipboard" toast), src/components/request/CodeGenDialog.tsx (code-gen-dialog)
## Scenario: E-REQ-12: Code generation for every language includes request details and can be copied

Given a POST request with a URL, a custom header and a JSON body
When I open the code generation panel
Then the language selector (`code-gen-lang-select`) offers 9 languages
For each language
  Then the snippet contains the method, the URL, the header name/value and the body
When I click Copy
Then a "Copied to clipboard" toast is shown
And the clipboard contents equal the displayed snippet
Note: the language-iteration and clipboard helper is reused by E-SET-02 (code-gen toggle in Settings).

---

@high
# evidence: src/components/request/ShareButton.tsx (shareRequestLink tooltip), src/components/request/ShareModal.tsx ("Shareable Link", rate-limit and error states), src/lib/shareLink.ts
## Scenario: E-REQ-13: Share a request link and restore it in a fresh context

Given a request with a URL, header and body is open
When I click the share button ("Share request link")
Then the "Shareable Link" dialog generates a URL
When I open that URL in a new browser context
Then a tab opens with the same method, URL, header and body
Note: the share button is disabled when the URL is empty; the dialog shows an error state if link creation fails or the hourly rate limit is hit (cover as a variant only if the share API is stubbed).

---

@high
# evidence: src/components/request/UrlBar.tsx (handlePaste, handleImportCurl, import-curl-input, import-curl-submit-btn)
## Scenario: E-REQ-14: Pasting a cURL command into the URL bar

Given a new request tab
When I paste `curl -X POST '{MOCK_BASE_URL}/echo' -H 'X-Demo: 1' -d '{"a":1}'` into the URL bar
Then the URL, method POST, header X-Demo and body are populated
And a "cURL imported" toast is shown
Given a tab with a known URL and method
When I paste a malformed cURL command (e.g. `curl` with no URL)
Then a "Failed to parse cURL" error toast is shown
And the tab URL, method, headers and body are unchanged

---

@high
# evidence: src/hooks/useSendRequest.ts (toast "Pre-request script error", "Post-response script error", envSet), src/components/response/ConsoleViewer.tsx (response-console-viewer), src/lib/scriptRunner.ts
## Scenario: E-REQ-11: Script errors do not block the request and post-script variables feed the next request

Requests target `{MOCK_BASE_URL}/echo` with a unique `x-test-id` header (see `e2e/fixtures/README.md`).

Given a pre-request script that logs a message and then throws an error
When I send the request
Then a "Pre-request script error" toast is shown
And the request is still sent and the echo response is displayed
And the Console tab lists the message logged before the throw
Given a post-response script that calls requestly.environment.set("token", "abc") with an active environment
And a second request whose header is `Authorization: Bearer {{token}}`
When I send the first request and then the second
Then the second request's echoed header contains "Bearer abc"
