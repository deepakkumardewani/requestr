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

## Command palette recording (`command-palette-record.ts`)

Records the real command palette driven with the keyboard only (dark theme, 1440x900 CSS viewport captured at deviceScaleFactor 2, full DummyJSON seed).

```bash
PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app \
  COMMAND_PALETTE_RECORD_DIR=$TMPDIR/command-palette-raw bun scripts/capture/command-palette-record.ts
COMMAND_PALETTE_RAW_DIR=$TMPDIR/command-palette-raw bash scripts/capture/command-palette-cut.sh
```

Starting with the "List products" request open, each beat presses the palette shortcut (`ControlOrMeta+K`),
types a query, checks that the expected item is highlighted and presses Enter:

1. `login` opens the seeded "Login" request in a new tab.
2. `new` runs the "New Request" action.
3. `trans` runs "Transform Playground", which navigates to `/transform`.

Playwright's `recordVideo` is low-bitrate VP8 and ignores deviceScaleFactor, so it is not used. The recorder
instead takes a CDP screencast of lossless PNG frames at 2x (2880x1800) and writes them to `frames/` in the
scratch directory, plus `command-palette-frames.ffconcat` (each frame held until the next one) and
`command-palette-marks.json` (start, poster and end seconds). `command-palette-cut.sh` trims to those marks,
resamples to 25 fps and downscales once with lanczos, with no lossy intermediate, and writes
`public/media/command-palette/command-palette-loop.{mp4,webm}` (2304x1440, which is 2x the widest the video
renders, 1088 CSS px; 25 fps, no audio, about 12.6 s; H.264 high CRF 16 + faststart, VP9 CRF 24, both yuv420p,
about 1 MB each) and `command-palette-poster.webp` (the first frame of the final video, 2304x1440, at most 250 KB).
The loop ends on the Transform Playground while it starts on "List products", so the cut script makes the
restart seamless: the first `FADE_SECONDS` (0.5 s, a variable at the top of `command-palette-cut.sh`) of the
trimmed clip are cross-faded (`xfade`) over its last `FADE_SECONDS` and removed from the front, so the final
frame dissolves straight into the first frame. The clip is `FADE_SECONDS` shorter, and all of it happens in the
single encode from the PNG frames. The end mark is clamped to the real end of the footage because the
concat demuxer drops the last frame's hold.
