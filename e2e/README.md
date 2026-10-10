# E2E (Playwright)

## Layout

- Specs live in `e2e/<area>.spec.ts` and `e2e/qa/` (seeded QA walkthroughs). `testDir` stays `./e2e`.
- Scenarios (Gherkin-style) live in `e2e/scenarios/<area>.feature.md`.
- Do NOT create `e2e/tests/` or `e2e/pages/`; this repo does not use that layout.
- Fixtures and seed data: `e2e/fixtures/` (see `e2e/fixtures/README.md`).

## Running

```bash
bun run test:e2e                              # whole suite
bunx playwright test e2e/<area>.spec.ts       # one spec
bun run test:qa                               # seeded @qa walkthroughs
bunx playwright test --list                   # list test titles
```

Always use `bun` / `bunx`, never `npm` / `npx`. The app base URL is `http://127.0.0.1:3000`
(override with `PLAYWRIGHT_TEST_BASE_URL` to reuse an already-running server).

## Mock server

Playwright starts `e2e/support/mock-server/index.ts` automatically (reused locally if already up).

| Port | Env override | Purpose |
|---|---|---|
| 3333 | `MOCK_PORT` | HTTP, WebSocket `/ws`, Socket.IO, GraphQL `/graphql`, health `/__health` |
| 3334 | `MOCK_HTTPS_PORT` | HTTPS `/echo` with a startup self-signed cert |

Specs import `MOCK_BASE_URL`, `MOCK_HTTPS_URL`, `MOCK_WS_URL` from
`e2e/support/mock-server/mockBaseUrl.ts`. Capabilities are documented in `e2e/fixtures/README.md`.

## Isolation

Two workers run in parallel against one mock server. Send a unique `x-test-id` header (or `?testId=`
for WebSocket / Socket.IO) per test; `/__requests` and `/__reset` are scoped to that id.
Never call a global reset from a test.

## Selector and waiting policy

- Locate by `data-testid` or role (`getByTestId`, `getByRole`); no CSS-class selectors.
- Never use `page.waitForTimeout`; wait on a real condition (`expect(...)`, `waitForURL`, `expect.poll`).
- QA specs import `test`/`expect` from `e2e/fixtures/qa` so the console guard stays active.
