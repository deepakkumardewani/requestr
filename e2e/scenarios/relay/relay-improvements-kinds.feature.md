# Feature: Relay prepares GraphQL, WebSocket and Socket.IO requests in tabs

As a user who works with more than plain HTTP
I want Relay to open GraphQL, WebSocket and Socket.IO tabs with everything filled in
So that I can review and send them myself, and nothing connects or sends on its own

Tests live in `e2e/qa/relay/relay-improvements-kinds.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts` (`clientTools` scripts ask the real client to run tools; no real model is called). The tools, the tab components and the stores are the production ones. No scenario connects to a server, so the Socket.IO echo is not needed. Seeds come from `e2e/fixtures/seed/relay-improvements.json`: the collection "QA E2E Relay Improvements".

---

## Scenario: [REL-KIND-01] create_graphql_request opens a graphql tab with query, variables and operationName (AC-12, FR-140, FR-141)

Given the workspace is open
When Relay is asked to create a GraphQL request with a query, variables and an operation name
Then a GraphQL tab named after the request opens
And its URL, query, variables and headers hold the given values
And the request is not saved to any collection

---

## Scenario: [REL-KIND-02] create_websocket_request opens a websocket tab with url, headers and draft and does not connect (AC-12, FR-142)

Given the workspace is open
When Relay is asked to create a WebSocket request with a URL, a header and a draft message
Then a WebSocket tab opens with the URL, the header and the draft filled in
And the tab shows a Connect button and no Disconnect button
And the message log has no entries

---

## Scenario: [REL-KIND-03] create_socketio_request opens a socketio tab with url, eventName and draft (AC-12, FR-143)

Given the workspace is open
When Relay is asked to create a Socket.IO request with a URL, an event name and a draft payload
Then a Socket.IO tab opens with the URL, event name and draft filled in
And the tab shows a Connect button and no Disconnect button

---

## Scenario: [REL-KIND-04] update_tab_request edits only the named field and HTTP create_request still creates an HTTP request (AC-12, FR-144)

Given Relay created a WebSocket tab with a URL and a draft
When Relay is asked to change only the draft
Then the draft shows the new text and the URL is unchanged
When Relay is asked to create an HTTP request in the seeded collection
Then the new request appears in the collection and opens as an HTTP tab when selected

---

## Scenario: [REL-KIND-05] invalid variables JSON shows a recoverable tool error and leaves the tab unchanged (error)

Given Relay created a GraphQL tab with valid variables
When Relay is asked to update the variables with text that is not a JSON object
Then the tool row reports a failure that names the variables problem
And the GraphQL tab still shows the original variables
And the assistant still finishes its reply

---

## Scenario: [REL-KIND-06] the created WebSocket draft survives switching tabs and back (persistence)

Given Relay created a WebSocket tab with a draft and Request A is also open
When I switch to Request A and then back to the WebSocket tab
Then the draft message input still holds the draft
