# Feature: History menu, export and clear

As a user with a long request history
I want to export it or wipe it from the history panel or from Relay chat
So that I can keep a copy or start fresh, without losing data by accident

Tests live in `e2e/qa/relay/relay-improvements-history.spec.ts`. The seeded workspace already holds seven HTTP history entries; the chat replies are scripted by `e2e/fixtures/relayRoutes.ts`, so nothing reaches a real provider.

---

## Scenario: [REL-HIST-01] The ⋯ menu lists Export (JSON, HAR) and a red Clear all (AC-13)

Given the history panel holds entries
When I open the history actions menu
Then it offers an Export submenu with JSON and HAR
And it offers a Clear all item marked as destructive

---

## Scenario: [REL-HIST-02] JSON export downloads requestr-history-<date>.json and HAR export parses with log.version 1.2 (AC-13)

Given the history panel holds seven entries
When I export as JSON
Then a file named requestr-history-<date>.json downloads with seven entries
When I export as HAR
Then a requestr-history-<date>.har file downloads that parses as HAR with log.version 1.2 and seven entries

---

## Scenario: [REL-HIST-03] Clear all shows the count; Cancel keeps entries and Confirm clears them (AC-13)

Given the history panel holds seven entries
When I choose Clear all
Then the dialog states the count of seven
When I press Cancel
Then all seven entries remain
When I choose Clear all again and Confirm
Then the history is empty

---

## Scenario: [REL-HIST-04] Chat clear_history needs the ConfirmCard and export_history downloads a file (AC-13)

Given Relay is asked to export the history
Then a JSON file downloads without a confirmation card
Given Relay is asked to clear the history
Then a confirmation card appears and the entries stay until I approve
When I approve
Then the history is empty

---

## Scenario: [REL-HIST-05] With no history entries the menu still opens and Export produces a file with zero entries (empty)

Given the history is empty
When I open the menu and export as JSON
Then a file downloads that contains zero entries

---

## Scenario: [REL-HIST-06] After Confirm clear, a reload still shows an empty history (persistence)

Given I confirmed Clear all
When I reload the page
Then the history is still empty
