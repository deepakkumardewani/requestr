# Feature: Relay loading phases

As a user waiting on Relay
I want to see what it is doing while it works
So that a slow answer never looks like a frozen one

Tests live in `e2e/qa/relay/relay-improvements-loading.spec.ts`. The first chat response is held open by a test-controlled gate in `e2e/fixtures/relayRoutes.ts`, so each phase is observed deterministically and nothing sleeps.

---

## Scenario: [REL-LOAD-01] Sending shows the Working header, then the labelled tool step, then the answer and a collapsed Worked group (AC-01, FR-101, FR-102, FR-103)

Given Relay's reply is held open
When I send a message
Then the Working header reads "Working for Ns" and no step label is shown
And when Relay starts a workspace search for "auth" the line reads "Searching workspace for auth…"
And once the tool has run and the answer arrives the activity line is gone
And the answer and a collapsed Worked group are shown, and expanding it shows the tool row

---

## Scenario: [REL-LOAD-02] With reduced motion the Working header dot has no running animation but keeps text and dot (FR-104)

Given the system prefers reduced motion
When Relay is thinking
Then the dot and the header are visible and the header reads "Working for Ns"
And neither the dot nor the header text has a running animation, and the dot pulses again once motion is allowed

---

## Scenario: [REL-LOAD-03] The indicator region is role=status with aria-live=polite (FR-104)

Given Relay is thinking
Then the activity line is exposed as a status region
And it has aria-live "polite"

---

## Scenario: [REL-LOAD-04] A chat route error while thinking clears the indicator and shows the error (error)

Given Relay is thinking
When the chat route reports an error
Then the activity line is removed
And the error banner is shown
