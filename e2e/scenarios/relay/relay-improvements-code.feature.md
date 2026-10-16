# Feature: Relay Code Blocks — highlight, copy and apply to the active tab

As a Relay user
I want fenced code in AI replies to be readable, copyable and applicable to my open request
So that I can move generated JSON or messages into a tab without retyping, and undo it

Tests live in `e2e/qa/relay/relay-improvements-code.spec.ts`. Blocks are rendered by `src/components/relay/CodeBlock.tsx` (highlighting via `src/lib/relay/codeHighlight.ts`) and the apply button by `src/components/relay/ApplyCodeAction.tsx`, which resolves its target through `src/lib/relay/applyCode.ts` and writes through the change log. Applying only stores text in one field; nothing is sent or connected.

---

## Scenario: [REL-CODE-01] a fenced json block is highlighted and Copy puts the code on the clipboard

Given a relay reply contains a fenced `json` code block
When the reply renders
Then the block shows the code with highlighting applied
And pressing Copy puts exactly the code on the clipboard
And the Copy button announces Copied

---

## Scenario: [REL-CODE-02] on an HTTP tab Apply as body confirms and updates only the body; nothing is sent

Given an HTTP request tab is active and a reply contains a fenced json block
When I press Apply as body
Then a confirm asks whether to replace the body of this request
And after I confirm, the request body holds the code
And the URL is unchanged
And no network request is made to the request's URL

---

## Scenario: [REL-CODE-03] Apply as variables works for valid JSON and is disabled for invalid JSON; Apply as message fills the WebSocket draft

Given a GraphQL tab is active
When a reply contains valid JSON, then Apply as variables is enabled and writes the variables after confirm
And when a reply contains invalid JSON, then Apply as variables is disabled
Given a WebSocket tab is active
When I confirm Apply as message
Then the message draft holds the code and nothing is sent

---

## Scenario: [REL-CODE-04] with no request tab the apply button is disabled with a tooltip

Given no request tab is open and a reply contains a fenced code block
When the reply renders
Then the apply button is disabled
And its tooltip says to open a request tab

---

## Scenario: [REL-CODE-05] Undo after Apply as body restores the previous body

Given an HTTP tab with an existing body and a body was applied from a reply
When I press Undo on the resulting change card
Then the body shows the previous content again
