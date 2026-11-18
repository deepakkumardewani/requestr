# Feature: Relay threads and persistence

As a user who chats with Relay across sessions
I want my conversations saved, searchable and separated per workspace
So that I can pick up where I left off and keep the history tidy

Tests live in `e2e/qa/relay/relay-threads.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts`; no real model is called. The seed holds one thread that belongs to another workspace (`qa-e2e-relay-thread-foreign`). The 50 threads for the retention scenario are written into IndexedDB by the spec at runtime, because a thread in the global seed would be restored into every other Relay spec.

---

## Scenario: [REL-THR-01] Reloading restores the last thread (FR-10, FR-11, FR-12, AC-13)

Given I sent a message and received a reply in Relay
And the conversation has been saved
When I reload the page and open Relay
Then my message and the reply are shown again
And the header shows the conversation's title, taken from my first message

---

## Scenario: [REL-THR-02] Search, rename and delete with undo (FR-11, AC-13)

Given Relay holds two saved conversations
When I search the history for part of one title
Then only the matching conversation is listed
When I rename it and press Enter
Then the list and the header show the new name
When I delete it from the menu
Then it disappears from the list and a toast offers Undo
And when I press Undo the conversation is back with its messages

---

## Scenario: [REL-THR-03] Threads from another workspace are not listed (FR-10, AC-13)

Given a conversation exists that belongs to a different workspace
And Relay holds one conversation of my own
When I open the history
Then only my own conversation is listed
And searching for the other workspace's title finds nothing

---

## Scenario: [REL-THR-04] The 51st thread prunes the oldest and shows a one-time notice (FR-14)

Given Relay already holds 50 conversations
When I start a new conversation
Then the history still lists 50 conversations
And the oldest one is gone
And a notice explains that the oldest conversation was removed
And once I dismiss the notice it does not come back

---

## Scenario: [REL-THR-05] New thread starts a blank conversation and keeps the old one (FR-12)

Given I received a reply in a conversation
When I press the New conversation button
Then the conversation area is empty
And the earlier conversation is still in the history with its messages
