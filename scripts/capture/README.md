# Capture scripts

Real-product assets for the landing page. Nothing is mocked and the scripts never start a server.
The app is expected at `https://requestly.localhost/app` (the always-running dev server).

## Screenshots (`screens.ts`)

```bash
PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bun scripts/capture/screens.ts
PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bun scripts/capture/screens.ts --only chains,transform
```

Writes `public/screens/<name>-light.webp` and `<name>-dark.webp` (1440x900, scale 1, each at most 250 KB).
Seed data comes from `seed.ts` (DummyJSON only, the public demo account).
Names: chains, transform, json-compare, json-visualize, import, collections-envs, command-palette, relay-panel.

## Relay recording (`relay-record.ts`)

Records the real Relay assistant building and running the DummyJSON checkout chain.

Environment:
- `PLAYWRIGHT_TEST_BASE_URL`: app URL.
- `RELAY_RECORD_DIR`: scratch directory for the raw video. Keep it outside the repo.
- The model key (`DEEPSEEK_API_KEY` or `RELAY_API_KEY`) stays in the dev server's environment
  (`.env.local`, untracked). The script never reads or writes it; do not paste a key into any file here.

```bash
PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app \
  RELAY_RECORD_DIR=$TMPDIR/relay-raw bun scripts/capture/relay-record.ts
```

The script seeds only the DummyJSON environment (which holds the demo password variable, because Relay
redacts literal passwords), then sends two prompts, one per turn so each fits Relay's per-message step limit:

1. Build a chain named "DummyJSON checkout": login (capture `accessToken` as the token), get the current user
   with `Authorization: Bearer {{token}}`, get the cart of user 1, add a product (JSON body titled Desk lamp).
2. Add an assertion that the cart total is greater than 0, run the chain and report the result.

It approves Relay's own confirmation cards and answers a step-limit notice with "continue". The result is
`relay-raw.webm` (about 100 s). Review frames for keys, emails and tokens before cutting.
Model output varies between runs: re-record until the final run reads "6 passed".
