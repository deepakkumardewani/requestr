# Feature: Live context chip and resets

As a user in a workspace with multiple requests
I want the Relay context chip to reflect what I'm currently working on
So that I trust the context being sent and can manage it easily

Tests live in `e2e/qa/relay/relay-improvements-context-chip.spec.ts`. The auto chip derives from the open request tab via a memoized selector. Removing the chip for the current turn persists the dismissal in `dismissedAutoChipTabId`, which clears on new conversation. `bun run qa:seed:build` regenerates the seed from `e2e/fixtures/seed/relay-improvements.json`.

---

## Scenario: [REL-ICTX-01] chip reads "Using: A · current tab" and follows a switch to B (AC-05, FR-120, FR-121)

Given a request "A" is open in a tab and the dock is open
When I check the context chips
Then the chip reads "Using: A · current tab"
And the chip's tooltip explains it tracks the current tab
When I switch to request "B" in another tab
Then the chip updates to read "Using: B · current tab"
And no message was sent

---

## Scenario: [REL-ICTX-02] new conversation clears attached items and re-derives chip and suggestions (AC-06, FR-122)

Given a request "A" is open and I removed the auto chip for the current turn
And I sent a message
When I start a new conversation
Then the auto chip reappears with "Using: A · current tab"
And the suggestions are re-derived

---

## Scenario: [REL-ICTX-06] removing the auto chip leaves it out of the next send only (FR-128)

Given a request "A" is open and the dock is open
When I remove the context chip and send a message
Then the outbound payload has no chip for the tab
When I send another message
Then the outbound payload includes the chip again for "A"

---

## Scenario: [REL-ICTX-07] a utility page with no request tab shows no chip (Assumption 1, empty)

Given the dock is open on a utility page (transform, json-compare, or json-visualize)
When I check the context chips
Then no context chip appears

---

## Scenario: [REL-ICTX-08] reloading with request B open restores the chip for B (persistence)

Given a request "B" is open in a tab
When I reload the page
Then the dock is still open
And the chip reads "Using: B · current tab"
