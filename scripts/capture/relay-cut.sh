#!/usr/bin/env bash
# Cuts the raw Relay recording (relay-record.ts) into the landing-page media:
#   public/media/relay/relay-loop.{mp4,webm}   17 s muted seamless loop, 1x
#   public/media/relay/relay-full.{mp4,webm}   85 s captioned cut, typing sped up 4x with a visible marker
#   public/media/relay/relay-poster.{webp,avif}
# Relay's actions are never reordered, added or altered: only trimming, one speed-up of the idle
# typing span, captions, and a 1 s dissolve at the loop point.
#
# Usage:
#   RELAY_RAW=/path/to/relay-raw.webm bash scripts/capture/relay-cut.sh
#   bash scripts/capture/relay-cut.sh --check-ssim     # first-vs-last-frame SSIM of both loops (>= 0.98)
# Needs ffmpeg and the repo's `sharp` (run from the repo root).
set -euo pipefail

OUT="public/media/relay"
SIZE="1280:800"
FPS=25

# Raw-recording timeline (seconds), read off the raw footage.
TYPING_END=28      # 0-28 s: the prompt is typed; shown at TYPING_SPEED
TYPING_SPEED=4
FULL_END=106       # trailing idle after the final result is dropped
LOOP_START=85      # assertion prompt sent -> chain run -> 6 passed
LOOP_LEN=17
LOOP_DISSOLVE=1
LOOP_HOLD=0.2      # the dissolve completes this long before the end, so the last frames equal the first
POSTER_AT=100      # all steps green
SSIM_MIN=0.98
POSTER_MAX_BYTES=80000

# Captions: "<raw start>|<raw end>|line 1|line 2" (raw seconds; mapped onto the cut timeline below).
CAPTIONS=(
  "0|28|Ask Relay to build a login-to-checkout chain|on the public DummyJSON API"
  "28|56|Relay creates the collection, four requests|and the chain"
  "56|70|Step limit reached: say continue|and Relay wires the chain"
  "70|82|Relay lists the steps: login, token capture,|current user, carts, add product"
  "82|94|Ask for a cart-total assertion|then run the chain"
  "94|106|Chain run: 6 passed. Login, token capture, current user,|carts, cart-total assertion, add product"
)

ssim_of_loop() {
  local file="$1" tmp
  tmp="$(mktemp -d)"
  ffmpeg -v error -y -i "$file" -frames:v 1 "$tmp/first.png"
  ffmpeg -v error -y -sseof -0.2 -i "$file" -update 1 "$tmp/last.png"
  ffmpeg -i "$tmp/first.png" -i "$tmp/last.png" -lavfi ssim -f null - 2>&1 | grep -o "All:[0-9.]*" | cut -d: -f2
  rm -rf "$tmp"
}

check_ssim() {
  local failed=0 file value
  for file in "$OUT/relay-loop.mp4" "$OUT/relay-loop.webm"; do
    value="$(ssim_of_loop "$file")"
    if awk -v v="$value" -v m="$SSIM_MIN" 'BEGIN { exit !(v >= m) }'; then
      echo "pass  $file first-vs-last SSIM $value >= $SSIM_MIN"
    else
      echo "FAIL  $file first-vs-last SSIM $value < $SSIM_MIN"
      failed=1
    fi
  done
  exit "$failed"
}

[[ "${1:-}" == "--check-ssim" ]] && check_ssim

RAW="${RELAY_RAW:-${1:-}}"
[[ -f "$RAW" ]] || { echo "Set RELAY_RAW (or pass the path) to the raw relay-raw.webm" >&2; exit 1; }
mkdir -p "$OUT"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Caption and marker overlays (PNG, rendered with sharp; ffmpeg here has no drawtext).
CAPTION_LINES="$(printf '%s\n' "${CAPTIONS[@]}")" MARKER_TEXT="SPED UP ${TYPING_SPEED}x" WORK="$WORK" \
  node --input-type=module -e '
import sharp from "sharp";
const FONT = "Helvetica, Arial, sans-serif";
const render = (width, height, body, file) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`)).png().toFile(file);
const lines = process.env.CAPTION_LINES.split("\n");
for (const [i, row] of lines.entries()) {
  const [, , first, second] = row.split("|");
  const text = [first, second]
    .map((line, n) => `<text x="320" y="${32 + n * 28}" font-family="${FONT}" font-size="22" fill="white" text-anchor="middle">${line}</text>`)
    .join("");
  await render(640, 72, `<rect width="640" height="72" rx="14" fill="rgba(0,0,0,0.9)"/>${text}`, `${process.env.WORK}/cap${i}.png`);
}
await render(190, 40, `<rect width="190" height="40" rx="10" fill="#f59e0b"/><text x="95" y="27" font-family="${FONT}" font-size="20" font-weight="bold" fill="#111" text-anchor="middle">${process.env.MARKER_TEXT}</text>`, `${process.env.WORK}/marker.png`);
'

TYPING_OUT=$(awk -v e="$TYPING_END" -v s="$TYPING_SPEED" 'BEGIN { print e / s }')
FULL_OUT=$(awk -v t="$TYPING_OUT" -v e="$FULL_END" -v a="$TYPING_END" 'BEGIN { print t + e - a }')
to_out() { awk -v r="$1" -v e="$TYPING_END" -v s="$TYPING_SPEED" 'BEGIN { print (r <= e) ? r / s : e / s + r - e }'; }

# Full cut: typing span sped up, the rest at 1x, captions on every span, marker over the sped-up span.
INPUTS=(-i "$RAW")
FILTER="[0:v]trim=0:${TYPING_END},setpts=(PTS-STARTPTS)/${TYPING_SPEED},fps=${FPS},scale=${SIZE}[a];"
FILTER+="[0:v]trim=${TYPING_END}:${FULL_END},setpts=PTS-STARTPTS,fps=${FPS},scale=${SIZE}[b];"
FILTER+="[a][b]concat=n=2:v=1:a=0[v0]"
prev="v0"
n=1
for i in "${!CAPTIONS[@]}"; do
  IFS='|' read -r start end _ <<<"${CAPTIONS[$i]}"
  INPUTS+=(-loop 1 -i "$WORK/cap$i.png")
  FILTER+=";[$prev][$n:v]overlay=60:620:enable='between(t,$(to_out "$start"),$(to_out "$end"))'[c$n]"
  prev="c$n"
  n=$((n + 1))
done
INPUTS+=(-loop 1 -i "$WORK/marker.png")
FILTER+=";[$prev][$n:v]overlay=340:76:enable='lt(t,${TYPING_OUT})',format=yuv420p[vout]"

encode_full() { ffmpeg -v error -y "${INPUTS[@]}" -filter_complex "$FILTER" -map "[vout]" -an -t "$FULL_OUT" "$@"; }
encode_full -c:v libx264 -preset slow -crf 27 -movflags +faststart "$OUT/relay-full.mp4"
encode_full -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 -cpu-used 4 "$OUT/relay-full.webm"

# Loop: 1x footage; the last LOOP_DISSOLVE s dissolve into the footage just before the start, so the last frame equals the first.
MAIN_LEN=$(awk -v l="$LOOP_LEN" -v h="$LOOP_HOLD" 'BEGIN { print l - h }')
LOOP_END=$(awk -v s="$LOOP_START" -v m="$MAIN_LEN" 'BEGIN { print s + m }')
HEAD_START=$((LOOP_START - LOOP_DISSOLVE))
DISSOLVE_AT=$(awk -v m="$MAIN_LEN" -v d="$LOOP_DISSOLVE" 'BEGIN { print m - d }')
LOOP_FILTER="[0:v]trim=${LOOP_START}:${LOOP_END},setpts=PTS-STARTPTS,fps=${FPS},scale=${SIZE}[m];"
LOOP_FILTER+="[0:v]trim=${HEAD_START}:${LOOP_START},setpts=PTS-STARTPTS,fps=${FPS},scale=${SIZE},tpad=stop_mode=clone:stop_duration=${LOOP_HOLD}[h];"
LOOP_FILTER+="[m][h]xfade=transition=fade:duration=${LOOP_DISSOLVE}:offset=${DISSOLVE_AT},format=yuv420p[vout]"
encode_loop() { ffmpeg -v error -y -i "$RAW" -filter_complex "$LOOP_FILTER" -map "[vout]" -an "$@"; }
encode_loop -c:v libx264 -preset slow -crf 23 -movflags +faststart "$OUT/relay-loop.mp4"
encode_loop -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 -cpu-used 4 "$OUT/relay-loop.webm"

# Poster: a frame from the same session, quality lowered until it fits the budget.
ffmpeg -v error -y -ss "$POSTER_AT" -i "$RAW" -frames:v 1 -vf "scale=${SIZE}" "$WORK/poster.png"
WORK="$WORK" OUT="$OUT" MAX="$POSTER_MAX_BYTES" node --input-type=module -e '
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
const { WORK, OUT, MAX } = process.env;
for (const format of ["webp", "avif"]) {
  let written = false;
  for (let quality = 85; quality >= 30 && !written; quality -= 5) {
    const buffer = await sharp(`${WORK}/poster.png`)[format]({ quality }).toBuffer();
    if (buffer.length > Number(MAX)) continue;
    await writeFile(`${OUT}/relay-poster.${format}`, buffer);
    console.log(`poster ${format} quality ${quality}: ${buffer.length} bytes`);
    written = true;
  }
  if (!written) throw new Error(`poster ${format} does not fit ${MAX} bytes`);
}
'
echo "Done. Run: bash scripts/capture/relay-cut.sh --check-ssim"
