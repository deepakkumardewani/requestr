# Feature: Relay smart tools — generate tests

As a Relay user
I want Relay to write assertions for a request from its last response
So that I get a starting test suite without typing each assertion

Tests live in `e2e/qa/relay/relay-improvements-smart-tests.spec.ts`. The tool is `generate_tests` in `src/lib/relay/tools/smart.ts`; it writes to the request's open HTTP tab, so the request must be open. Chat replies are mocked by `e2e/fixtures/relayRoutes.ts` (`clientTools` runs the real client tool). The spec writes a stored response straight into the history store, then reloads.

---

## Scenario: [REL-SMART-04] generate_tests adds assertions and Undo restores them; /assert produces the prompt answered with generate_tests (AC-21, AC-20)

Given a request is open in a tab and has a stored response
And the Current tab is attached in the composer
When I choose /assert from the grouped slash menu and send the prompt it fills
And Relay answers with generate_tests
Then a change card reports the added assertions and the Tests tab lists them
When I press Undo on the card
Then the card is marked undone and the Tests tab has no assertions

---

## Scenario: [REL-SMART-08] generated assertions are still on the request after a reload (persistence)

Given Relay generated assertions for an open request
When I save the request and reload the page
Then the reopened request still has the generated assertions
