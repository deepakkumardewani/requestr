# Feature: GraphQL Requests

As a user
I want to send GraphQL queries from a dedicated tab
So that I can explore GraphQL APIs alongside HTTP requests

Requests target the local mock GraphQL endpoint (`MOCK_BASE_URL` + `/graphql`) with a unique `x-test-id` header for isolation (see `e2e/fixtures/README.md`). The mock supports `x-mock-status: 400` / `x-mock-errors` headers and the operation names `BadRequest` / `ForceErrors` to force failures, and a `headers` query field that echoes received headers.

---

@high
# evidence: src/components/request/tabs/GraphQLTabs.tsx (graphql-query-editor), src/hooks/useSendRequest.ts (runGraphQLRequest), src/components/response/ResponsePanel.tsx (response-status-badge)
## Scenario: Send a query

Given the app is loaded
And I open a GraphQL tab from the create-new menu
When I enter a query and endpoint URL
And I click Send
Then the response panel shows a successful HTTP status
And the response body contains JSON from the GraphQL server

---

@medium
# evidence: src/components/request/tabs/GraphQLTabs.tsx (graphql-variables-editor, request-tab-graphql-variables)
## Scenario: Use variables

Given I have a GraphQL tab with a query that declares variables
When I enter JSON variables in the Variables editor
And I send the request
Then the server response reflects the supplied variable values

---

@high
# evidence: src/components/request/tabs/GraphQLTabs.tsx (request-tab-headers), src/components/request/HeadersEditor.tsx, e2e/support/mock-server/graphqlRoutes.ts (headers field, extensions.headers)
## Scenario: E-RT-05: Custom GraphQL headers are sent to the endpoint

Given I have a GraphQL tab with the mock endpoint and a query selecting the `headers` field
When I open the Headers tab and add a header (for example `x-custom-e2e: abc123`)
And I send the request
Then the response is successful
And the response body (the `headers` field or `extensions.headers`) contains `x-custom-e2e` with value `abc123`
And the mock server request log for my `x-test-id` shows the header was received

---

@medium
# evidence: src/components/request/tabs/GraphQLTabs.tsx (graphql-schema-toggle, graphql-schema-explorer), src/components/request/GraphQLSchemaExplorer.tsx (fetch-schema-btn, buildSections "Queries", buildFieldSnippet, onFieldSnippet)
## Scenario: E-RT-06: Schema explorer lists Query fields and clicking a field inserts a snippet

Given I have a GraphQL tab pointed at the mock `/graphql` endpoint
When I click the Schema toggle
And I click "Fetch Schema"
Then the explorer shows a "Queries" section listing `hello`, `user`, `users` and `headers`
When I click the `hello` field
Then the query editor contains a snippet for `hello`
When I type "user" in the schema search box
Then only matching fields remain listed

---

@medium
# evidence: e2e/support/mock-server/graphqlRoutes.ts (BadRequest, ForceErrors, x-mock-status, x-mock-errors), src/components/response/ResponsePanel.tsx (response-status-badge, response-error-state)
## Scenario: E-RT-07: GraphQL errors and 400 responses are displayed

Given I have a GraphQL tab pointed at the mock `/graphql` endpoint
When I send an operation named `ForceErrors` (or add header `x-mock-errors: 1`)
Then the response status is 200
And the response body shows `errors` containing "Forced GraphQL error"
When I send an operation named `BadRequest` (or add header `x-mock-status: 400`)
Then the response panel shows status 400
And the response body shows `errors` containing "Bad request (forced)"
