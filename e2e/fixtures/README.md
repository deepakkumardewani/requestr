# QA seed fixture

Single source of truth: `e2e/fixtures/seed/` — one JSON file per feature area,
merged by `e2e/fixtures/seed/index.ts` (`loadSeedData()`). Everything else is
derived from it — never hand-edit `qa-seed.init.js`.

The IndexedDB schema (DB name, version, store names/keyPaths/indexes) has its
own single source of truth: `src/lib/idbSchema.ts`, shared by the real app
(`src/lib/idb.ts`), the Playwright fixture, and the generator below.

### Adding seed data for a new feature

Add a new `e2e/fixtures/seed/<feature>.json` file (array keys are merged
across files and deduped by `id`; object/scalar keys must be unique) — the
loader in `e2e/fixtures/seed/index.ts` picks it up automatically. Then
regenerate:

```bash
bun run qa:seed:build
```

No other central file needs editing.

## Playwright

```ts
import { seedQaData } from "./fixtures/qaSeed";

test("my test", async ({ page }) => {
  await seedQaData(page);
  await page.goto("/");
  // ...
});
```

Seeding runs via `page.addInitScript`, guarded by a `sessionStorage` flag
(`e2e-qa-seeded`) so it only writes once per browser context — a
`page.reload()` mid-test will NOT re-seed or clobber state the app has since
mutated. A brand-new tab/context re-runs seeding from scratch.

## agent-browser

Regenerate the standalone JS copy after editing any file in `e2e/fixtures/seed/`
(`src/lib/qaSeedSchema.spec.ts` fails if you forget):

```bash
bun run qa:seed:build
```

Then open the app with it:

```bash
agent-browser open --init-script e2e/fixtures/qa-seed.init.js http://localhost:3000
```

Tip: use a persistent profile so the seeded IndexedDB data survives across
agent-browser sessions instead of starting from an empty profile each time:

```bash
agent-browser --profile ~/.agent-browser/requestly-qa open --init-script e2e/fixtures/qa-seed.init.js http://localhost:3000
```

## Keeping this in sync with the app schema

The seed data's shape must match the schema in `src/lib/idbSchema.ts`
(`IDB_VERSION`, currently 5, and the `IDB_STORES` definitions), which
`src/lib/idb.ts` also builds its `RequestlyDB` upgrade handler from. If you
bump `IDB_VERSION` or change a store's `keyPath`/record shape there, update
the relevant file under `e2e/fixtures/seed/` and rerun
`bun run qa:seed:build` in the same change. A unit test
(`src/lib/qaSeedSchema.spec.ts`) fails CI if the committed
`qa-seed.init.js` drifts from what the generator would now produce, or if a
seed key doesn't map to a known store.

## What's seeded

- One environment (`qa-env-1`) with a `baseUrl` variable.
- One collection (`qa-collection-1`) with all seeded requests.
- One legacy-format `chainConfigs` record (keyed by `collectionId`) for
  migration testing.
- Fully-wired, runnable chains for every `chaining-ui-overhaul` QA scenario
  (see `e2e/fixtures/seed/chaining.json`), each hitting the route-mocked
  endpoints in `e2e/fixtures/chainRoutes.ts` (`installChainRoutes`) so runs
  are deterministic:
  - `qa-chain-mapping` — data mapping over an edge ({{baseUrl}} + path injection).
  - `qa-chain-failing` — a single request that returns HTTP 500.
  - `qa-chain-slow` — a single 5s-delayed request (Stop test).
  - `qa-chain-run-log` — a fast + a failing request (Run Log dock coverage).
  - `qa-chain-undo` — two requests (Cmd+Z restore-deleted-node test).
  - `qa-chain-shortcuts` — a single request (keyboard shortcuts overlay test).
  - `qa-chain-start-inputs` — a Start block (`qaToken`) feeding a request
    header via `{{qaToken}}` templating.
  - `qa-chain-evaluate` — an Evaluate block deriving a header value from an
    upstream request's response, injected into a downstream request.
  - `qa-chain-validate` — a Validate block checking a fast response against
    a schema requiring 3 missing fields.
  - `qa-chain-loop` — a Loop over a 3-item list with a paired Collect.
  - `qa-chain-parallel-lanes` — two independent (unwired) requests, one slow
    and one fast, for the parallel-lanes run-log test.
  - `qa-chain-subchain-target` — referenced by the Sub-chain steps-nest test,
    which still builds its host chain and wires the subchain block through
    the UI (that flow is the feature under test).

## QA walkthrough specs

`e2e/qa/*.spec.ts` holds the P10.4 checklist walkthrough — one independent
`test()` per checklist item, tagged `@qa`, using the shared fixtures in
`e2e/fixtures/qa.ts` (`seededPage`, the `consoleGuard` auto fixture, `snap`)
and the UI helpers in `e2e/fixtures/qaHelpers.ts`.

To add a new phase's walkthrough coverage:

1. Copy `e2e/qa/_template.spec.ts` to `e2e/qa/<feature>.spec.ts` (or run
   `/qa-spec <feature> <checklist>` in Claude Code to have it generated). It imports `test`/`expect` from
   `../fixtures/qa` (not `@playwright/test` directly, so `consoleGuard` stays
   active) and any helpers it needs from `../fixtures/qaHelpers`.
2. If the scenario needs seeded data that isn't already there, add/edit a
   file under `e2e/fixtures/seed/`, then run:
   ```bash
   bun run qa:seed:build
   ```
3. Run just the new spec:
   ```bash
   bunx playwright test e2e/qa/<feature>.spec.ts
   ```

To manually drive the same seeded data in a real browser via agent-browser:

```bash
agent-browser open --init-script e2e/fixtures/qa-seed.init.js http://localhost:3000/app
```

## Local mock server

`e2e/support/mock-server/` is a local HTTP/HTTPS/WebSocket/Socket.IO/GraphQL
server that Playwright starts itself (`webServer` in `playwright.config.ts`,
`bun e2e/support/mock-server/index.ts`; reused when already running locally).
Import addresses from `e2e/support/mock-server/mockBaseUrl.ts`
(`MOCK_BASE_URL`, `MOCK_HTTPS_URL`, `MOCK_WS_URL`, `TEST_ID_HEADER`).

- HTTP: `ANY /echo` (method, headers, query, parsed body, files, raw body), `?status=` / `?delay=` on any path,
  `/redirect?to=&status=&hops=`, `/slow`, `/cookies` (two Set-Cookie), `/large?bytes=`, `/binary?bytes=`.
- WebSocket `/ws` echoes frames; Socket.IO echoes every event, `?fail=1` forces `connect_error`.
- GraphQL `POST /graphql` (introspection, `headers` field, operation `ForceErrors` -> `errors[]`, operation `BadRequest` or header `x-mock-status: 400` -> HTTP 400).
- HTTPS on `:3334` with a self-signed cert generated at startup (system `openssl`).
- Isolation: send `x-test-id: <unique>` (or `?testId=` for WS/Socket.IO); read `GET /__requests` and clear with `POST /__reset` for that id only. Never rely on a global reset.

`e2e/mock-server.spec.ts` is the smoke spec for every capability.
