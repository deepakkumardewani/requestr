// Records the REAL Relay assistant building the DummyJSON chain in the real app.
// No mocked routes and no scripted UI: the script only types the prompt, approves
// Relay's own confirmation cards and waits. The model key lives in the server's
// environment; nothing secret is read, written or passed through this script.
// Usage: PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app \
//          RELAY_RECORD_DIR=<scratch dir> bun scripts/capture/relay-record.ts
import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { ENV_ID, PASSWORD_VARIABLE, seedCaptureData } from "./seed";

const VIEWPORT = { width: 1440, height: 900 };
const TYPE_DELAY_MS = 45;
const POLL_MS = 500;
const APPROVE_CLICK_TIMEOUT_MS = 3000;
const SETTLE_MS = 2500;
const QUIET_MS = 8000;
const MAX_RECORD_MS = 5 * 60 * 1000;
// Relay shows "Working for Ns" for as long as a turn is running.
const WORKING_LABEL = /Working for/;
const HIDE_DEV_OVERLAY_CSS = "nextjs-portal{display:none !important}";
const RAW_NAME = "relay-raw.webm";

// One message per turn keeps each turn inside Relay's per-message step limit.
const PROMPTS = [
  "Build a request chain named DummyJSON checkout against https://dummyjson.com. " +
    "Step 1: POST /user/login with username emilys and the password {{" +
    PASSWORD_VARIABLE +
    "}} from the DummyJSON environment, and capture accessToken as the token. " +
    "Step 2: GET /user/me with the header Authorization whose value is exactly: Bearer {{token}} (the word Bearer, a space, then the token). " +
    "Step 3: GET /carts/user/1. " +
    "Step 4: POST /products/add with a JSON body titled Desk lamp.",
  "Now add an assertion that the cart total is greater than 0, then run the chain and tell me how it went.",
];
const STEP_LIMIT_LABEL = /reached its step limit/;
const CONTINUE_MESSAGE = "continue";
const MAX_CONTINUES = 2;

const log = (message: string) => console.log(`[relay-record] ${message}`);

/** Approves every confirmation card Relay raises until the chat has been quiet. */
async function approveUntilQuiet(page: Page, deadline: number): Promise<void> {
  let lastActivity = Date.now();
  while (Date.now() < deadline) {
    const approve = page.getByTestId("relay-confirm-approve").first();
    if (await approve.isVisible()) {
      try {
        await approve.click({ timeout: APPROVE_CLICK_TIMEOUT_MS });
        lastActivity = Date.now();
        log("approved a confirmation card");
      } catch (error) {
        // The card re-rendered under the pointer; the next poll finds the fresh one.
        log(`approve click retried: ${(error as Error).name}`);
      }
    }
    if (await page.getByText(WORKING_LABEL).first().isVisible()) {
      lastActivity = Date.now();
    }
    if (Date.now() - lastActivity > QUIET_MS) return;
    await page.waitForTimeout(POLL_MS);
  }
  throw new Error("Relay did not finish within the recording budget");
}

async function sendTurn(page: Page, text: string): Promise<void> {
  await page.getByTestId("relay-composer").click();
  await page.keyboard.type(text, { delay: TYPE_DELAY_MS });
  await page.waitForTimeout(SETTLE_MS);
  await page.getByTestId("relay-send").click();
  log(`sent: ${text.slice(0, 40)}...`);
}

/** Waits for the turn, then answers Relay's step-limit notice with "continue". */
async function finishTurn(page: Page): Promise<void> {
  for (let attempt = 0; attempt <= MAX_CONTINUES; attempt++) {
    await approveUntilQuiet(page, Date.now() + MAX_RECORD_MS);
    if (!(await page.getByText(STEP_LIMIT_LABEL).last().isVisible())) return;
    await sendTurn(page, CONTINUE_MESSAGE);
  }
  throw new Error("Relay kept hitting its step limit");
}

async function main() {
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
  const outDir = process.env.RELAY_RECORD_DIR;
  if (!baseUrl)
    throw new Error(
      "Set PLAYWRIGHT_TEST_BASE_URL (the app is never started here).",
    );
  if (!outDir)
    throw new Error(
      "Set RELAY_RECORD_DIR to a scratch directory outside the repo.",
    );
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: VIEWPORT,
    recordVideo: { dir: outDir, size: VIEWPORT },
    colorScheme: "dark",
  });
  await context.addInitScript(
    ({ envId }) => {
      localStorage.setItem("theme", "dark");
      localStorage.setItem("requestly_active_env_id", envId);
    },
    { envId: ENV_ID },
  );
  const page = await context.newPage();
  // Only the demo environment: Relay itself must create the collection, requests and chain.
  await seedCaptureData(page, ["environments"]);
  const video = page.video();
  try {
    await page.goto(new URL("/app", new URL(baseUrl).origin).toString());
    await page.addStyleTag({ content: HIDE_DEV_OVERLAY_CSS });
    await page.getByTestId("relay-toggle").click();
    await page.getByTestId("relay-dock").waitFor();
    const skipTour = page.getByRole("button", { name: "Skip" });
    if (await skipTour.isVisible()) await skipTour.click();
    await page.waitForTimeout(SETTLE_MS);

    for (const prompt of PROMPTS) {
      await sendTurn(page, prompt);
      await finishTurn(page);
    }
    await page.waitForTimeout(SETTLE_MS);
  } finally {
    await context.close();
    await browser.close();
  }
  const recorded = await video?.path();
  if (!recorded) throw new Error("No video was recorded");
  const target = path.join(outDir, RAW_NAME);
  await rename(recorded, target);
  log(
    `raw recording: ${target} (${(await readdir(outDir)).length} files in dir)`,
  );
}

main().catch((error) => {
  console.error("relay recording failed:", error);
  process.exit(1);
});
