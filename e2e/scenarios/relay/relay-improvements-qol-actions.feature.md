# Feature: Relay message actions — copy

As a Relay user
I want to copy an answer from the message actions
So that I can reuse the answer

Tests live in `e2e/qa/relay/relay-improvements-qol-actions.spec.ts`. Actions are rendered by `src/components/relay/MessageActions.tsx`. Chat replies are mocked by `e2e/fixtures/relayRoutes.ts`, and the streaming case holds the reply open with a test-controlled gate so nothing sleeps.

---

## Scenario: [REL-QOL-04] Copy puts the answer's markdown on the clipboard (AC-18)

Given Relay has answered with markdown text
When I press Copy on the answer
Then the clipboard holds the answer's markdown exactly as written
And the Copy button announces Copied

---

## Scenario: [REL-QOL-10] message actions are hidden while streaming and appear when the answer completes (FR-191)

Given Relay's reply is streaming and part of the answer has arrived
Then no answer actions are shown
When the reply finishes
Then the answer actions appear
