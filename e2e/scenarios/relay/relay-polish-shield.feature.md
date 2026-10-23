# Feature: Relay permission shield and Settings

Tests in `e2e/qa/relay/relay-polish-shield.spec.ts`. Hermetic Relay mocks; mode seeded via `rq_relay_permission_mode`.

---

@critical
## Scenario: [REL-POL-SHIELD-01] the shield is the control right after + and its tooltip reads "Approval mode: Review for me" on hover and keyboard focus

@critical
## Scenario: [REL-POL-SHIELD-02] opening shows a radiogroup with three rows, Review for me selected and marked Recommended

@critical
## Scenario: [REL-POL-SHIELD-03] Arrow keys move between rows; Enter selects, closes the popover, focus returns to the shield and data-mode updates

@high
## Scenario: [REL-POL-SHIELD-04] Esc closes the popover and focus returns to the shield

@high
## Scenario: [REL-POL-SHIELD-05] Skip shows "Use with caution" on its row, a warning-toned shield and the "Approvals are off" notice; the notice disappears on switching back

@high
## Scenario: [REL-POL-SHIELD-06] the chosen mode survives a reload

@critical
## Scenario: [REL-POL-SHIELD-07] changing the mode in Settings > Relay updates the shield, and changing via the shield updates the Settings select after reload

@high
## Scenario: [REL-POL-SHIELD-08] the launcher Settings section lists Permission mode with the current mode and opens the shield popover

@high
## Scenario: [REL-POL-SHIELD-09] at 320px the popover is not clipped, has no horizontal scroll and the notice does not overlap pills
