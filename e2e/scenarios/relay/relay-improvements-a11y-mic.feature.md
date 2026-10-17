# Feature: Mic toggle accessibility in Relay

As a keyboard-only user
I want to reach the dictation mic with Tab and toggle it with Enter or Space
So that voice input is operable without a mouse and announces its state

Tests live in `e2e/qa/relay/relay-improvements-a11y-mic.spec.ts`. They use the seeded workspace, hermetic Relay route mocks and the fake recognizer from `e2e/fixtures/speechStub.ts`; no real microphone is involved.

---

## Scenario: [REL-IA11Y-02] The mic is reachable by keyboard and aria-pressed toggles with the speech stub (FR-172, NFR-8)

Given the speech stub is installed and the dock is open
When I Tab from the composer
Then the mic button is focused and reports aria-pressed "false"
When I press Enter
Then the mic reports aria-pressed "true" and the recognizer is active
When I press Space on the focused mic
Then the mic reports aria-pressed "false" and the recognizer is stopped
