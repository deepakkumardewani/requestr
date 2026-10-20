# Feature: Relay composer row geometry and touch targets

As a user on a narrow dock or a phone
I want the composer controls laid out on one row with comfortably large tap targets
So that I can attach context, dictate and send without mis-taps

Tests live in `e2e/qa/relay/relay-improvements-a11y-layout.spec.ts`. They use the seeded workspace, hermetic Relay route mocks and the fake recognizer from `e2e/fixtures/speechStub.ts` (so the mic renders); no real model or microphone is involved.

---

## Scenario: [REL-IA11Y-04] Composer buttons have at least 36px touch targets at mobile sheet width (NFR-8)

Given the speech stub is installed and the viewport is the mobile sheet width
When the dock is open
Then the "+" picker trigger, the mic and the send button are each at least 36px wide and 36px tall

## Scenario: [REL-IA11Y-05] At 320px, 409px and mobile sheet width "+", mic and send sit on one toolbar row below the textarea, in that order (AC-03, FR-111)

Given the viewport is 1024x800, the speech stub is installed, and the dock is open at its 320px minimum
Then "+", mic and send share one toolbar row below the textarea, left to right in that order, inside the dock
When the dock is dragged to its 409px maximum
Then the same arrangement holds
When the viewport becomes the mobile sheet width
Then the same arrangement holds
