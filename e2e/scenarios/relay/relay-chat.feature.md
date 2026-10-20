# Feature: Relay streaming chat

As a user with the Relay dock open
I want to chat with Relay, stop or redo a reply, and understand every failure
So that I can trust the assistant even when the network or the server misbehaves

Tests live in `e2e/qa/relay/relay-chat.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts`; no real model is called. Rate-limit and not-configured failures are delivered as in-stream error frames, because a real HTTP 429/503 logs a browser console error that the QA console guard rejects; the HTTP-status path is covered by `useRelayChat.spec.ts` and the route specs. The tool-failure state (AC-19) is REL-WRITE-07 in Phase 5.

---

## Scenario: [REL-CHAT-01] A message streams into a reply (FR-20, AC-18)

Given the dock is open and the server will answer with a text reply
When I type a message and press Enter
Then my message appears in the conversation
And the assistant reply appears below it
And the composer is cleared and ready for the next message

---

## Scenario: [REL-CHAT-02] Stop aborts the request within 300ms and the thread stays usable (FR-20, AC-18)

Given I sent a message and the server has not finished answering
When I press the Stop button
Then the browser cancels the request within 300ms
And the Send button returns
And I can send another message and receive a reply

---

## Scenario: [REL-CHAT-03] Regenerate replaces the last assistant turn (FR-20)

Given I received a reply to my message
When I press Regenerate on the last assistant turn
Then the new reply replaces the old one
And the conversation still contains exactly one assistant reply

---

## Scenario: [REL-CHAT-04] A rate limit shows a Retry-After countdown (FR-70, FR-72, AC-19)

Given the scripted endpoint reports a rate limit with a Retry-After of 2 seconds, then answers normally
When I send a message
Then an alert says I am sending messages too quickly
And the Retry button is disabled and shows a countdown
And when the countdown ends the Retry button is enabled
And pressing it delivers the reply and removes the alert

---

## Scenario: [REL-CHAT-05] A server without Relay configured shows setup copy and no environment details (FR-70, FR-62, AC-19)

Given the scripted endpoint reports that Relay is not configured
When I send a message
Then an alert says "Relay isn't set up on this server"
And the alert offers no Retry button
And the alert names no environment variable

---

## Scenario: [REL-CHAT-06] Going offline disables the composer with an inline notice (FR-71, AC-19)

Given the dock is open
When the browser goes offline
Then the composer is disabled and the Send button is disabled
And an inline notice says I am offline
And when the browser comes back online the composer is usable again and the notice is gone

---

## Scenario: [REL-CHAT-07] Markdown renders and raw HTML stays text (FR-23, FR-24)

Given the server will answer with Markdown that contains a code block and a raw HTML tag
When I send a message
Then the code block is rendered with a copy button
And the raw HTML appears as literal text and creates no element

---

## Scenario: [REL-CTX-01] Context chips show what is sent and removing one changes the payload (AC-14)

Given a saved request is open in a tab and the dock is open
Then no context chip is shown until I attach something
When I attach the current tab and a collection through the picker
Then context chips name the request and the collection, names only
When I remove the request chip and send a message
Then the outbound payload no longer contains the request or its tab
And the collection chip still appears in the payload's chip list

---

## Scenario: [REL-CTX-02] Secrets never leave the browser in the payload (AC-16)

Given an open request with an Authorization bearer header, a cookie, a bearer auth token, a query key and a secret environment value
And I attach the current tab
When I send a message
Then the outbound payload contains none of those secret values
And the request is still described by its method and name

---

## Scenario: [REL-CTX-03] Asking why a request returned 401 reads its last response (US3, FR-52)

Given a request has a stored 401 response and the server asks to read the last response
When I send "why did this 401?"
Then a tool row says the response was read
And the follow-up payload carries the 401 status and its error body
And the follow-up payload contains none of the secret values

---

## Scenario: [REL-CTX-04] Empty-state starters do not depend on the open tab (FR-22)

Given the dock is open with an empty conversation and no request open
Then three starters are shown and a "What Relay can see" link
When I open a saved request
Then the same starters are shown and no context chip is attached
And clicking a suggestion sends it as a message

---

## Scenario: [REL-CTX-05] An oversize response body is head and tail truncated in the tool result (FR-52)

Given a request has a stored 200 response whose body is far over the size cap
When the server asks to read the body
Then the follow-up payload keeps the start and the end of the body
And it marks the omitted middle as truncated

---

## Scenario: [REL-ENTRY-01] Open in Relay from a failing response prefills the composer (AC-20, FR-32)

Given a saved request has a stored 499 response
When I click "Open in Relay" next to the failing status
Then the dock opens with the composer prefilled with an explanation prompt that names the status
And the request appears as a context chip
And nothing is sent until I send it

---

## Scenario: [REL-ENTRY-02] The existing AI buttons still return results unchanged (AC-20, FR-32)

Given a saved request has a stored 499 response and the old AI endpoint is mocked
When I click "Explain with AI"
Then the explanation from the old endpoint is shown in place
And the Relay dock stays closed

---

## Scenario: [REL-ENTRY-03] Relay settings expose only privacy controls (FR-81)

Given I have a Relay conversation
When I open Settings and choose Relay
Then there are no model, vendor or key fields
When I turn on sharing values
Then the preference is remembered after a reload
When I clear history and confirm
Then the conversation is gone from the thread list

---

## Scenario: [REL-ENTRY-04] The first-open coach appears once and dismisses (FR-84)

Given I have never opened Relay
When I open the dock
Then a three-step coach is shown
When I step through it and finish
Then it is gone
And after a reload and reopening the dock it does not return

---

## Scenario: [REL-ENTRY-05] Usage events carry names and counts but never prompt text (FR-82)

Given a listener collects Relay usage events
When I open the dock, send "secret-looking prompt text" and the reply streams
Then an opened event and a message-sent event with the message length are recorded
And no recorded event contains the prompt text
