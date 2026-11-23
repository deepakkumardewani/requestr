// Records the demo video's scene clips from the REAL app on the seeded DummyJSON data.
// Every network call is mocked (request proxy, share API, scripted Relay stream), so the
// run is deterministic and offline. It targets the running dev server and never starts one.
// Output: <out>/clips/<scene>.webm plus <out>/manifest.json (scene timings for Remotion).
// Usage: PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bun run demo-record
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Browser,
  type BrowserContext,
  chromium,
  expect,
  type Page,
} from "@playwright/test";
import { installRelayRoutes } from "../../e2e/fixtures/relayRoutes";
import {
  CHAIN_ID,
  HIDE_DEV_OVERLAY_CSS,
  seedCaptureData,
  seedData,
  suppressFirstRunPrompts,
} from "./seed";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const OUT_DIR = path.join(ROOT, "scripts/capture/demo/out");
const CLIPS_DIR = path.join(OUT_DIR, "clips");
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");

const VIEWPORT = { width: 1920, height: 1080 };
const TYPE_DELAY_MS = 55;
const SETTLE_MS = 900;
// Long enough to read the result; short holds make the finished video feel rushed.
const INTRO_HOLD_MS = 2500;
const PAYOFF_HOLD_MS = 9000;
const ACTION_TIMEOUT_MS = 20_000;
const PLAYBACK_RATE_FAST = 3;
const PLAYBACK_RATE_NORMAL = 1;
const COLLECTION_NAME = "DummyJSON Shop";
const REQUEST_NAME = "List products";
const SEED_REQUEST_COUNT = seedData.requests.length;
const SHARE_ID = "k3Xp9aQz";
const SHARE_PATH = "/api/share";
const PROXY_PATH = "/api/proxy";
const INGEST_PATH = "/api/ingest";
const STT_STATUS_PATH = "/api/relay/stt/status";
const JSON_INDENT = 2;
const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
// A prompt-sized overlay that must never reach a clip.
const OVERLAY_TEST_IDS = [
  "tour-popover",
  "analytics-notice",
  "whats-new-modal",
  "backup-nudge",
  "feedback-dialog",
] as const;

const log = (message: string) => console.log(`[demo-record] ${message}`);
const pretty = (value: unknown) => JSON.stringify(value, null, JSON_INDENT);

type Rate = typeof PLAYBACK_RATE_FAST | typeof PLAYBACK_RATE_NORMAL;
type Ramp = { fromMs: number; toMs: number; rate: Rate };
type Focus = { x: number; y: number; zoom: number };

/** Where Remotion zooms to: a normalised centre point and a scale for the scene's payoff. */
type SceneDefinition = {
  id: string;
  title: string;
  caption: string;
  focus: Focus;
  run: (page: Page, timeline: Timeline) => Promise<void>;
};

type SceneManifest = Omit<SceneDefinition, "run"> & {
  clip: string;
  trimMs: number;
  durationMs: number;
  ramps: Ramp[];
};

/** Splits a clip into fast (typing, waiting) and normal (payoff) stretches. */
class Timeline {
  private readonly startedAt = Date.now();
  private readonly ramps: Ramp[] = [];
  private trimMs = 0;

  /** Everything before this is page load, which the finished video skips. */
  markStart(): void {
    this.trimMs = this.elapsedMs();
  }

  getTrimMs(): number {
    return this.trimMs;
  }

  async phase(rate: Rate, work: () => Promise<void>): Promise<void> {
    const fromMs = Date.now() - this.startedAt;
    await work();
    this.ramps.push({ fromMs, toMs: Date.now() - this.startedAt, rate });
  }

  elapsedMs(): number {
    return Date.now() - this.startedAt;
  }

  getRamps(): Ramp[] {
    return this.ramps;
  }
}

const PRODUCTS_BODY = {
  products: [
    { id: 1, title: "Essence Mascara Lash Princess", price: 9.99, stock: 5 },
    { id: 2, title: "Eyeshadow Palette with Mirror", price: 19.99, stock: 44 },
    { id: 3, title: "Powder Canister", price: 14.99, stock: 59 },
  ],
  total: 194,
  skip: 0,
  limit: 3,
};

/** Canned DummyJSON replies keyed by the downstream path the app proxies. */
const PROXY_REPLIES: Record<string, unknown> = {
  "/user/login": {
    id: 1,
    username: "emilys",
    accessToken: "demo-access-token",
    refreshToken: "demo-refresh-token",
  },
  "/user/me": {
    id: 1,
    username: "emilys",
    email: "emily.johnson@x.dummyjson.com",
  },
  "/carts/user/1": {
    carts: [{ id: 19, total: 4794.8, totalProducts: 4, totalQuantity: 14 }],
    total: 1,
  },
  "/products/add": { id: 195, title: "Desk lamp", price: 24.5 },
  "/products": PRODUCTS_BODY,
};

/** Every request that left the mocked set; the run fails if any exist. */
const unmockedRequests: string[] = [];

function proxyEnvelope(payload: unknown): string {
  return JSON.stringify({
    status: HTTP_OK,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    body: pretty(payload),
  });
}

async function mockProxy(page: Page): Promise<void> {
  await page.route(`**${PROXY_PATH}`, async (route) => {
    const { url = "" } = JSON.parse(route.request().postData() ?? "{}") as {
      url?: string;
    };
    const reply = PROXY_REPLIES[new URL(url).pathname];
    if (!reply) {
      unmockedRequests.push(`proxy ${url}`);
      return route.abort("failed");
    }
    return route.fulfill({
      status: HTTP_OK,
      contentType: "application/json",
      body: proxyEnvelope(reply),
    });
  });
}

/** Anything not answered by a scene's own mock is refused and recorded. */
async function blockUnmocked(context: BrowserContext, origin: string) {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      unmockedRequests.push(`external ${url.href}`);
      return route.abort("failed");
    }
    if (url.pathname === INGEST_PATH) {
      return route.fulfill({ status: HTTP_NO_CONTENT });
    }
    if (url.pathname === STT_STATUS_PATH) {
      return route.fulfill({ json: { configured: false } });
    }
    if (url.pathname.startsWith("/api/")) {
      unmockedRequests.push(`api ${url.pathname}`);
      return route.abort("failed");
    }
    return route.continue();
  });
}

async function expectNoOverlay(page: Page, scene: string): Promise<void> {
  for (const testId of OVERLAY_TEST_IDS) {
    const count = await page.getByTestId(testId).count();
    if (count > 0) throw new Error(`${scene}: overlay "${testId}" is showing`);
  }
}

async function openListProducts(page: Page): Promise<void> {
  await page.getByText(COLLECTION_NAME, { exact: true }).click();
  await page.getByText(REQUEST_NAME, { exact: true }).click();
  await expect(page.getByTestId("url-input")).toBeVisible();
}

async function sendRequestScene(page: Page, timeline: Timeline) {
  await timeline.phase(PLAYBACK_RATE_FAST, async () => {
    await openListProducts(page);
    await page.waitForTimeout(SETTLE_MS);
  });
  await timeline.phase(PLAYBACK_RATE_NORMAL, async () => {
    await page.waitForTimeout(INTRO_HOLD_MS);
    await page.getByTestId("send-request-btn").click();
    await expect(page.getByTestId("response-status-badge")).toBeVisible();
    await page.waitForTimeout(PAYOFF_HOLD_MS);
  });
}

async function chainRunScene(page: Page, timeline: Timeline) {
  await timeline.phase(PLAYBACK_RATE_FAST, async () => {
    await page
      .locator(".chain-canvas-react-flow[data-rf-ready='true']")
      .waitFor();
    await page.waitForTimeout(SETTLE_MS);
  });
  await timeline.phase(PLAYBACK_RATE_NORMAL, async () => {
    await page.waitForTimeout(INTRO_HOLD_MS);
    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible();
    await page.waitForTimeout(PAYOFF_HOLD_MS);
  });
}

const RELAY_PROMPT =
  "Add a request to the DummyJSON Shop collection that gets one product by id.";
const RELAY_REPLY = "Done. I added a Get product request to DummyJSON Shop.";

async function relayScene(page: Page, timeline: Timeline) {
  await installRelayRoutes(page, [
    {
      kind: "clientTools",
      calls: [
        {
          toolName: "create_request",
          input: {
            collectionId: "capture-collection",
            folderId: null,
            name: "Get product",
            method: "GET",
            url: "{{baseUrl}}/products/1",
            headers: null,
            params: null,
            body: null,
            auth: null,
          },
        },
      ],
    },
    { kind: "text", text: RELAY_REPLY },
  ]);
  await timeline.phase(PLAYBACK_RATE_FAST, async () => {
    await page.getByTestId("relay-toggle").click();
    await page.getByTestId("relay-dock").waitFor();
    await page.getByTestId("relay-composer").click();
    await page.keyboard.type(RELAY_PROMPT, { delay: TYPE_DELAY_MS });
    await page.waitForTimeout(SETTLE_MS);
  });
  await timeline.phase(PLAYBACK_RATE_NORMAL, async () => {
    await page.waitForTimeout(INTRO_HOLD_MS);
    await page.getByTestId("relay-send").click();
    await expect(page.getByText(RELAY_REPLY)).toBeVisible();
    // The new request lands in the sidebar: the seed's six plus Relay's one.
    await expect(
      page.getByRole("heading", {
        name: `${COLLECTION_NAME} ${SEED_REQUEST_COUNT + 1}`,
      }),
    ).toBeVisible();
    await page
      .getByTestId("relay-worked-group")
      .getByRole("button", { expanded: false })
      .first()
      .click();
    await page.waitForTimeout(PAYOFF_HOLD_MS);
  });
}

async function shareScene(page: Page, timeline: Timeline) {
  await page.route(`**${SHARE_PATH}`, (route) =>
    route.fulfill({
      status: HTTP_OK,
      contentType: "application/json",
      body: JSON.stringify({ id: SHARE_ID }),
    }),
  );
  await timeline.phase(PLAYBACK_RATE_FAST, async () => {
    await openListProducts(page);
    await page.waitForTimeout(SETTLE_MS);
  });
  await timeline.phase(PLAYBACK_RATE_NORMAL, async () => {
    await page.waitForTimeout(INTRO_HOLD_MS);
    await page.locator("button:has(svg.lucide-link)").first().click();
    await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue(
      new RegExp(`/\\?s=${SHARE_ID}#.+`),
    );
    await page.waitForTimeout(PAYOFF_HOLD_MS);
  });
}

const SCENES: (SceneDefinition & { path: string })[] = [
  {
    id: "send-request",
    path: "/app",
    title: "Send a request",
    caption: "Pick a saved request, hit send, read the response.",
    focus: { x: 0.8, y: 0.6, zoom: 1.2 },
    run: sendRequestScene,
  },
  {
    id: "chain-run",
    path: `/chain/${CHAIN_ID}`,
    title: "Run a chain",
    caption: "Chain requests together and pass values between them.",
    focus: { x: 0.5, y: 0.5, zoom: 1.15 },
    run: chainRunScene,
  },
  {
    id: "relay-build",
    path: "/app",
    title: "Let Relay build it",
    caption: "Ask the assistant and it creates the request for you.",
    focus: { x: 1, y: 0.35, zoom: 1.3 },
    run: relayScene,
  },
  {
    id: "encrypted-share",
    path: "/app",
    title: "Share, encrypted",
    caption: "The key stays in the link. The server never sees it.",
    focus: { x: 0.5, y: 0.5, zoom: 1.3 },
    run: shareScene,
  },
];

async function recordScene(
  browser: Browser,
  origin: string,
  scene: (typeof SCENES)[number],
): Promise<SceneManifest> {
  const rawDir = path.join(OUT_DIR, `raw-${scene.id}`);
  await rm(rawDir, { recursive: true, force: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: VIEWPORT,
    recordVideo: { dir: rawDir, size: VIEWPORT },
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  await suppressFirstRunPrompts(context);
  await blockUnmocked(context, origin);
  const timeline = new Timeline();
  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  await mockProxy(page);
  await seedCaptureData(page);
  const video = page.video();
  try {
    await page.goto(new URL(scene.path, origin).toString());
    await page.addStyleTag({ content: HIDE_DEV_OVERLAY_CSS });
    timeline.markStart();
    await scene.run(page, timeline);
    await expectNoOverlay(page, scene.id);
  } finally {
    await context.close();
  }
  const clip = `${scene.id}.webm`;
  const recorded = await video?.path();
  if (!recorded) throw new Error(`${scene.id}: no video was recorded`);
  await rename(recorded, path.join(CLIPS_DIR, clip));
  await rm(rawDir, { recursive: true, force: true });
  const { run: _run, path: _path, ...rest } = scene;
  return {
    ...rest,
    clip,
    trimMs: timeline.getTrimMs(),
    durationMs: timeline.elapsedMs(),
    ramps: timeline.getRamps(),
  };
}

async function main() {
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
  if (!baseUrl)
    throw new Error(
      "Set PLAYWRIGHT_TEST_BASE_URL (the app is never started here).",
    );
  const origin = new URL(baseUrl).origin;
  await rm(CLIPS_DIR, { recursive: true, force: true });
  await mkdir(CLIPS_DIR, { recursive: true });
  const browser = await chromium.launch();
  const scenes: SceneManifest[] = [];
  try {
    for (const scene of SCENES) {
      scenes.push(await recordScene(browser, origin, scene));
      log(`recorded ${scene.id}`);
    }
  } finally {
    await browser.close();
  }
  if (unmockedRequests.length > 0) {
    throw new Error(`Unmocked network calls:\n${unmockedRequests.join("\n")}`);
  }
  await writeFile(MANIFEST_PATH, pretty({ viewport: VIEWPORT, scenes }));
  log(`wrote ${(await readdir(CLIPS_DIR)).length} clips and the manifest`);
}

main().catch((error) => {
  console.error("demo recording failed:", error);
  process.exit(1);
});
