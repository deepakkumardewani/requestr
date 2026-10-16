# Feature: Relay stop streaming

As a user waiting on a long Relay reply
I want a Stop control that halts the reply
So that I can interrupt it and ask something else

Tests live in `e2e/qa/relay/relay-improvements-qol-stop.spec.ts`. The first chat response is held open by a test-controlled gate in `e2e/fixtures/relayRoutes.ts`, so each moment of the stream is observed deterministically and nothing sleeps.

---

## Scenario: [REL-QOL-01] Stop mid-stream halts the reply and send returns (AC-18)

Given Relay's reply is streaming and part of the answer has arrived
When I press Stop
Then the partial answer stays and no more of the reply arrives
And the Stop control is replaced by Send

---

## Scenario: [REL-QOL-07] Stop during a pending tool call leaves no pending tool and the next prompt sends normally (FR-190)

Given Relay's reply is streaming and a delete confirmation card is waiting for an answer
When I press Stop
Then the card is closed as declined and no tool is left running
And the next prompt is sent normally and gets an answer

---

## Scenario: [REL-QOL-08] A chat route error mid-stream shows the error and restores send (error)

Given Relay's reply is streaming and part of the answer has arrived
When the stream fails with a server error
Then the error banner is shown
And the activity line is gone and Send is available again
