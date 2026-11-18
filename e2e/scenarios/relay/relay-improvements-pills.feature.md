# Feature: Relay Pills — opening requests from chat links

As a Relay user
I want to click on `relay://` links in AI replies to open referenced requests
So that I can quickly navigate to the entities the assistant mentions

Tests live in `e2e/qa/relay/relay-improvements-pills.spec.ts`. Pills are rendered by `src/components/relay/EntityPill.tsx`, which resolves `relay://` links via `src/lib/relay/entityLinks.ts` and opens the entity in the workspace.

---

## Scenario: [REL-PILL-01] a valid request link renders a pill with method badge and clicking opens that request

Given a relay chat reply contains a markdown link to a valid request
When the reply renders
Then the link displays as an EntityPill button with the request's HTTP method badge
And the badge has colour-coding appropriate to the method (GET, POST, etc.)
And clicking the pill opens the request in the workspace

---

## Scenario: [REL-PILL-02] an unknown id renders plain label text with no link role

Given a relay chat reply contains a link to `relay://request/unknown-id`
When the reply renders
Then the link displays as plain text (not a pill button)
And no click handler or link role is attached
And the text is not interactive

---

## Scenario: [REL-PILL-03] javascript: and unknown relay:// kinds are not linkified

Given a relay chat reply contains unsafe links like `javascript:alert()` or `relay://task/id`
When the reply renders
Then neither link is converted to a clickable pill or `<a>` tag
And both display as plain text without link or button role

---

## Scenario: [REL-PILL-04] GET/POST and 404/500 tokens are colour-coded with their text present

Given a relay chat reply mentions HTTP methods (GET, POST) or status codes (404, 500)
When the reply renders
Then each method word is wrapped in a `<span data-testid="relay-method">` with appropriate colour
And each status code is wrapped in a `<span data-testid="relay-status">` with appropriate colour
And the text inside each span remains readable

---

## Scenario: [REL-PILL-05] after the referenced request is deleted, reopening the thread renders the link as plain text

Given a relay chat thread contains a pill linking to an existing request
When the request is deleted from the workspace
And the thread is reopened
Then the same link no longer renders as a pill (because the entity no longer resolves)
And it displays as plain text instead
