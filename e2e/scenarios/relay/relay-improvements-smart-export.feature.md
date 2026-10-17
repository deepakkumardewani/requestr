# Feature: Relay smart tools — curl export

As a Relay user
I want Relay to hand me a saved request as a curl command
So that I can share or run it in a terminal without leaking my secrets

Tests live in `e2e/qa/relay/relay-improvements-smart-export.spec.ts`. The tool is `export_curl` in `src/lib/relay/tools/smart.ts`. Chat replies are mocked by `e2e/fixtures/relayRoutes.ts` (`readTool` runs the real client tool and sends its redacted result back as the next recorded request).

---

## Scenario: [REL-SMART-02] export_curl replies with the curl and the secret header redacted (AC-21, NFR-1)

Given a saved request carries an Authorization header, a cookie and an API key in its URL
When Relay asks to export that request as curl
Then the tool row finishes and Relay replies
And the tool result sent back contains the curl with the request URL
And none of the secret values appear in any outbound payload

---

## Scenario: [REL-SMART-06] export_curl for an unknown request id shows a recoverable error (error)

Given Relay asks to export a request id that does not exist
When the tool runs
Then an alert shows the request was not found
And I can send another message and get an answer
