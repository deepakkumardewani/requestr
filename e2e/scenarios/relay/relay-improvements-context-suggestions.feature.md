# Feature: Contextual suggestions in Relay chat

As a user
I want to see contextual suggestions based on the current tab state
So that I can be guided to ask relevant questions about my API requests

---

## Scenario: [REL-ICTX-03] a tab with a 500 response suggests "Why did this fail?" (AC-22, FR-195)

Given I have a tab open with a stored 500 response
When I check the Relay empty state
Then the suggestions include "Why did this fail?"

---

## Scenario: [REL-ICTX-09] an empty workspace with no tab suggests "Create a request" (AC-22, empty)

Given I open Relay on a workspace with no request tab open
When the chat loads
Then the empty state shows the suggestion "Create a request"

---

## Scenario: [REL-ICTX-10] switching from the 500 tab to a GraphQL tab replaces the suggestions (FR-123, FR-195)

Given I have a tab open with a 500 response showing "Why did this fail?" suggestion
And I have a GraphQL request tab available
When I switch to the GraphQL tab
Then the suggestions change based on the tab type
