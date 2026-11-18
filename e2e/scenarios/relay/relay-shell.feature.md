# Feature: Relay shell

As a user working in any workspace route
I want a Relay dock I can open, close and resize from the keyboard or the mouse
So that the assistant is always one gesture away without disturbing the page I am on

Tests live in `e2e/qa/relay/relay-shell.spec.ts`. Flag-off behaviour (AC-21) is unit-tested only because `NEXT_PUBLIC_*` is fixed at build time.

---

## Scenario: [REL-SHELL-01] The shortcut toggles the dock and moves focus to the composer

Given I am on a workspace route with focus on the page body
When I press the Relay shortcut
Then the dock opens and the composer has focus
And pressing the shortcut again closes the dock and returns focus to the element that had it before

---

## Scenario: [REL-SHELL-02] The header button and the command palette open and close the dock, and the state persists

Given I am on a workspace route with the dock closed
When I click the Relay toggle button
Then the dock opens
And when I reload the page the dock is still open
And when I navigate to another workspace route the dock is still open
And when I open the command palette and choose "Open Relay" the dock closes

---

## Scenario: [REL-SHELL-03] Dragging or using the arrow keys resizes the dock within its bounds and the width persists

Given the viewport is 1440x900 and the dock is open at its default width (30vw)
When I drag the resize handle to the left
Then the dock gets wider, never beyond 40vw of the viewport
And when I drag it far to the right it never gets narrower than 30vw or 320px, whichever is larger
And when I focus the handle and press the arrow keys the width changes in steps
And after a reload the dock keeps the last width

---

## Scenario: [REL-SHELL-04] Under 768px the dock is a full-width sheet without horizontal scroll

Given the viewport is narrower than 768px
When I open Relay
Then it appears as a full-width sheet
And the page has no horizontal scroll
And I can close it with the close button

---

## Scenario: [REL-SHELL-05] The toggle exposes its state and Escape returns focus before closing

Given the dock is closed
Then the toggle button reports aria-expanded as false
When I open the dock
Then the toggle button reports aria-expanded as true
And pressing Escape from the composer moves focus out of the dock without closing it
And pressing Escape again closes the dock
