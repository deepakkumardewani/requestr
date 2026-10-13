# Feature: Relay accessibility and limits

As a keyboard or screen-reader user, or someone on a long conversation
I want Relay to announce what happens, respect my motion settings and stay fast
So that I can use it without a mouse and without it slowing down

Tests live in `e2e/qa/relay/relay-a11y.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts`; no real model is called. The 200-message thread for REL-A11Y-04 is written into IndexedDB by the spec at runtime, because a thread in the global seed would be restored into every other Relay spec.

---

## Scenario: [REL-A11Y-01] Status changes are announced in live regions (AC-22)

Given Relay is open
When a reply is being generated
Then a polite status region says Relay is typing, and clears when the reply ends
And the message list is a polite live region with an accessible name
When a destructive action is waiting for me
Then a status region says confirmation is needed

---

## Scenario: [REL-A11Y-02] The whole flow works from the keyboard with visible focus in both themes (US8, AC-22)

Given I open Relay with the shortcut
When I type a message, send it with Enter, and Tab to a confirmation card's Approve button and press Enter
Then the reply and the card outcome appear without using the mouse
And the focused control shows a focus indicator in the light and the dark color scheme

---

## Scenario: [REL-A11Y-03] Reduced motion stops the animated caret (AC-22, NFR-6)

Given my system asks for reduced motion
When Relay is waiting for a reply
Then the pending caret has no animation
And without that preference the caret is animated

---

## Scenario: [REL-A11Y-04] A 200-message thread opens fast and stays usable (NFR-1)

Given a saved conversation with 200 messages
When I open Relay
Then the latest message is visible within the time budget
And only a window of the messages is in the page
And I can still send a new message

---

## Scenario: [REL-A11Y-05] A long turn shows a step indicator after step 6 (FR-21)

Given Relay takes more than six steps to answer one message
When the seventh step starts
Then a step indicator shows the current step out of the maximum

---

## Scenario: [REL-A11Y-06] Hitting the daily cap shows a neutral message (NFR-4)

Given the daily message limit has been reached and the server answers without a Retry-After
When I send a message
Then the banner says the message limit was reached and to try later
And the server sent no wait time, so the retry waits for the default delay
And the message names no vendor
