# E2E

Playwright specs live in `e2e/` (`e2e/qa/` holds the seeded QA harness; shared helpers are in `e2e/fixtures/`).

## Base URL and targeted runs

The dev server is always running at `https://requestly.localhost/app`. Never start another one and never run the full suite; run only the specs a task names:

```bash
PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test <specs>
```

When `PLAYWRIGHT_TEST_BASE_URL` is set, Playwright starts no web server.

## Server mode variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `E2E_SERVER` | `dev` | `dev` keeps the original behaviour (build + `next start` on :3000, reused if already running). `prod` builds the current tree and serves it on `E2E_PROD_PORT` with `reuseExistingServer: false`. |
| `E2E_PROD_PORT` | `3100` | Port of the `prod` server. Also the default base URL in `prod` mode. |
| `E2E_DIST_DIR` | `.next` | Next.js `distDir` (read by `next.config.ts`). `prod` mode sets it to `.next-e2e` so the build never overwrites the dev server's `.next`. |

Example (prod build, isolated output):

```bash
E2E_SERVER=prod bunx playwright test e2e/qa/relay/relay-chat.spec.ts
```

`.next-e2e` is gitignored. Never run `bun run build` in the repo without `E2E_DIST_DIR` set; it clobbers the dev server's `.next`.
