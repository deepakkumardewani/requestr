#!/usr/bin/env bash
# Renders the demo MP4 (gitignored), then the poster and GIF fallback that ARE committed.
# Run `bun run demo-record` first so out/clips and out/manifest.json are current.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENTRY="scripts/capture/demo/index.ts"
OUT="scripts/capture/demo/out"
MEDIA="docs/media"
# Frame of the chain run's payoff, the most legible single frame of the video.
POSTER_FRAME=840
MP4_CRF=26
GIF_FPS=8
GIF_WIDTH=800
POSTER_JPEG_QUALITY=70

cd "$ROOT"
mkdir -p "$OUT" "$MEDIA"

# Remotion needs a Chromium; reuse the Playwright one when it is installed.
BROWSER_ARGS=()
SHELL_BIN="$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell 2>/dev/null | tail -1 || true)"
if [[ -n "$SHELL_BIN" ]]; then
  BROWSER_ARGS=(--browser-executable="$SHELL_BIN")
fi

bunx remotion render "$ENTRY" DemoVideo "$OUT/demo.mp4" \
  --codec=h264 --crf="$MP4_CRF" --pixel-format=yuv420p --muted "${BROWSER_ARGS[@]}"

bunx remotion still "$ENTRY" DemoVideo "$MEDIA/demo-poster.jpg" \
  --frame="$POSTER_FRAME" --image-format=jpeg --jpeg-quality="$POSTER_JPEG_QUALITY" "${BROWSER_ARGS[@]}"

ffmpeg -y -loglevel error -i "$OUT/demo.mp4" \
  -vf "fps=$GIF_FPS,scale=$GIF_WIDTH:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
  "$MEDIA/demo.gif"

ls -l "$OUT/demo.mp4" "$MEDIA/demo-poster.jpg" "$MEDIA/demo.gif"
