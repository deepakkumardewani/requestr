# Feature: Relay capabilities popover and empty state
Tests in `e2e/qa/relay/relay-polish-caps.spec.ts`. Hermetic Relay mocks; the chat body is captured through `page.route`.

---

@critical
## Scenario: [REL-POL-CAPS-01] the header button (tooltip "What Relay can do") opens a popover, focus moves inside, Esc closes it and focus returns to the button

@critical
## Scenario: [REL-POL-CAPS-02] five categories render, each with 2 to 3 starters

@critical
## Scenario: [REL-POL-CAPS-03] a target-free starter sends its prompt to /api/relay/chat

@critical
## Scenario: [REL-POL-CAPS-04] a starter that needs a target with nothing attached opens the mention menu with a hint

@high
## Scenario: [REL-POL-CAPS-05] the See tab lists attached items, the workspace index, on-demand lookups, env values only with Share variable values, and secrets hidden

@critical
## Scenario: [REL-POL-CAPS-06] approval badges read "Runs directly" or "Asks first" per the current mode, and bulk tools read "Asks first when more than 10 items"

@high
## Scenario: [REL-POL-CAPS-07] after changing the mode via the shield, reopening the popover shows the updated badges

@high
## Scenario: [REL-POL-CAPS-08] 'Change approval mode' opens the shield popover

@critical
## Scenario: [REL-POL-CAPS-09] the new-chat empty state shows the large logo, title, description and the same starters

@high
## Scenario: [REL-POL-CAPS-10] the empty state is identical whichever tab is open and shows no tab-derived text

@medium
## Scenario: [REL-POL-CAPS-11] the launcher Settings section opens the capabilities popover

@high
## Scenario: [REL-POL-CAPS-12] the final + launcher shows exactly four sections in the order Recent, Attach, Actions, Settings, and Settings holds Permission mode and What Relay can do
