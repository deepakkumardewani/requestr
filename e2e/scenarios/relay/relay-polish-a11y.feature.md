# Feature: Relay polish accessibility with every menu open
Tests in `e2e/qa/relay/relay-polish-a11y.spec.ts`. Hermetic Relay mocks; axe-core scans the Relay dock with each new surface open and fails on serious or critical violations.

---

@high
## Scenario: [REL-POL-A11Y-01] axe finds no serious or critical violations with the conversations overlay open

@high
## Scenario: [REL-POL-A11Y-02] axe is clean with a thread row menu open

@critical
## Scenario: [REL-POL-A11Y-03] axe is clean with the @ mention menu open

@critical
## Scenario: [REL-POL-A11Y-04] axe is clean with the / slash menu open

@critical
## Scenario: [REL-POL-A11Y-05] axe is clean with the + launcher open

@critical
## Scenario: [REL-POL-A11Y-06] axe is clean with the shield popover open in each of the three modes (including the warning tone contrast)

@critical
## Scenario: [REL-POL-A11Y-07] axe is clean with the capabilities popover open and with the empty state

@high
## Scenario: [REL-POL-A11Y-08] axe is clean in dark mode at the 320px panel width with the launcher open
The 320px panel is the supported minimum (RP-110: `max(30vw, 320px)`); it is only reachable at viewports up to ~1066px, so the spec uses a 900px-wide viewport.
