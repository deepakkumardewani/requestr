# Feature: Context payload safety

As a user attaching environments and collections to Relay
I want to know that secret values are redacted and large collections are capped
So that I can safely share workspace context without leaking secrets or overwhelming the model

Tests live in `e2e/qa/relay/relay-improvements-context-payload.spec.ts`. The mocked chat route captures request bodies so specs assert on the exact payload sent. Context is sent only for items attached through the picker. Share toggle controls whether environment values and collection data are included. `bun run qa:seed:build` regenerates the seed from `e2e/fixtures/seed/relay-improvements.json`.

---

## Scenario: [REL-ICTX-04] env with Share off sends names only; Share on sends non-secret values and [redacted] for the secret (AC-08, FR-126, NFR-1)

Given the dock is open and an environment with a secret variable is attached as a pill through the picker
When Share is off and I send a message
Then the environment appears in the payload with variable names and has-value flags only
And the secret variable value is not present in the payload
When I enable Share in the settings and send another message
Then the environment appears in the payload with the secret variable marked [redacted]
And no actual secret value appears anywhere in the entire JSON payload

---

## Scenario: [REL-ICTX-05] a 500-request collection sends at most 50 entries plus "…and 450 more" (AC-09, FR-127)

Given the dock is open
When I attach the 500-request collection as a pill through the picker
And I send a message
Then the payload includes at most 50 request entries from the collection
And the collection context shows "…and 450 more — use search"
And each item has name, method, and url fields

---

## Scenario: [REL-ICTX-11] a 500 from the chat route keeps the attachments and shows a retryable error (error)

Given the dock is open and an environment is attached as a pill through the picker
And the mocked chat route will return a 500 error
When I send a message
Then an error banner appears with the message "Relay is unavailable right now. Try again."
And the environment pill remains visible
And I can see a retry button
When I click the retry button and the route now succeeds
Then the retried request includes the environment attachment in its context
And the environment pill is still visible

