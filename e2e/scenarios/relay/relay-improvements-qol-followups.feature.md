# Feature: Relay follow-up chips

As a user who just got a result from Relay
I want a few suggested next prompts under the answer
So that I can continue with one click

Tests live in `e2e/qa/relay/relay-improvements-qol-followups.spec.ts`. Chat replies are scripted by `e2e/fixtures/relayRoutes.ts`; nothing reaches a real provider.

---

## Scenario: [REL-QOL-06] After a 500 result up to 3 follow-up chips appear and vanish on typing (AC-22)

Given Relay answered after a send_request tool returned HTTP 500
Then between one and three follow-up chips are shown under the answer
When I type in the composer
Then the follow-up chips disappear

---

## Scenario: [REL-QOL-11] Clicking a follow-up chip sends its prompt and the chips clear (FR-196)

Given Relay answered after a send_request tool returned HTTP 500
When I click a follow-up chip
Then its label is sent as my next message and gets an answer
And the earlier chips are gone

---

## Scenario: [REL-QOL-12] An answer with no tool result shows no follow-up chips (empty)

Given Relay answered with plain text and ran no tool
Then no follow-up chips are shown
