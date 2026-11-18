// Records the REAL command palette being driven with the keyboard in the real app.
// No mocked routes and no scripted UI: the script only presses the palette shortcut,
// types a query and presses Enter. Seed data is the DummyJSON demo set from seed.ts.
// Usage: PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app \
//          COMMAND_PALETTE_RECORD_DIR=<scratch dir> bun scripts/capture/command-palette-record.ts
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { type CDPSession, chromium, expect, type Page } from "@playwright/test";
import { ENV_ID, seedCaptureData } from "./seed";

const VIEWPORT = { width: 1440, height: 900 };
// Playwright's recordVideo is low-bitrate VP8 and ignores deviceScaleFactor, so it can never be crisp.
// Instead a CDP screencast captures lossless PNG frames at 2x (2880x1800); the cut script encodes them.
const DEVICE_SCALE_FACTOR = 2;
const TYPE_DELAY_MS = 140;
const STEP_TIMEOUT_MS = 20_000;
// Pauses are sized so a viewer can read each state before it changes.
const LEAD_IN_MS = 1200;
const PALETTE_OPEN_PAUSE_MS = 700;
const RESULT_READ_PAUSE_MS = 1100;
const AFTER_RUN_PAUSE_MS = 1500;
const TAIL_MS = 800;
const MS_PER_SECOND = 1000;
const HIDE_DEV_OVERLAY_CSS = "nextjs-portal{display:none !important}";
const ACTIVE_ENV_KEY = "requestly_active_env_id";
const PALETTE_SHORTCUT = "ControlOrMeta+k";
const SELECTED_ITEM = "[cmdk-item][data-selected='true']";
const COLLECTION_NAME = "DummyJSON Shop";
const START_REQUEST_NAME = "List products";
const FRAMES_DIR = "frames";
const FRAMES_LIST_NAME = "command-palette-frames.ffconcat";
const MARKS_NAME = "command-palette-marks.json";
const JSON_INDENT = 2;

// Every open request tab carries a "Close <name> tab" button.
const ANY_CLOSE_TAB = /^Close .* tab$/;
// The start request, the request opened by the first beat, and the new one.
const TABS_AFTER_NEW_REQUEST = 3;

const closeTabButton = (page: Page, name: string) =>
  page.getByRole("button", { name: `Close ${name} tab`, exact: true });

type Beat = {
  /** Typed into the palette input. */
  query: string;
  /** The palette item that must be highlighted before Enter is pressed. */
  item: string;
  /** Proves the item really ran. */
  ran: (page: Page) => Promise<void>;
};

const BEATS: Beat[] = [
  {
    query: "login",
    item: "Login",
    ran: (page) => expect(closeTabButton(page, "Login")).toBeVisible(),
  },
  {
    query: "new",
    item: "New Request",
    ran: (page) =>
      expect(page.getByRole("button", { name: ANY_CLOSE_TAB })).toHaveCount(
        TABS_AFTER_NEW_REQUEST,
      ),
  },
  {
    query: "trans",
    item: "Transform Playground",
    ran: (page) => page.waitForURL(/\/transform$/),
  },
];
// The poster comes from the last beat: its results list an action and requests together.
const POSTER_BEAT_INDEX = BEATS.length - 1;

const log = (message: string) =>
  console.log(`[command-palette-record] ${message}`);

/**
 * Opens the palette with its shortcut, types the query, then runs the highlighted item.
 * `onResultsShown` fires halfway through the pause in which the results are on screen.
 */
async function runBeat(
  page: Page,
  beat: Beat,
  onResultsShown?: () => void,
): Promise<void> {
  await page.keyboard.press(PALETTE_SHORTCUT);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.waitForTimeout(PALETTE_OPEN_PAUSE_MS);
  await page.keyboard.type(beat.query, { delay: TYPE_DELAY_MS });
  await expect(page.locator(SELECTED_ITEM)).toContainText(beat.item);
  await page.waitForTimeout(RESULT_READ_PAUSE_MS / 2);
  onResultsShown?.();
  await page.waitForTimeout(RESULT_READ_PAUSE_MS / 2);
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "hidden" });
  await beat.ran(page);
  log(`ran "${beat.item}" from query "${beat.query}"`);
  await page.waitForTimeout(AFTER_RUN_PAUSE_MS);
}

async function openStartRequest(page: Page): Promise<void> {
  await page.getByText(COLLECTION_NAME, { exact: true }).click();
  await page.getByText(START_REQUEST_NAME, { exact: true }).click();
  await expect(closeTabButton(page, START_REQUEST_NAME)).toBeVisible();
  // Park the pointer so no hover state is left on the sidebar.
  await page.mouse.move(0, 0);
}

type Frame = { file: string; at: number };

/**
 * Screencast frames are only emitted when the page changes, so each frame keeps the time it was
 * painted; the cut script holds it until the next one. PNG keeps small text free of JPEG smear.
 */
async function startScreencast(cdp: CDPSession, framesDir: string) {
  const frames: Frame[] = [];
  const writes: Promise<void>[] = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = `${String(frames.length).padStart(6, "0")}.png`;
    frames.push({ file, at: metadata.timestamp ?? Date.now() / MS_PER_SECOND });
    writes.push(
      writeFile(path.join(framesDir, file), Buffer.from(data, "base64")),
    );
    void cdp.send("Page.screencastFrameAck", { sessionId });
  });
  await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  return {
    async stop() {
      await cdp.send("Page.stopScreencast");
      await Promise.all(writes);
      return frames;
    },
  };
}

async function main() {
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
  const outDir = process.env.COMMAND_PALETTE_RECORD_DIR;
  if (!baseUrl)
    throw new Error(
      "Set PLAYWRIGHT_TEST_BASE_URL (the app is never started here).",
    );
  if (!outDir)
    throw new Error(
      "Set COMMAND_PALETTE_RECORD_DIR to a scratch directory outside the repo.",
    );
  const framesDir = path.join(outDir, FRAMES_DIR);
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme: "dark",
  });
  await context.addInitScript(
    ({ envKey, envId }) => {
      localStorage.setItem("theme", "dark");
      localStorage.setItem(envKey, envId);
    },
    { envKey: ACTIVE_ENV_KEY, envId: ENV_ID },
  );
  const page = await context.newPage();
  // Marks are epoch seconds, the same clock as the frame timestamps; they are rebased below.
  const seconds = () => Date.now() / MS_PER_SECOND;
  page.setDefaultTimeout(STEP_TIMEOUT_MS);
  await seedCaptureData(page);
  const screencast = await startScreencast(
    await context.newCDPSession(page),
    framesDir,
  );
  const marks = { start: 0, poster: 0, end: 0 };
  let frames: Frame[] = [];
  try {
    await page.goto(new URL("/app", new URL(baseUrl).origin).toString());
    await page.addStyleTag({ content: HIDE_DEV_OVERLAY_CSS });
    await openStartRequest(page);
    await page.waitForTimeout(LEAD_IN_MS);
    marks.start = seconds();
    await page.waitForTimeout(LEAD_IN_MS);

    for (const [index, beat] of BEATS.entries()) {
      const markPoster = () => {
        marks.poster = seconds();
      };
      await runBeat(
        page,
        beat,
        index === POSTER_BEAT_INDEX ? markPoster : undefined,
      );
    }
    marks.end = seconds();
    await page.waitForTimeout(TAIL_MS);
  } finally {
    frames = await screencast.stop();
    await context.close();
    await browser.close();
  }
  if (frames.length === 0) throw new Error("No frames were captured");
  const origin = frames[0].at;
  const endAt = seconds();
  // ffconcat: each frame is shown from its own timestamp until the next frame (the last until stop).
  const lines = frames.map(({ file, at }, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].at : endAt;
    return `file '${FRAMES_DIR}/${file}'\nduration ${Math.max(next - at, 0.001).toFixed(4)}`;
  });
  await writeFile(path.join(outDir, FRAMES_LIST_NAME), `${lines.join("\n")}\n`);
  for (const key of Object.keys(marks) as (keyof typeof marks)[])
    marks[key] -= origin;
  await writeFile(
    path.join(outDir, MARKS_NAME),
    JSON.stringify(marks, null, JSON_INDENT),
  );
  log(`${frames.length} frames in ${framesDir}`);
  log(`marks (seconds): ${JSON.stringify(marks)}`);
}

main().catch((error) => {
  console.error("command palette recording failed:", error);
  process.exit(1);
});
