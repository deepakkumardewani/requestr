# Feature: Live context pill and resets

As a user in a workspace with multiple requests
I want the Relay context pill to show exactly what I attached
So that I trust that only attached context is sent and can manage it easily

Tests live in `e2e/qa/relay/relay-improvements-context-chip.spec.ts`. Nothing reaches Relay unless the user attaches it: there are no auto pills. A tab is attached through the picker's "Current tab" row, and attached items clear on new conversation. `bun run qa:seed:build` regenerates the seed from `e2e/fixtures/seed/relay-improvements.json`.

---

## Scenario: [REL-ICTX-01] nothing is attached by default; the Current tab row attaches request A and a tab switch adds nothing (AC-05, FR-120, FR-121)

Given a request "A" is open in a tab and the dock is open
Then no context pill appears
When I attach the Current tab row from the picker
Then one pill reads "A"
When I switch to request "B" in another tab
Then the pill for "A" remains and no pill for "B" appears
And no message was sent

---

## Scenario: [REL-ICTX-02] new conversation clears attached items (AC-06, FR-122)

Given a request "A" is open and attached through the picker
And I sent a message
When I start a new conversation
Then no pill appears, although "A" is still the open tab

---

## Scenario: [REL-ICTX-06] removing an attached chip leaves it out of every later send (FR-128)

Given a request "A" is attached through the picker
When I remove the chip and send a message
Then the outbound payload has no chips
When I send another message
Then the outbound payload still has no chips

---

## Scenario: [REL-ICTX-07] a utility page with no request tab shows no pill and a disabled Current tab row (empty)

Given the dock is open and no request tab is open
When I check the context pills
Then no context pill appears
When I open the picker
Then the Current tab row is disabled

---

## Scenario: [REL-ICTX-08] reloading with request B open keeps the dock open and attaches nothing (persistence)

Given a request "B" is open in a tab
When I reload the page
Then the dock is still open
And no context pill appears
