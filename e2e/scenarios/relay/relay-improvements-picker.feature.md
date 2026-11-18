# Feature: Picker attach and slash commands

As a user composing a Relay message
I want to attach workspace items with "+" or "@" and run slash commands
So that I control exactly what context goes with my message and can reset quickly

Tests live in `e2e/qa/relay/relay-improvements-picker.spec.ts`. The picker is a virtualized list capped by the workspace search index; the slash menu lists fifteen commands in six groups and keeps focus in the textfield. `bun run qa:seed:build` regenerates the seed (scale comes from the 500-request `qa-e2e-relayimp-col-500` collection) from `e2e/fixtures/seed/relay-improvements.json`.

---

## Scenario: [REL-PICK-01] "+" and "@" open the launcher; items are attached as pills (AC-07, FR-124, FR-128)

Given the dock is open
When I press the "+" button
Then the launcher opens with Recent, Attach and Actions sections
When I choose "Request" from Attach
Then a request search list opens
When I select "Request B"
Then a "Request B" pill appears in the composer
When I type "@" in the textfield
Then the mention menu opens
When I filter by environments and choose the environment
Then the environment pill appears in the composer
When I send a message
Then the outbound payload includes a request pill for "Request B" and an environment pill

---

## Scenario: [REL-PICK-02] with more requests than the result cap the picker opens, filters and renders a bounded number of rows (AC-07, FR-125, NFR-6)

Given the workspace has more requests than the picker result cap
When I open the picker with "+"
Then it is visible with a bounded number of rows and a "Keep typing to narrow results" note
When I search for "Request 437"
Then the matching request is listed

---

## Scenario: [REL-PICK-03] "/" lists fifteen grouped commands and Enter on /explain inserts a command pill (AC-20, FR-193)

Given the dock is open and a request chip is attached
When I type "/" in the textfield
Then fifteen commands appear in the six groups Understand, Build, Test, Run, Share, and Chat in catalog order
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

## Scenario: [REL-PICK-05] a query with no match shows the empty state; Esc steps back then closes (empty, NFR-8)

Given the launcher is open in the request search list
When I search for text that matches nothing
Then "Nothing matches that search" is shown
When I press Escape
Then the launcher returns to root view
When I press Escape again
Then the launcher closes and focus returns to the "+" trigger button

---

## Scenario: [REL-PICK-06] /clear on an empty thread starts a new conversation without a confirm (FR-193)

Given the conversation has no messages
When I run "/clear"
Then no confirmation is shown
And the textfield is empty and focused
