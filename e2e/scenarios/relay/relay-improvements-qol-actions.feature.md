# Feature: Relay message actions — copy and feedback

As a Relay user
I want to copy an answer and rate it from the message actions
So that I can reuse the answer and tell the team if it helped, without my text being stored or sent

Tests live in `e2e/qa/relay/relay-improvements-qol-actions.spec.ts`. Actions are rendered by `src/components/relay/MessageActions.tsx`; feedback goes through `src/lib/relay/telemetry.ts`. Chat replies are mocked by `e2e/fixtures/relayRoutes.ts`, and the streaming case holds the reply open with a test-controlled gate so nothing sleeps.

---

## Scenario: [REL-QOL-04] Copy puts the answer's markdown on the clipboard (AC-18)

Given Relay has answered with markdown text
When I press Copy on the answer
Then the clipboard holds the answer's markdown exactly as written
And the Copy button announces Copied

---

## Scenario: [REL-QOL-05] a thumbs click emits relay_feedback with the rating and no text, and nothing is stored (AC-19)

Given Relay has answered and a test telemetry sink is installed
When I press thumbs up on the answer
Then exactly one relay_feedback event is emitted carrying only the rating
And the answer text appears in no event
And browser storage is unchanged by the click

---

## Scenario: [REL-QOL-10] message actions are hidden while streaming and appear when the answer completes (FR-191)

Given Relay's reply is streaming and part of the answer has arrived
Then no answer actions are shown
When the reply finishes
Then the answer actions appear
