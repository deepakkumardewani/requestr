# Feature: Automated axe accessibility scan of the Relay panel

As a screen-reader and low-vision user
I want the Relay panel to pass an automated accessibility scan in both themes
So that icon buttons, the live region and colours are usable without sight

Tests live in `e2e/qa/relay/relay-improvements-a11y-axe.spec.ts`. They use the seeded workspace, hermetic Relay route mocks and `@axe-core/playwright` scoped to the dock; no real model is called.

---

## Scenario: [REL-IA11Y-03] The Relay panel has no serious or critical axe violations (AC-25)

Given the dock is open with a scripted conversation rendered
When axe scans the Relay dock
Then there are no violations with impact "serious" or "critical"

---

## Scenario: [REL-IA11Y-07] The same check passes in the dark theme (NFR-8)

Given the dock is open with a scripted conversation rendered and the dark theme is active
When axe scans the Relay dock
Then there are no violations with impact "serious" or "critical"
