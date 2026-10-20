# Feature: Relay privacy and branding

As a user who sends workspace context to Relay
I want no vendor or model name, no secret value and no unconfirmed action anywhere
So that Relay stays a product feature I can trust with my data

Tests live in `e2e/qa/relay/relay-privacy.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts` for client-visible paths; REL-PRIV-01 also calls the real `/api/relay/chat` route with requests that never reach a model. The banned-token list is `BANNED_TOKENS` from `src/lib/relay/server/bannedTokens.ts`, the same constant the unit brand guard uses (FR-63). The seed supplies a secret-bearing request and environment (`qa-e2e-relay-ctx-req`, `qa-e2e-relay-env`) and a request to guard against injected deletion.

---

## Scenario: [REL-PRIV-01] No /api/relay response carries a banned token (AC-15, FR-62, FR-63)

Given the app is running
When I collect every response of `/api/relay/*` for a normal reply, a rate limit, a server without Relay configured, and malformed, oversized and cross-origin requests
Then none of the response bodies contains a banned vendor or model token
And none of the response headers contains one either

---

## Scenario: [REL-PRIV-02] No visible UI surface names a vendor or model (AC-15, FR-62, FR-81)

Given I open Relay for the first time
When I look at the chat after a reply, the rate-limit and not-configured error states, the first-open coach and the Relay settings
Then the visible text, labels and placeholders on each surface contain no banned token

---

## Scenario: [REL-PRIV-03] Secrets never appear in the outbound payload (AC-16, FR-60)

Given a saved request has an Authorization bearer token, a cookie and a secret query key
And the active environment holds a secret value
When I attach that request through the "Current tab" row and chat and Relay reads the request and the environment
Then no outbound chat payload contains any of those secret values
And the payload still names the request, so context was sent

---

## Scenario: [REL-PRIV-04] An injected response body triggers no unconfirmed action (AC-17, FR-42)

Given a request returns a body that tells the assistant to delete everything
When Relay sends it and then asks to delete a request
Then a confirmation card names the real request
And nothing is deleted while the card is pending
And declining keeps the request
