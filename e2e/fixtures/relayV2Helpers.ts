/**
 * Relay v2 e2e helpers: backup download capture, two-context round trips,
 * IndexedDB dumps, computed-colour assertions and the Grok STT mock.
 * Web-first and timer-free, like the rest of e2e/fixtures.
 */
import fs from "node:fs";
import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { IDB_DB_NAME, IDB_STORE_NAMES } from "../../src/lib/idbSchema";
import { seedQaData } from "./qaSeed";
import { FAKE_AUDIO_LAUNCH_ARGS } from "./speechStub";

export { FAKE_AUDIO_LAUNCH_ARGS as fakeAudioLaunchArgs };

const STT_PATH = "/api/relay/stt";
const STT_STATUS_PATH = "/api/relay/stt/status";
const DEFAULT_STT_TEXT = "hello from the microphone";
const DEFAULT_STT_LANGUAGE = "en";
const DEFAULT_STT_DURATION_S = 1;
const HTTP_OK = 200;
const PRIMARY_TOKEN = "var(--primary)";
const RGB_CHANNELS = 3;
/** WCAG relative-luminance constants. */
const SRGB_LINEAR_THRESHOLD = 0.03928;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_DIVISOR = 1.055;
const SRGB_GAMMA = 2.4;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const CHANNEL_MAX = 255;
const CONTRAST_OFFSET = 0.05;

// ---------------------------------------------------------------------------
// Backup export: download capture
// ---------------------------------------------------------------------------

export type CapturedDownload = {
  filename: string;
  text: string;
  /** The file parsed as JSON; throws when the download is not JSON. */
  json: <T = unknown>() => T;
};

/** Runs `trigger` (the click that starts an export) and returns the downloaded file's content. */
export async function downloadCapture(
  page: Page,
  trigger: () => Promise<void>,
): Promise<CapturedDownload> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    trigger(),
  ]);
  const filePath = await download.path();
  const text = fs.readFileSync(filePath, "utf8");
  return {
    filename: download.suggestedFilename(),
    text,
    json: <T>() => JSON.parse(text) as T,
  };
}

// ---------------------------------------------------------------------------
// Two browser contexts (BAK-06 round trip)
// ---------------------------------------------------------------------------

export type TwoContexts = {
  /** Seeded with the QA fixtures: the export source. */
  source: Page;
  /** A fresh profile with an empty IDB: the import target. */
  target: Page;
  close: () => Promise<void>;
};

async function newIsolatedContext(browser: Browser): Promise<BrowserContext> {
  const { baseURL, ignoreHTTPSErrors, acceptDownloads } =
    test.info().project.use;
  return browser.newContext({
    baseURL,
    ignoreHTTPSErrors: ignoreHTTPSErrors ?? true,
    acceptDownloads: acceptDownloads ?? true,
  });
}

/** Two independent contexts: the first seeded with QA data, the second empty. */
export async function twoContexts(browser: Browser): Promise<TwoContexts> {
  const [sourceContext, targetContext] = await Promise.all([
    newIsolatedContext(browser),
    newIsolatedContext(browser),
  ]);
  const [source, target] = await Promise.all([
    sourceContext.newPage(),
    targetContext.newPage(),
  ]);
  await seedQaData(source);
  return {
    source,
    target,
    close: async () => {
      await Promise.all([sourceContext.close(), targetContext.close()]);
    },
  };
}

// ---------------------------------------------------------------------------
// IndexedDB dumps
// ---------------------------------------------------------------------------

export type IdbDump = Record<string, unknown[]>;

/** Every row of one object store, in key order. */
export async function dumpIdbStore(
  page: Page,
  store: string,
): Promise<unknown[]> {
  return page.evaluate(
    ({ dbName, storeName }) =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            resolve([]);
            return;
          }
          const request = db
            .transaction(storeName)
            .objectStore(storeName)
            .getAll();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => reject(request.error);
        };
      }),
    { dbName: IDB_DB_NAME, storeName: store },
  );
}

/** Dumps the given stores (default: every store in the schema), keyed by store name. */
export async function dumpIdb(
  page: Page,
  stores: readonly string[] = IDB_STORE_NAMES,
): Promise<IdbDump> {
  const rows = await Promise.all(
    stores.map((store) => dumpIdbStore(page, store)),
  );
  return Object.fromEntries(stores.map((store, i) => [store, rows[i]]));
}

// ---------------------------------------------------------------------------
// Computed colour and contrast
// ---------------------------------------------------------------------------

export type Rgb = [number, number, number];

/** Parses a computed `rgb()`/`rgba()` string; throws on anything else (e.g. `oklch()`). */
export function parseRgb(value: string): Rgb {
  const channels = value
    .match(/[\d.]+/g)
    ?.slice(0, RGB_CHANNELS)
    .map(Number);
  if (!value.startsWith("rgb") || channels?.length !== RGB_CHANNELS) {
    throw new Error(`[relayV2Helpers] not an rgb colour: ${value}`);
  }
  return channels as Rgb;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / CHANNEL_MAX;
    return c <= SRGB_LINEAR_THRESHOLD
      ? c / SRGB_LINEAR_DIVISOR
      : ((c + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_DIVISOR) ** SRGB_GAMMA;
  });
  const [wr, wg, wb] = LUMINANCE_WEIGHTS;
  return wr * lr + wg * lg + wb * lb;
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const [light, dark] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (light + CONTRAST_OFFSET) / (dark + CONTRAST_OFFSET);
}

/**
 * Chromium keeps the authored colour space in computed styles (`lab()`,
 * `oklch()` for a themed `var(--primary)`), so every colour is rasterised on a
 * 1x1 canvas to get a comparable `rgb()`/`rgba()` string.
 */
async function toRgbString(scope: Locator, cssColor: string): Promise<string> {
  return scope.evaluate((_el, color) => {
    const ctx = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    });
    if (!ctx) throw new Error("[relayV2Helpers] no 2d canvas context");
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a === 255
      ? `rgb(${r}, ${g}, ${b})`
      : `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  }, cssColor);
}

/** The element's computed value of a colour property (`color`, `background-color`), as `rgb()`. */
export async function computedColor(
  locator: Locator,
  property: string,
): Promise<string> {
  const raw = await locator.evaluate(
    (el, prop) => getComputedStyle(el).getPropertyValue(prop),
    property,
  );
  return toRgbString(locator, raw);
}

/**
 * Resolves any CSS colour (a hex, a `var(--token)`) to `rgb()` by painting it
 * on a throwaway probe inside `scope`, so theme variables resolve exactly as
 * they do for the element under test.
 */
export async function resolveCssColor(
  scope: Locator,
  cssColor: string,
): Promise<string> {
  const raw = await scope.evaluate((el, color) => {
    const probe = document.createElement("span");
    probe.style.color = color;
    el.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, cssColor);
  return toRgbString(scope, raw);
}

/** Asserts a computed colour property equals `cssColor` (default: the `--primary` token). */
export async function expectComputedColor(
  locator: Locator,
  property: string,
  cssColor: string = PRIMARY_TOKEN,
): Promise<void> {
  const expected = await resolveCssColor(locator, cssColor);
  await expect.poll(() => computedColor(locator, property)).toBe(expected);
}

/** The WCAG contrast of an element's text against its own background. */
export async function textContrast(locator: Locator): Promise<number> {
  const [fg, bg] = await Promise.all([
    computedColor(locator, "color"),
    computedColor(locator, "background-color"),
  ]);
  return contrastRatio(parseRgb(fg), parseRgb(bg));
}

// ---------------------------------------------------------------------------
// Grok STT mock
// ---------------------------------------------------------------------------

export type SttReply =
  | { kind: "ok"; text?: string; language?: string; duration?: number }
  | { kind: "error"; status: number; retryAfterSeconds?: number };

const DEFAULT_STT_REPLY: SttReply = { kind: "ok" };

export type SttMockHandle = {
  /** Content types of every transcription upload, in order (should be `multipart/form-data`). */
  readonly uploads: { contentType: string; bytes: number }[];
};

/**
 * Mocks the Grok transcription endpoints so no audio or key leaves the test:
 * `GET /api/relay/stt/status` reports `configured`, and `POST /api/relay/stt`
 * answers the next reply (the last repeats). Pair with `fakeAudioLaunchArgs`
 * for the capture side, or with `speechStub.ts` for the browser engine.
 */
export async function installSttMock(
  page: Page,
  options: { configured?: boolean; replies?: SttReply[] } = {},
): Promise<SttMockHandle> {
  const { configured = true, replies = [DEFAULT_STT_REPLY] } = options;
  const uploads: SttMockHandle["uploads"] = [];

  await page.route(`**${STT_STATUS_PATH}`, (route) =>
    route.fulfill({
      status: HTTP_OK,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ configured }),
    }),
  );

  await page.route(`**${STT_PATH}`, (route) => {
    const request = route.request();
    uploads.push({
      contentType: request.headers()["content-type"] ?? "",
      bytes: request.postDataBuffer()?.byteLength ?? 0,
    });
    const reply =
      replies[Math.min(uploads.length - 1, replies.length - 1)] ??
      DEFAULT_STT_REPLY;
    if (reply.kind === "error") {
      return route.fulfill({
        status: reply.status,
        contentType: "application/json",
        headers:
          reply.retryAfterSeconds === undefined
            ? {}
            : { "retry-after": String(reply.retryAfterSeconds) },
        body: JSON.stringify({ error: "stt_error" }),
      });
    }
    return route.fulfill({
      status: HTTP_OK,
      contentType: "application/json",
      body: JSON.stringify({
        text: reply.text ?? DEFAULT_STT_TEXT,
        language: reply.language ?? DEFAULT_STT_LANGUAGE,
        duration: reply.duration ?? DEFAULT_STT_DURATION_S,
      }),
    });
  });

  return { uploads };
}
