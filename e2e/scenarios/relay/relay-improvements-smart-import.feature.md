# Feature: Relay smart tools — curl import

As a Relay user
I want to hand Relay a curl command and get the matching saved request
So that I can bring requests in from docs and terminals without retyping them

Tests live in `e2e/qa/relay/relay-improvements-smart-import.spec.ts`. The tool is `import_curl` in `src/lib/relay/tools/smart.ts`. Chat replies are mocked by `e2e/fixtures/relayRoutes.ts` (`clientTools` runs the real client tool).

---

## Scenario: [REL-SMART-01] import_curl with a sample curl creates the matching request (AC-21)

Given Relay asks to import a curl with a method, URL, header and JSON body
When the tool runs
Then a change card announces the created request
And the request appears in the first collection with that method and URL

---

## Scenario: [REL-SMART-05] a malformed curl returns a recoverable error and creates nothing (error)

Given Relay asks to import text that is not a curl command
When the tool runs
Then an alert shows the error and no change card appears
And no request is added
And I can send another message and get an answer
