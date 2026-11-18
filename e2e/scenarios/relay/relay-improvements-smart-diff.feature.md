# Feature: Relay smart tools — response diff

As a Relay user
I want Relay to compare two stored responses of a request
So that I can see what changed between runs without reading both bodies

Tests live in `e2e/qa/relay/relay-improvements-smart-diff.spec.ts`. The tool is `diff_responses` in `src/lib/relay/tools/smart.ts`. Chat replies are mocked by `e2e/fixtures/relayRoutes.ts` (`readTool` runs the real client tool and sends its result back as the next recorded request). The spec writes the stored responses straight into the history store, then reloads.

---

## Scenario: [REL-SMART-03] diff_responses reports the differing status and a changed body field (AC-21)

Given a request has two stored responses that differ in status and in one body field
When Relay asks to diff the newest response against the previous one
Then the tool row finishes and Relay replies
And the tool result sent back reports both statuses and the changed body field

---

## Scenario: [REL-SMART-07] two identical responses report no differences (empty)

Given a request has two stored responses with the same status, headers and body
When Relay asks to diff them
Then the tool row finishes and Relay replies
And the tool result sent back says the responses are identical
