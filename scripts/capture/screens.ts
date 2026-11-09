// Captures real product screenshots (light and dark) of the running app with
// DummyJSON seed data. Never starts a server: it drives PLAYWRIGHT_TEST_BASE_URL.
// Usage: PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app \
//          bun scripts/capture/screens.ts [--only <name>[,<name>...]]
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Browser,
  type BrowserContext,
  chromium,
  expect,
  type Page,
} from "@playwright/test";
import sharp from "sharp";
import { CHAIN_ID, ENV_ID, seedCaptureData } from "./seed";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const OUTPUT_DIR = path.join(ROOT, "public/screens");
const VIEWPORT = { width: 1440, height: 900 };
const DEVICE_SCALE_FACTOR = 1;
const WEBP_QUALITY = 82;
const MAX_BYTES = 250 * 1024;
const SETTLE_MS = 600;
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const ACTIVE_ENV_KEY = "requestly_active_env_id";
const COLLECTION_NAME = "DummyJSON Shop";
const REQUEST_NAME = "List products";
const SHOT_TIMEOUT_MS = 20_000;
// The Next.js dev badge is not product UI.
const HIDE_DEV_OVERLAY_CSS = "nextjs-portal{display:none !important}";
const JSON_INDENT = 2;

const prettyJson = (value: unknown) => JSON.stringify(value, null, JSON_INDENT);

const PRODUCTS_JSON = prettyJson({
  products: [
    {
      id: 1,
      title: "Essence Mascara Lash Princess",
      category: "beauty",
      price: 9.99,
      rating: 4.94,
      stock: 5,
    },
    {
      id: 2,
      title: "Eyeshadow Palette with Mirror",
      category: "beauty",
      price: 19.99,
      rating: 3.28,
      stock: 44,
    },
    {
      id: 3,
      title: "Powder Canister",
      category: "beauty",
      price: 14.99,
      rating: 3.82,
      stock: 59,
    },
  ],
  total: 194,
  limit: 3,
});
const PRODUCTS_JSON_V2 = prettyJson({
  products: [
    {
      id: 1,
      title: "Essence Mascara Lash Princess",
      category: "beauty",
      price: 11.49,
      rating: 4.94,
      stock: 0,
    },
    {
      id: 2,
      title: "Eyeshadow Palette with Mirror",
      category: "beauty",
      price: 19.99,
      rating: 3.28,
      stock: 44,
    },
    {
      id: 3,
      title: "Powder Canister",
      category: "makeup",
      price: 14.99,
      rating: 3.82,
      stock: 59,
    },
  ],
  total: 194,
  limit: 3,
});
const JSON_PATH = "products[*].title";
const JSONPATH_ERROR = "JSONPath requires a JSON response";
const SEED_TITLE = "Powder Canister";
const CURL_COMMAND = `curl -X POST 'https://dummyjson.com/products/add' \\
  -H 'Content-Type: application/json' \\
  -d '{"title":"Desk lamp","price":24.5}'`;

type Shot = (page: Page, origin: string) => Promise<void>;

const settle = (page: Page) => page.waitForTimeout(SETTLE_MS);

const longestLine = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .reduce((a, b) => (b.length > a.length ? b : a));

/**
 * Replaces the content of the nth CodeMirror editor; insertText bypasses auto-closing brackets.
 * The editor can still be hydrating when first clicked, so the whole type-and-confirm step retries.
 */
async function fillEditor(page: Page, index: number, text: string) {
  const editor = page.locator(".cm-content").nth(index);
  await expect(async () => {
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText(text);
    await expect(editor).toContainText(longestLine(text), { timeout: 1500 });
  }).toPass();
}

/** Waits until the transform output pane shows the seed titles (not the JSON-required error). */
async function expectTransformOutput(page: Page) {
  await expect(page.locator("pre")).toContainText(SEED_TITLE);
  await expect(page.getByText(JSONPATH_ERROR)).toHaveCount(0);
}

async function openCollectionRequest(page: Page) {
  await page.getByText(COLLECTION_NAME, { exact: true }).click();
  await page.getByText(REQUEST_NAME, { exact: true }).click();
  await settle(page);
}

const SHOTS: Record<string, { path: string; run: Shot }> = {
  chains: {
    path: `/chain/${CHAIN_ID}`,
    run: async (page) => {
      await page
        .locator(".chain-canvas-react-flow[data-rf-ready='true']")
        .waitFor();
    },
  },
  transform: {
    path: "/transform",
    run: async (page) => {
      await fillEditor(page, 0, PRODUCTS_JSON);
      await fillEditor(page, 1, JSON_PATH);
      await expectTransformOutput(page);
    },
  },
  "json-compare": {
    path: "/json-compare",
    run: async (page) => {
      await fillEditor(page, 0, PRODUCTS_JSON);
      await fillEditor(page, 1, PRODUCTS_JSON_V2);
    },
  },
  "json-visualize": {
    path: "/json-visualize",
    run: async (page) => {
      await fillEditor(page, 0, PRODUCTS_JSON);
      await page.getByRole("button", { name: "Visualize" }).click();
    },
  },
  import: {
    path: "/import",
    run: async (page) => {
      await page.getByRole("tab", { name: "cURL Import" }).click();
      await page.locator("textarea").fill(CURL_COMMAND);
    },
  },
  "collections-envs": {
    path: "/app",
    run: openCollectionRequest,
  },
  "command-palette": {
    path: "/app",
    run: async (page) => {
      await openCollectionRequest(page);
      await page.keyboard.press("ControlOrMeta+k");
      await page.getByRole("dialog").waitFor();
    },
  },
  "relay-panel": {
    path: "/app",
    run: async (page) => {
      await openCollectionRequest(page);
      await page.getByTestId("relay-toggle").click();
      await page.getByTestId("relay-dock").waitFor();
      const skipTour = page.getByRole("button", { name: "Skip" });
      if (await skipTour.isVisible()) await skipTour.click();
      await page.getByTestId("relay-suggestion").first().waitFor();
    },
  },
};

/** Pins theme, active environment and a stable look before any app script runs. */
async function prepareContext(context: BrowserContext, theme: Theme) {
  await context.addInitScript(
    ({ themeName, envKey, envId }) => {
      localStorage.setItem("theme", themeName);
      localStorage.setItem(envKey, envId);
    },
    { themeName: theme, envKey: ACTIVE_ENV_KEY, envId: ENV_ID },
  );
}

async function writeWebp(png: Buffer, file: string) {
  const webp = await sharp(png).webp({ quality: WEBP_QUALITY }).toBuffer();
  if (webp.length > MAX_BYTES) {
    throw new Error(
      `${file} is ${webp.length} bytes, over the ${MAX_BYTES} budget`,
    );
  }
  await sharp(webp).toFile(file);
}

async function captureOne(
  browser: Browser,
  origin: string,
  name: string,
  theme: Theme,
) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    reducedMotion: "reduce",
    colorScheme: theme,
  });
  try {
    await prepareContext(context, theme);
    const page = await context.newPage();
    page.setDefaultTimeout(SHOT_TIMEOUT_MS);
    await seedCaptureData(page);
    const shot = SHOTS[name];
    await page.goto(new URL(shot.path, origin).toString());
    await shot.run(page, origin);
    await settle(page);
    const file = path.join(OUTPUT_DIR, `${name}-${theme}.webp`);
    await writeWebp(
      await page.screenshot({ style: HIDE_DEV_OVERLAY_CSS }),
      file,
    );
    console.log(`wrote ${path.relative(ROOT, file)}`);
  } finally {
    await context.close();
  }
}

function parseOnly(argv: string[]): string[] {
  const flag = argv.indexOf("--only");
  if (flag === -1) return Object.keys(SHOTS);
  const names = (argv[flag + 1] ?? "").split(",").filter(Boolean);
  const unknown = names.filter((name) => !(name in SHOTS));
  if (names.length === 0 || unknown.length > 0) {
    throw new Error(
      `--only needs names from: ${Object.keys(SHOTS).join(", ")} (got: ${unknown.join(", ") || "nothing"})`,
    );
  }
  return names;
}

async function main() {
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
  if (!baseUrl)
    throw new Error(
      "Set PLAYWRIGHT_TEST_BASE_URL (the app is never started here).",
    );
  // Marketing and app routes are served from the origin root, so paths resolve against it.
  const origin = new URL(baseUrl).origin;
  const names = parseOnly(process.argv.slice(2));
  await mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const name of names) {
      for (const theme of THEMES)
        await captureOne(browser, origin, name, theme);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("screenshot capture failed:", error);
  process.exit(1);
});
