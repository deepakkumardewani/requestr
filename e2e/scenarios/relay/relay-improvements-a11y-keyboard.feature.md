# Feature: Keyboard-only walkthrough of Relay improvements

As a keyboard-only user
I want to reach and operate the picker, slash menu, entity pills and history menu without a mouse
So that every new Relay surface is accessible and Esc always returns me to where I was

Tests live in `e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts`. They use the seeded workspace and hermetic Relay route mocks; no key press is replaced by a click except where the scenario says so.

---

## Scenario: [REL-IA11Y-01] Keyboard only: "+" picker, slash menu, pill Enter, history ⋯ and Export submenu (AC-25)

Given the dock is open and the composer is focused
When I Shift+Tab to the "+" button and press Enter
Then the picker opens with its search field focused
When I press Escape
Then the picker closes
When I type "/" in the composer
Then the slash menu opens and ArrowDown plus Enter picks a command
When an assistant reply contains a request pill and I focus it and press Enter
Then that request opens in a tab
When I focus the history ⋯ button and press Enter
Then the menu opens with focus on Export, and Enter opens the submenu with focus on its first item

---

## Scenario: [REL-IA11Y-06] Esc from the picker, slash menu and history menu returns focus to the trigger (NFR-8)

Given the dock is open
When I open the picker with "+" and press Escape
Then focus returns to the textfield the picker attaches to
When I type "/" and press Escape
Then the slash menu closes and focus stays in the composer
When I open the history ⋯ menu and press Escape
Then the menu closes and focus returns to the ⋯ button
