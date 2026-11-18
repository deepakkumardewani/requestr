#!/usr/bin/env node
// Re-runnable QA for the Relay media in public/media/relay (built by relay-cut.sh)
// and the theme screenshots in public/screens (built by screens.ts).
// Asserts size budgets, durations, no audio on the loop and first-vs-last-frame SSIM, then
// extracts a frame every 2 s from both cuts for the manual secrets/jump review.
//
//   node scripts/capture/verify-assets.mjs [frames-output-dir]
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIR = "public/media/relay";
const KB = 1000;
const MB = 1000 * KB;
const BUDGETS = {
  "relay-loop.mp4": 1.5 * MB,
  "relay-loop.webm": 1.5 * MB,
  "relay-full.mp4": 8 * MB,
  "relay-full.webm": 8 * MB,
  "relay-poster.webp": 80 * KB,
  "relay-poster.avif": 80 * KB,
};
const SCREENS_DIR = "public/screens";
const SCREEN_MAX_BYTES = 250 * KB;
const SCREEN_THEMES = ["light", "dark"];
// Every screen name screens.ts produces, including the polished dialogs (T10.10).
const SCREEN_NAMES = [
  "backup-export",
  "backup-restore",
  "chains",
  "collections-envs",
  "command-palette",
  "import",
  "import-dialog",
  "json-compare",
  "json-visualize",
  "relay-panel",
  "transform",
];
const DURATIONS = { loop: [15, 20], full: [60, 90] };
const SSIM_MIN = 0.98;
const FRAME_INTERVAL_SECONDS = 2;

let failures = 0;
const report = (ok, message) => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${message}`);
};

const run = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const duration = (file) =>
  Number(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]),
  );

const hasAudio = (file) =>
  run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a",
    "-show_entries",
    "stream=codec_type",
    "-of",
    "csv=p=0",
    file,
  ]).trim() !== "";

function firstVsLastSsim(file, scratch) {
  const first = join(scratch, "first.png");
  const last = join(scratch, "last.png");
  run("ffmpeg", ["-v", "error", "-y", "-i", file, "-frames:v", "1", first]);
  run("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-sseof",
    "-0.2",
    "-i",
    file,
    "-update",
    "1",
    last,
  ]);
  // ffmpeg prints the ssim summary on stderr.
  const { stderr } = spawnSync(
    "ffmpeg",
    ["-i", first, "-i", last, "-lavfi", "ssim", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const match = /All:([0-9.]+)/.exec(stderr);
  if (!match) throw new Error(`no SSIM in ffmpeg output for ${file}`);
  return Number(match[1]);
}

function checkScreens() {
  const expected = SCREEN_NAMES.flatMap((name) =>
    SCREEN_THEMES.map((theme) => `${name}-${theme}.webp`),
  );
  const present = new Set(readdirSync(SCREENS_DIR));
  for (const file of expected) {
    if (!present.has(file)) {
      report(false, `${file} missing from ${SCREENS_DIR}`);
      continue;
    }
    const size = statSync(join(SCREENS_DIR, file)).size;
    report(
      size <= SCREEN_MAX_BYTES,
      `${file} ${size} bytes <= ${SCREEN_MAX_BYTES}`,
    );
  }
  const known = new Set(expected);
  for (const file of present) {
    report(known.has(file), `${file} is in the screen manifest (no orphan)`);
  }
}

const scratch = mkdtempSync(join(tmpdir(), "verify-assets-"));
try {
  checkScreens();

  for (const [name, max] of Object.entries(BUDGETS)) {
    const size = statSync(join(DIR, name)).size;
    report(size <= max, `${name} ${size} bytes <= ${max}`);
  }

  for (const [kind, [min, max]] of Object.entries(DURATIONS)) {
    for (const ext of ["mp4", "webm"]) {
      const seconds = duration(join(DIR, `relay-${kind}.${ext}`));
      report(
        seconds >= min && seconds <= max,
        `relay-${kind}.${ext} duration ${seconds.toFixed(2)} s within ${min}-${max}`,
      );
    }
  }

  for (const ext of ["mp4", "webm"]) {
    const file = join(DIR, `relay-loop.${ext}`);
    report(!hasAudio(file), `relay-loop.${ext} has no audio track`);
    const ssim = firstVsLastSsim(file, scratch);
    report(
      ssim >= SSIM_MIN,
      `relay-loop.${ext} first-vs-last SSIM ${ssim} >= ${SSIM_MIN}`,
    );
  }

  const framesDir = process.argv[2];
  if (framesDir) {
    for (const kind of ["loop", "full"]) {
      const out = join(framesDir, kind);
      mkdirSync(out, { recursive: true });
      run("ffmpeg", [
        "-v",
        "error",
        "-y",
        "-i",
        join(DIR, `relay-${kind}.mp4`),
        "-vf",
        `fps=1/${FRAME_INTERVAL_SECONDS}`,
        join(out, "%03d.png"),
      ]);
      console.log(
        `frames  ${out} (every ${FRAME_INTERVAL_SECONDS} s, for manual review)`,
      );
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

process.exit(failures === 0 ? 0 : 1);
