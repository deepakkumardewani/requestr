# Feature: Relay closes tabs and bulk-deletes requests safely

As a user who lets Relay tidy my workspace
I want tab closes to ask before dropping unsaved work, and bulk deletes to ask before removing requests
So that an assistant can never lose my edits or my requests without my say-so

Tests live in `e2e/qa/relay/relay-improvements-tabs.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts` (`clientTools` scripts ask the real client to run tools; no real model is called). The tools, the close-tabs card, the confirmation card and the stores are the production ones. Seeds come from `e2e/fixtures/seed/relay-improvements.json`: the collection "QA E2E Relay Improvements" holds Request A, Request B, 500 Error Request and GraphQL Query.

---

## Scenario: [REL-TAB-01] close_tab on a clean tab closes it silently (AC-10, FR-130)

Given Request A and Request B are open in tabs and neither has unsaved changes
When Relay is asked to close the tab of Request A
Then the Request A tab is gone and Request B is still open
And no confirmation card is shown
And the next request to the assistant reports that one tab was closed

---

## Scenario: [REL-TAB-02] close_all_tabs keeps the pinned tab and reports the kept count; naming pinned tabs closes them (AC-10, D-1)

Given Request A is pinned and Request A and Request B are open in tabs
When Relay is asked to close all tabs
Then only the Request A tab stays open
And the next request to the assistant reports one closed tab and one pinned tab kept
When Relay is then asked to close all tabs including pinned ones
Then no tab is open

---

## Scenario: [REL-TAB-03] with a dirty tab the card lists it and Save all & close saves then closes (AC-10, FR-131)

Given Request A has an unsaved URL edit and Request B is clean
When Relay is asked to close all tabs
Then a close-tabs card lists Request A as having unsaved changes
And both tabs are still open while the card waits
When I press Save all & close
Then no tab is open
And Request A, when reopened from the sidebar, shows the edited URL

---

## Scenario: [REL-TAB-04] Discard & close closes without saving and Cancel leaves every tab open (AC-10, FR-131)

Given Request A has an unsaved URL edit
When Relay is asked to close all tabs and I press Cancel
Then both tabs are still open and Request A is still marked unsaved
When Relay is asked again and I press Discard & close
Then no tab is open
And Request A, when reopened from the sidebar, shows its original URL

---

## Scenario: [REL-TAB-05] delete_requests_in_collection shows the destructive card with the count; declining changes nothing (AC-11, FR-132)

Given the scripted reply asks to delete every request in "QA E2E Relay Improvements"
When I ask Relay to do it
Then a confirmation card says it deletes 4 items
And all four requests are still in the sidebar while the card waits
When I press Decline
Then all four requests are still in the sidebar
And the next request to the assistant reports that the user declined

---

## Scenario: [REL-TAB-06] after declining the bulk delete and reloading, every request is still there (persistence)

Given I declined the bulk delete of the collection's requests
When I reload the page
Then all four requests are still in the sidebar

---

## Scenario: [REL-TAB-07] close_all_tabs with no open tabs reports that nothing was closed (empty)

Given no tab is open
When Relay is asked to close all tabs
Then no card is shown
And the next request to the assistant reports zero closed tabs
