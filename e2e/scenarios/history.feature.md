# Feature: Request History

As a user
I want to view my past requests
So that I can revisit, re-run, or analyse previous API calls

Requests that must reach a server target the local mock server (`/echo` at `MOCK_BASE_URL`) with a unique `x-test-id` header for isolation (see `e2e/fixtures/README.md`). Only HTTP sends are recorded; GraphQL sends are not.

---

## Background

Given the app is loaded
And the sidebar is visible

---

@high
# evidence: src/hooks/useSendRequest.ts (addEntry), src/components/history/HistoryItem.tsx (history-item, history-item-url, history-item-status)
## Scenario: History entry is created after sending a request

Given I send a request to a valid URL
When I open the History tab in the sidebar
Then the most recent entry shows the method badge, the URL, the status code, and a relative time (for example "just now") for the request I just sent

---

@high
# evidence: src/components/history/HistoryItem.tsx (handleClick, openTab, history-item)
## Scenario: Open a history entry into a new tab

Given the History tab is open with at least one entry
When I click on a history entry
Then the request opens in a new tab
And the tab is pre-populated with the method, URL, headers, and body from that history entry

---

@medium
# evidence: src/components/history/HistoryItem.tsx (history-item-delete, deleteEntry)
## Scenario: Delete a single history entry

Given the History tab has at least one entry
When I hover over an entry
And I click the trash button ("Delete history entry") that appears
Then that entry is removed from the history list
And the other entries remain

---

@medium
# evidence: src/app/settings/SettingsPageClient.tsx (Clear History), src/stores/useHistoryStore.ts
## Scenario: Clear all history

Given the History tab has multiple entries
When I navigate to Settings and click "Clear History"
And I confirm the action
Then all history entries are removed
And the history list is empty

---

@medium
# evidence: src/stores/useHistoryStore.ts (persistence), src/lib/idbSchema.ts
## Scenario: History persists after page reload

Given I have sent several requests
When I reload the app
Then the history entries are still visible in the History tab

---

@high
# evidence: src/hooks/useSendRequest.ts (buildFailedHistoryEntry, FAILED_REQUEST_STATUS, dispatched), src/hooks/useSendRequest.ts (graphql branch returns before addEntry), src/components/history/HistoryItem.tsx (handleClick)
## Scenario: E-RT-01: A failed HTTP request is recorded in History and a GraphQL send is not

Given I open an HTTP tab with method GET and a URL on an unreachable local port (nothing listening)
When I click Send
Then the response panel shows the request-failed error state
And the History tab lists an entry for that URL with the GET method badge and a failed status (0)
When I click that history entry
Then the request reopens as an HTTP tab with the same method and URL
Given I open a GraphQL tab with a query and the local mock `/graphql` endpoint (`MOCK_BASE_URL`)
When I click Send and the response is shown
Then the History list gains no entry for the `/graphql` URL (GraphQL sends are intentionally not recorded)

---

@medium
# evidence: src/components/layout/LeftPanel.tsx (SidebarSearchInput, HistoryList filter), src/components/history/HistoryList.tsx (activeFilter, "No matches" EmptyState), src/components/layout/SidebarSearch.tsx (clearSearch button)
## Scenario: E-RT-08: Sidebar search filters History, clearing restores it, no-match shows an empty state

Given the History tab has entries with different methods and URL paths (sent against the mock `/echo` with distinct query strings)
When I type part of one entry's URL into the sidebar search input
Then only history entries whose URL or method matches are listed
When I type a term that matches no entry
Then the "No matches" empty state with "Try a different search" is shown
When I click the clear (X) button in the search input
Then the search input is empty
And all history entries are listed again

---

@medium
# evidence: src/components/history/HistoryItem.tsx (openTab with method, headers, body, params), src/hooks/useSendRequest.ts (addEntry request: tab)
## Scenario: E-RT-09: Opening a history item restores its method, headers and body

Given I sent a POST request to the mock `/echo` with a custom header and a JSON body
And I closed the request tab
When I open the History tab and click that entry
Then a new HTTP tab opens with method POST and the same URL
And the Headers tab contains the custom header
And the Body tab contains the JSON body
