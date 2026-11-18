# Feature: Relay capabilities popover and empty state
Tests in `e2e/qa/relay/relay-polish-caps.spec.ts`. Hermetic Relay mocks; the chat body is captured through `page.route`.

---

@critical
## Scenario: [REL-POL-CAPS-01] the header button (tooltip "What Relay can do") opens a popover, focus moves inside, Esc closes it and focus returns to the button

@critical
## Scenario: [REL-POL-CAPS-02] all eight categories render in one list, each with a title and description and no starter buttons

@critical
## Scenario: [REL-POL-CAPS-03] a target-free context-aware starter sends its prompt to /api/relay/chat

@critical
## Scenario: [REL-POL-CAPS-04] a starter that needs a target with nothing attached opens the mention menu with a hint

@high
## Scenario: [REL-POL-CAPS-05] the "What Relay can see" footer lists attached items, the workspace index, variable values only with Share variable values, and secrets hidden

@critical
## Scenario: [REL-POL-CAPS-06] approval markers read "Asks first" or "Asks first for more than 10 items" per the current mode, and areas that run directly show none

@high
## Scenario: [REL-POL-CAPS-07] after changing the mode via the shield, reopening the popover shows the updated markers

@high
## Scenario: [REL-POL-CAPS-08] 'Change approval mode' opens the shield popover

@critical
## Scenario: [REL-POL-CAPS-09] the new-chat empty state shows the large logo, title, description and the context-aware starters with a quiet link to the full list

@high
## Scenario: [REL-POL-CAPS-10] the empty state follows what is open: generic starters with nothing open, request starters naming the open request

@medium
## Scenario: [REL-POL-CAPS-11] the launcher Settings section opens the capabilities popover

@high
## Scenario: [REL-POL-CAPS-12] the final + launcher shows exactly four sections in the order Recent, Attach, Actions, Settings, and Settings holds Permission mode and What Relay can do
