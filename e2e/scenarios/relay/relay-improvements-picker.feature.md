# Feature: Picker attach and slash commands

As a user composing a Relay message
I want to attach workspace items with "+" or "@" and run slash commands
So that I control exactly what context goes with my message and can reset quickly

Tests live in `e2e/qa/relay/relay-improvements-picker.spec.ts`. The picker is a virtualized list capped by the workspace search index; the slash menu lists five commands and keeps focus in the textfield. `bun run qa:seed:build` regenerates the seed (scale comes from the 500-request `qa-e2e-relayimp-col-500` collection) from `e2e/fixtures/seed/relay-improvements.json`.

---

## Scenario: [REL-PICK-01] "+" and "@" open the same picker and the chosen item is sent as a chip (AC-07, FR-124, FR-128)

Given the dock is open
When I press the "+" button and choose "Request B"
Then a "Request B" chip appears in the context chips
When I type "@" in the textfield
Then the same picker opens
When I filter by environments and choose the environment
Then the environment chip appears
When I send a message
Then the outbound payload includes a request chip for "Request B" and an environment chip

---

## Scenario: [REL-PICK-02] with more requests than the result cap the picker opens, filters and renders a bounded number of rows (AC-07, FR-125, NFR-6)

Given the workspace has more requests than the picker result cap
When I open the picker with "+"
Then it is visible with a bounded number of rows and a "Keep typing to narrow results" note
When I search for "Request 437"
Then the matching request is listed

---

## Scenario: [REL-PICK-03] "/" lists five commands and Enter on /explain fills the prompt (AC-20, FR-193)

Given the dock is open
When I type "/" in the textfield
Then five commands are listed: /explain, /assert, /curl, /docs, /clear
When I press Enter on the highlighted "/explain"
Then the textfield holds the explain prompt and the menu closes

---

## Scenario: [REL-PICK-04] /clear asks to confirm, then starts a new conversation (AC-20, FR-193)

Given the conversation has a sent message
When I run "/clear"
Then a confirmation asks whether to start a new conversation
When I confirm
Then the conversation is empty and the textfield is empty

---

## Scenario: [REL-PICK-05] a query with no match shows the empty state and Esc returns focus to the textfield (empty, NFR-8)

Given the picker is open
When I search for text that matches nothing
Then "Nothing matches that search" is shown
When I press Escape
Then the picker closes and focus returns to the textfield

---

## Scenario: [REL-PICK-06] /clear on an empty thread starts a new conversation without a confirm (FR-193)

Given the conversation has no messages
When I run "/clear"
Then no confirmation is shown
And the textfield is empty and focused
