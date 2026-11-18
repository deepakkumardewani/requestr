# Feature: Explicit context (Relay polish, phase 5)

As a user of Relay
I want only the items I attach to be sent to the model
So that opening a request, collection or environment never leaks anything implicitly

Tests live in `e2e/qa/relay/relay-polish-ctx.spec.ts`. The mocked chat route (`installRelayRoutes`) records every outbound body, so specs assert on the exact payload. The always-sent `workspace` index is not an implicit-context key and is not asserted against. Seed: `e2e/fixtures/seed/relay-improvements.json`.

---

## Scenario: [REL-POL-CTX-01] with a request, collection and environment open and nothing attached, the composer has no pill and the chat body has no activeTab, collection or environment key @critical

Given a saved request is open in a tab, its collection is expanded and an environment is active
When I send a message without attaching anything
Then the composer shows no context pill
And the /api/relay/chat body context has no activeTab, collection or environment key

---

## Scenario: [REL-POL-CTX-02] no "Using: ... current tab" text exists in the DOM @high

Given a saved request is open and nothing is attached
Then no "Using:" text exists anywhere in the page
When I attach the Current tab
Then still no "Using:" text exists

---

## Scenario: [REL-POL-CTX-03] the Current tab row in the launcher's Attach section attaches a tab pill and the next body has activeTab for that tab and nothing else implicit @critical

Given a saved request is open and an environment is active
When I attach it through the launcher's Attach section Current tab row
Then a single tab pill labelled with the request name appears
And the next body has activeTab for that tab
And the body has no collection, environment or attached key
And the body chips list holds exactly the tab chip

---

## Scenario: [REL-POL-CTX-04] with no tab open the Current tab row in the launcher is disabled with "No tab open" @high

Given no tab is open
When I open the launcher
Then the Current tab row is disabled and reads "No tab open"

---

## Scenario: [REL-POL-CTX-05] attaching a request sends exactly that request's description; a duplicate attach does not duplicate it @critical

Given the dock is open
When I attach Request A through the picker twice
Then one request pill exists
And the body sends a single attached entry for Request A with its name, method and url
And the body has no activeTab, collection or environment key

---

## Scenario: [REL-POL-CTX-06] starting a new chat clears attached items @high

Given the Current tab is attached and a message was sent
When I start a new chat
Then no pills remain
And the next body has no activeTab

---

## Scenario: [REL-POL-CTX-07] the empty-state suggestions follow the open tab: generic with none, then named for each request @high

Given the dock shows the empty state with no tab open
Then the four generic suggestions are listed
When I open Request A and then Request B
Then the suggestions are Explain, Run and Write assertions for the open request, named for A and then for B

---

## Scenario: [REL-POL-CTX-08] a scripted "explain this response" with nothing attached gets a reply that asks the user to attach Current tab, with no get_active_context data @critical

Given a request is open, nothing is attached and the scripted reply asks the user to attach Current tab
When I send "explain this response"
Then the reply asks me to attach Current tab
And the body has no activeTab
And no get_active_context tool row is rendered

---

## Scenario: [REL-POL-CTX-09] a seeded persisted thread containing an old get_active_context tool part renders, continues, and its payload is redacted @high

Given a persisted thread holds a get_active_context tool part whose environment variable JWT_SECRET holds a raw secret value
When I open it from the thread list
Then the thread and its tool row render
When I send a follow-up
Then the follow-up is sent with no implicit context keys
And the raw secret is nowhere in the outbound body and the value is replaced by [redacted]

---

## Scenario: [REL-POL-CTX-10] secret environment values stay [redacted] in the body when the environment is attached with Share variable values on and off @high

Given an environment with a secret variable is attached
When Share variable values is off
Then the body never contains the secret value
When Share variable values is on
Then the secret variable is [redacted] and the raw secret is nowhere in the body
