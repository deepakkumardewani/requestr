# Feature: Relay regenerate and edit & resend

As a user who is not happy with the last Relay turn
I want to regenerate the answer or edit and resend my last message
So that I can get a better reply without restarting the thread

Tests live in `e2e/qa/relay/relay-improvements-qol-rewrite.spec.ts`. Chat replies are scripted in `e2e/fixtures/relayRoutes.ts`, so nothing reaches a real provider and nothing sleeps.

---

## Scenario: [REL-QOL-02] Regenerate replaces the last answer (AC-18)

Given Relay has answered my prompt
When I press Regenerate on the last answer
Then a new answer replaces the old one
And my prompt is still the only user message in the thread

---

## Scenario: [REL-QOL-03] Edit & resend replaces the last user message and drops later messages (AC-18)

Given a thread with two finished turns
When I edit my last message and resend it
Then the edited message replaces the old one and the old answer to it is gone
And the earlier turn is untouched

---

## Scenario: [REL-QOL-09] after Edit & resend a reload shows only the trimmed thread (persistence)

Given I edited and resent my last message and the new answer arrived
When I reload the app
Then the restored thread shows the earlier turn and the edited turn only
