# Feature: Relay confirmations for destructive and network actions

As a user who lets Relay act on my workspace
I want to approve anything that deletes data or reaches the network first
So that an assistant, or text it read from a response, can never act without my say-so

Tests live in `e2e/qa/relay/relay-confirm.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts` (`clientTools` scripts ask the real client to run tools; no real model is called) and the request proxy is mocked by `installProxyRoutes`, so no external host is ever contacted. The tools, the approval gate, the change log and the stores are the production ones. Seeds use ids `qa-e2e-relay-*` from `e2e/fixtures/seed/relay-e2e.json`.

---

## Scenario: [REL-CONF-01] Deleting a collection shows a card with the item name and child count, and Decline leaves everything intact (FR-42, AC-9)

Given the scripted reply asks to delete the collection "QA E2E Relay - Doomed collection", which holds two requests and a folder
When I ask Relay to delete that collection
Then a Confirmation Card names the collection and says how many items are inside
And the collection is still in the sidebar while the card is waiting
When I press Decline
Then the collection and its requests are still in the sidebar
And the next request to the assistant reports that the user declined

---

## Scenario: [REL-CONF-02] Approve deletes and Undo restores the collection with its children (FR-41, FR-42, AC-9)

Given the scripted reply asks to delete the same collection
When I press Approve on the Confirmation Card
Then the collection disappears from the sidebar
And a Change Card offers Undo
When I press Undo
Then the collection is back in the sidebar with its requests

---

## Scenario: [REL-CONF-03] Sending a request makes no network call before Approve (FR-42, AC-10)

Given the scripted reply asks to send the saved request "QA E2E Relay - Sample request"
When I ask Relay to send it
Then a Confirmation Card shows the request's method, its resolved host and the active environment
And the proxy has received no request while the card is waiting
When I press Approve
Then exactly one request reaches the proxy

---

## Scenario: [REL-CONF-04] Running a chain needs Approve and Stop aborts the run (FR-42, AC-10)

Given the scripted reply asks to run the chain "QA E2E Relay - Two step chain" and the proxy holds the first step open
When I ask Relay to run it
Then a Confirmation Card names the chain and the proxy has received no request
When I press Approve
Then the first step reaches the proxy
When I press Stop
Then the run ends without the second step ever reaching the proxy
And the composer is ready for a new message

---

## Scenario: [REL-CONF-05] After an approved send Relay explains the status from redacted data (FR-45, AC-11)

Given the proxy answers with status 200 and a body that contains a bearer token
And the scripted reply sends the request, then explains the result
When I approve the send
Then the next request to the assistant carries the status and body of the response
And the token appears nowhere in that request or on the page
And the reply text explaining the status is shown

---

## Scenario: [REL-CONF-06] An injected response body triggers no action without a confirmation naming the real item (FR-42, FR-45, AC-17)

Given the proxy answers with a body that tells the assistant to delete a request
And the scripted reply follows that instruction after the send
When I approve the send and the assistant asks to delete the request
Then the response body reached the assistant inside the untrusted-content block
And a Confirmation Card names the real request it would delete
And that request is still in the sidebar until I decide

---

## Scenario: [REL-CONF-07] Reloading with a pending card auto-declines it with a note (FR-42, OQ-9)

Given a Confirmation Card for a delete is waiting
When I reload the page
Then the conversation is restored with a note that the step was skipped
And no Confirmation Card is shown and nothing was deleted

---

## Scenario: [REL-CONF-08] A host that differs from the saved one is warned about (FR-42, SPEC section 8)

Given a saved request was sent once to its original host
And the scripted reply then changes the request's URL to another host and sends it
When the Confirmation Card appears
Then it warns that the request now goes to the new host and names the previous host
