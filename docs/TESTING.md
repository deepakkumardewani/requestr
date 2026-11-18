# Testing and QA

Three layers: Vitest unit specs, Playwright specs, and a seeded QA harness that leaves screenshot evidence. Every claim cites a path.

## Unit (Vitest)

- Config: `vitest.config.ts` (node environment, `*.spec.ts` and `*.spec.tsx` specs under `src`, setup in `src/vitest-setup.ts`, 15 s test timeout, v8 coverage over `./src/lib`, `./src/stores`, `./src/hooks`, `./src/app/api`).
- Specs sit beside the code they cover.
- Run: `bun run test` (all) or `bunx vitest run <path>` (targeted). Typecheck is `bun run typecheck`; lint is `bun run lint:check` (Biome).
- Files under `./src/components/reactbits/` take no tests (`CLAUDE.md`).

## End to end (Playwright)

- Config: `playwright.config.ts` (`testDir` is `e2e`, files named `_*.spec.ts` are ignored).
- Specs: `*.spec.ts` files in `e2e` for core flows, `./e2e/qa` for the QA harness, `./e2e/scenarios`, helpers in `./e2e/fixtures`.
- Run only the specs a change needs, against a running app: `PLAYWRIGHT_TEST_BASE_URL=<app url> bunx playwright test <spec>`. With that variable set Playwright starts no web server (`e2e/README.md`). Do not start a second dev server.
- `bun run test:e2e` runs the whole suite; prefer targeted runs.

### Production mode

`E2E_SERVER=prod` builds the current tree and serves it on `E2E_PROD_PORT` (default 3100) with `reuseExistingServer: false`; `E2E_DIST_DIR` (default `.next-e2e`) keeps the build away from the dev server's `.next` (`playwright.config.ts`, table in `e2e/README.md`). The echo server for Socket.IO specs starts from `scripts/run-socketio-echo.sh`.

## QA harness

- Specs in `./e2e/qa` are tagged `@qa`; `bun run test:qa` runs `playwright test --grep @qa`. Start a new one by copying `e2e/qa/_template.spec.ts` and read the rules in its header (no `waitForTimeout`, role or test-id locators, end each test with `snap`).
- Fixtures: `e2e/fixtures/qa.ts` provides `seededPage` (seed data written before load) and `snap(name)`, which saves `agent_docs/qa/<spec name>/<name>.png`. It also installs a console guard that fails a test on any console error or warning; `allowExpectedConsoleError` is the only scoped exception.
- Helpers: `e2e/fixtures/qaHelpers.ts`, `chainE2eHelpers.ts`, `chainRoutes.ts` (mocks outbound hosts and answers 599 for unmocked ones), `relayRoutes.ts`, `relayE2eHelpers.ts`, `speechStub.ts`.

### Seeds

The `*.json` files in `./e2e/fixtures/seed` hold one feature area each, merged by `e2e/fixtures/seed/index.ts` (array keys merged and deduped by `id`). `e2e/fixtures/qaSeed.ts` writes it into IndexedDB using the real schema from `src/lib/idbSchema.ts`, guarded by a `sessionStorage` flag so a reload does not re-seed. `e2e/fixtures/qa-seed.init.js` is generated: never edit it, run `bun run qa:seed:build` (`scripts/build-qa-seed-js.ts`). Details: `e2e/fixtures/README.md`.

## Evidence

QA screenshots live in `agent_docs/qa/<spec>/`. Specs for a feature phase are in `./e2e/qa/polish-and-landing` and `./e2e/qa/relay`.
