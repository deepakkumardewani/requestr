# Feature: Relay writes, Change Cards and Undo

As a user who asks Relay to change my workspace
I want every change applied at once, shown as a card I can inspect and undo
So that I stay in control and no secret ever passes through the assistant

Tests live in `e2e/qa/relay/relay-write.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts` (`clientTools` scripts ask the real client to run write tools; no real model is called), so the tools, the change log and the stores are the production ones. Seeds use ids `qa-e2e-relay-*` from `e2e/fixtures/seed/relay-e2e.json`.

---

## Scenario: [REL-WRITE-01] Create a collection Orders with GET and POST /orders (FR-41, AC-5)

Given the dock is open and the scripted reply creates a collection named Orders, then a GET request and a POST request in it
When I ask Relay to create a collection Orders with GET and POST /orders
Then the collection Orders appears in the sidebar without refreshing the page
And the sidebar lists the two requests under it
And one Change Card is shown per change
And the reply text confirms what was created

---

## Scenario: [REL-WRITE-02] Undo on one card reverts exactly that change (FR-41, AC-6)

Given Relay has just renamed a request and updated another request in the same reply
When I press Undo on the card for the rename
Then the first request has its original name again
And the second request keeps its new value
And the rename card shows Undone and no longer offers Undo

---

## Scenario: [REL-WRITE-03] Undo all reverts the whole turn (FR-41, AC-6)

Given Relay has applied three changes in one reply
When I press Undo all
Then every change of that reply is reverted
And every card shows Undone
And the Undo all button is gone

---

## Scenario: [REL-WRITE-04] Undo after a manual edit is blocked with an explanation (FR-44, AC-6)

Given Relay has renamed a request and a Change Card is shown
And I rename that same request myself afterwards
When I press Undo on the card
Then my own edit is still in place
And the card explains the change can no longer be undone because the item was edited
And the card still offers Undo

---

## Scenario: [REL-WRITE-05] A literal bearer token is refused with guidance and a variable is accepted (FR-43, FR-61, AC-7)

Given the scripted reply first tries to set a literal bearer token on a request, then sets the token to a variable reference
When I ask Relay to add bearer authentication
Then the first attempt shows an error row that says to use an environment variable reference
And the request's authentication is unchanged after the first attempt
And the second attempt shows a Change Card and the request now uses the variable reference
And the literal token appears nowhere on the page

---

## Scenario: [REL-WRITE-06] Secret environment values are neither readable nor writable (FR-60, FR-61, AC-8)

Given the seeded environment has a secret variable with a known value
And the scripted reply tries to read the environment, then to set that secret's value, then to add a new secret variable
When I ask Relay to update my secrets
Then the attempt to set the existing secret's value is refused
And the new secret variable is created empty and the card tells me to add its value myself
And no outbound chat request contains the secret value

---

## Scenario: [REL-WRITE-07] A tool failure shows a recoverable error card (FR-43, AC-19)

Given the scripted reply asks to update a request that does not exist, then answers with a text reply
When I ask Relay to update that request
Then an alert row says the step failed and names the missing request
And the conversation is still usable
And I can send another message and receive a reply

---

## Scenario: [REL-CHAIN-01] Adding an assertion node after a node can be undone (FR-44, AC-12)

Given the seeded chain has two request nodes joined by one edge
And the scripted reply adds an assertion node after the second request node, then reads the chain back
When I ask Relay to add an assertion after the second request
Then a Change Card says an assertion node was added to the chain
And the chain read back has three nodes and two edges
When I press Undo on that card
Then the card shows Undone
And the chain read back again has two nodes and one edge

---

## Scenario: [REL-CHAIN-02] After login, extract the token and call /me (US5, FR-43)

Given the seeded login and me requests exist
And the scripted reply creates a chain, adds the login request, an extract node after it and the me request after the extract node
When I ask Relay to log in, take the token and call me
Then four Change Cards show the chain and its three nodes
And the chain read back lists the login, extract and me nodes joined in that order
When I approve running the chain
Then the login request is sent before the me request
And the run read back shows the extract node passed

---

## Scenario: [REL-CHAIN-03] Deleting a chain node needs Approve and can be undone (AC-9, FR-42)

Given the seeded edit chain has a login node and a me node
And the scripted reply asks to delete the me node
When I ask Relay to remove the me node
Then a Confirmation Card names the me request and the chain's node count
And the chain still has both nodes until I press Approve
When I approve
Then a Change Card shows the node was removed
When I press Undo on that card
Then the chain read back has both nodes and its edge again

---

## Scenario: [REL-CHAIN-04] Stop aborts an approved chain run (AC-10)

Given the seeded slow chain waits a long time between its two requests
And the scripted reply asks to run that chain
When I approve running it
Then the first request is sent
When I press Stop while the chain is waiting
Then the run is reported as stopped to the model
And the second request is never sent
