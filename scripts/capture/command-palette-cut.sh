#!/usr/bin/env bash
# Cuts the raw command palette recording (command-palette-record.ts) into the landing-page media:
#   public/media/command-palette/command-palette-loop.{mp4,webm}   muted loop, 2304x1440
#   public/media/command-palette/command-palette-poster.webp       palette open with results
# Input is the lossless 2x PNG frame sequence (2880x1800) from the recorder. It is trimmed (dead time before
# the first beat and after the last one is dropped) and downscaled once with lanczos, no lossy intermediate.
# The loop is seamless: the first FADE_SECONDS of the clip are cross-faded over its last FADE_SECONDS and cut
# from the front, so the final frame leads straight into the first frame. The clip is FADE_SECONDS shorter.
# 2304 px is 2x the widest the video renders (max-w-6xl container, 1088 CSS px), so it is retina-sharp.
# Trim points come from command-palette-marks.json, written next to the raw video by the recorder.
#
# Usage:
#   COMMAND_PALETTE_RAW_DIR=/path/to/scratch bash scripts/capture/command-palette-cut.sh
# Needs ffmpeg and the repo's `sharp` (run from the repo root).
set -euo pipefail

OUT="public/media/command-palette"
SIZE="2304:1440"
FPS=25
# Low CRF keeps thin text crisp; x264 and VP9 values are tuned for about 1-2 MB at this size.
H264_CRF=16
VP9_CRF=24
POSTER_MAX_BYTES=250000
# Cross-fade from the end of the clip back into its own beginning (the loop point).
FADE_SECONDS=0.5

RAW_DIR="${COMMAND_PALETTE_RAW_DIR:-${1:-}}"
RAW="$RAW_DIR/command-palette-frames.ffconcat"
MARKS="$RAW_DIR/command-palette-marks.json"
[[ -f "$RAW" && -f "$MARKS" ]] || {
  echo "Set COMMAND_PALETTE_RAW_DIR (or pass the path) to the directory holding command-palette-frames.ffconcat (plus frames/) and command-palette-marks.json" >&2
  exit 1
}
mkdir -p "$OUT"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mark() { MARKS="$MARKS" node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.MARKS, "utf8"))[process.argv[1]])' "$1"; }
START="$(mark start)"
# The concat demuxer drops the last frame's hold, so the footage really ends one frame after the last frame
# starts. Clamp the end mark to that, otherwise the tail section would be cut from footage that does not exist.
LAST_FRAME_END="$(awk -v fps="$FPS" '/^duration/ { total += prev; prev = $2 } END { printf "%.4f", total + 1 / fps }' "$RAW")"
END="$(node -e 'console.log(Math.min(Number(process.argv[1]), Number(process.argv[2])))' "$(mark end)" "$LAST_FRAME_END")"
# Section boundaries on the source timeline: head = first fade, body = the rest, tail = last fade.
FADE_IN_END="$(node -e 'console.log(Number(process.argv[1]) + Number(process.argv[2]))' "$START" "$FADE_SECONDS")"
FADE_OUT_START="$(node -e 'console.log(Number(process.argv[1]) - Number(process.argv[2]))' "$END" "$FADE_SECONDS")"

SCALE="scale=${SIZE}:flags=lanczos+accurate_rnd+full_chroma_int"
# body plays from the end of the head to the start of the tail; the tail dissolves into the head, which is
# the clip's own opening, so the last frame is one step before the first frame of the body.
FILTER="[0:v]fps=${FPS},${SCALE},format=yuv420p,split=3[a][b][c];
[a]trim=${START}:${FADE_IN_END},setpts=PTS-STARTPTS[head];
[b]trim=${FADE_IN_END}:${FADE_OUT_START},setpts=PTS-STARTPTS[body];
[c]trim=${FADE_OUT_START}:${END},setpts=PTS-STARTPTS[tail];
[tail][head]xfade=transition=fade:duration=${FADE_SECONDS}:offset=0[fade];
[body][fade]concat=n=2:v=1:a=0[out]"
encode() { ffmpeg -v error -y -f concat -safe 0 -i "$RAW" -filter_complex "$FILTER" -map "[out]" -an "$@"; }
encode -c:v libx264 -preset slow -crf "$H264_CRF" -profile:v high -tag:v avc1 -movflags +faststart "$OUT/command-palette-loop.mp4"
encode -c:v libvpx-vp9 -crf "$VP9_CRF" -b:v 0 -row-mt 1 -cpu-used 1 "$OUT/command-palette-loop.webm"

# Poster: the first frame of the final video, so it matches what the video shows before it starts.
encode -frames:v 1 "$WORK/poster.png"
WORK="$WORK" OUT="$OUT" MAX="$POSTER_MAX_BYTES" node --input-type=module -e '
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
const { WORK, OUT, MAX } = process.env;
let written = false;
for (let quality = 85; quality >= 30 && !written; quality -= 5) {
  const buffer = await sharp(`${WORK}/poster.png`).webp({ quality }).toBuffer();
  if (buffer.length > Number(MAX)) continue;
  await writeFile(`${OUT}/command-palette-poster.webp`, buffer);
  console.log(`poster webp quality ${quality}: ${buffer.length} bytes`);
  written = true;
}
if (!written) throw new Error(`poster does not fit ${MAX} bytes`);
'
echo "Done: $OUT"
