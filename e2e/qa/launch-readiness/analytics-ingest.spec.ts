import type { Page, Request } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const INGEST_GLOB = "**/api/ingest";
const FLUSH_WAIT_MS = 15_000;
/** Longer than the adapter's 5s flush interval, so a silent adapter is really silent. */
const QUIET_WINDOW_MS = 7_000;
const POSTHOG_HOST = /(^|\.)(posthog\.com|i\.posthog\.com)$/;

const BATCH_KEYS = ["events", "id"];
const EVENT_KEYS = ["name", "props", "ts"];
const COMMON_KEYS = [
  "app_version",
  "locale",
  "session_day_index",
  "theme",
  "viewport_class",
];
const APP_OPENED_KEYS = ["days_since_last_bucket", "is_first_session"];
const DAYS_SINCE_LAST = ["0", "1", "2-6", "7-29", "30+"];
const SESSION_DAYS = ["1", "2", "3-6", "7+"];
const URL_OR_IP = /https?:\/\/|\/\/[\w.-]+\.\w+|\b\d{1,3}(\.\d{1,3}){3}\b/i;

type Wire = {
  id?: string;
  events: { name: string; props: Record<string, unknown>; ts: number }[];
};

/** Stubs the ingest route so nothing leaves the machine and records each hit. */
async function stubIngest(page: Page): Promise<Request[]> {
  const hits: Request[] = [];
  await page.route(INGEST_GLOB, (route) => {
    hits.push(route.request());
    return route.fulfill({ status: 204 });
  });
  return hits;
}

async function enableOverride(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__RQ_ANALYTICS_E2E__ = true;
  });
}

test.describe("Analytics ingest @qa", () => {
  test("@critical with the e2e override, app_opened posts to /api/ingest with the allowlist payload and no URL or IP", async ({
    page,
    snap,
  }) => {
    await stubIngest(page);
    await enableOverride(page);

    const requestPromise = page.waitForRequest(
      (req) => new URL(req.url()).pathname === "/api/ingest",
      { timeout: FLUSH_WAIT_MS },
    );
    await page.goto("/app");
    const request = await requestPromise;

    expect(request.method()).toBe("POST");
    const raw = request.postData() ?? "";
    const body = JSON.parse(raw) as Wire;

    expect(Object.keys(body).sort()).toEqual(BATCH_KEYS);
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);

    const opened = body.events.find((e) => e.name === "app_opened");
    expect(opened, "app_opened event in batch").toBeDefined();
    if (!opened) return;
    expect(Object.keys(opened).sort()).toEqual(EVENT_KEYS);
    expect(typeof opened.ts).toBe("number");
    expect(Object.keys(opened.props).sort()).toEqual(
      [...COMMON_KEYS, ...APP_OPENED_KEYS].sort(),
    );
    expect(typeof opened.props.is_first_session).toBe("boolean");
    expect(DAYS_SINCE_LAST).toContain(opened.props.days_since_last_bucket);
    expect(SESSION_DAYS).toContain(opened.props.session_day_index);
    expect(["desktop", "tablet", "mobile"]).toContain(
      opened.props.viewport_class,
    );
    expect(["light", "dark"]).toContain(opened.props.theme);

    // No URL or IP anywhere in the serialised payload, including headers-free body.
    expect(raw).not.toMatch(URL_OR_IP);
    expect(Object.keys(opened.props)).not.toContain("url");
    expect(Object.keys(opened.props)).not.toContain("ip");

    await snap("01-ingest-payload");
  });

  test("@critical without the override, /app makes zero requests to /api/ingest", async ({
    page,
    snap,
  }) => {
    const hits = await stubIngest(page);

    await page.goto("/app");
    await expect(page.locator("main, [data-testid]").first()).toBeVisible();
    const overrideSet = await page.evaluate(
      () => window.__RQ_ANALYTICS_E2E__ === true,
    );
    expect(overrideSet).toBe(false);

    // Outlast the flush interval and force the unload flush path as well.
    await page.evaluate(async (ms) => {
      window.dispatchEvent(new Event("pagehide"));
      await new Promise((resolve) => setTimeout(resolve, ms));
    }, QUIET_WINDOW_MS);

    expect(hits).toHaveLength(0);
    await snap("01-no-ingest-without-override");
  });

  test("@high with the override, the browser makes no request to a PostHog host and sets no cookie", async ({
    page,
    context,
    snap,
  }) => {
    await stubIngest(page);
    await enableOverride(page);

    const posthogHits: string[] = [];
    page.on("request", (req) => {
      if (POSTHOG_HOST.test(new URL(req.url()).hostname)) {
        posthogHits.push(req.url());
      }
    });

    // Proves the adapter is live, so the absence below is not vacuous.
    const ingest = page.waitForRequest(
      (req) => new URL(req.url()).pathname === "/api/ingest",
      { timeout: FLUSH_WAIT_MS },
    );
    await page.goto("/app");
    await ingest;

    expect(posthogHits).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    expect(
      await page.evaluate(() => document.cookie),
      "document.cookie",
    ).toBe("");

    await snap("01-no-posthog-no-cookie");
  });
});
