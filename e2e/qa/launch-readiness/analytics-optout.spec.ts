import type { Page, Request } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const INGEST_GLOB = "**/api/ingest";
const FLUSH_WAIT_MS = 15_000;
/** Longer than the adapter's 5s flush interval, so a silent adapter is really silent. */
const QUIET_WINDOW_MS = 7_000;
const ANALYTICS_ID_KEY = "rq_analytics_id";
const ANALYTICS_LABEL = "Share anonymous usage data";
const SECRET_HOST = "secret-host.example.com";
const URL_IN_MESSAGE = /https?:\/\/|secret-host|token=/i;

type WireEvent = { name: string; props: Record<string, unknown> };
type Wire = { events: WireEvent[] };

type Ingest = { hits: Request[]; events: () => WireEvent[] };

/** Stubs the ingest route so nothing leaves the machine and records each hit. */
async function stubIngest(page: Page): Promise<Ingest> {
  const hits: Request[] = [];
  await page.route(INGEST_GLOB, (route) => {
    hits.push(route.request());
    return route.fulfill({ status: 204 });
  });
  const events = (): WireEvent[] =>
    hits.flatMap((hit) => (JSON.parse(hit.postData() ?? "{}") as Wire).events);
  return { hits, events };
}

async function enableOverride(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__RQ_ANALYTICS_E2E__ = true;
  });
}

async function sendDoNotTrack(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "doNotTrack", { get: () => "1" });
  });
}

async function sendGpc(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      get: () => true,
    });
  });
}

/** Outlasts the flush interval and forces the unload flush path. */
async function outlastFlush(page: Page): Promise<void> {
  await page.evaluate(async (ms) => {
    window.dispatchEvent(new Event("pagehide"));
    await new Promise((resolve) => setTimeout(resolve, ms));
  }, QUIET_WINDOW_MS);
}

/**
 * Raises an error through the same window listener an uncaught error reaches.
 * A real throw would also trip the suite's page-error guard, which must stay on.
 */
async function raiseWindowError(page: Page): Promise<void> {
  await page.evaluate((host) => {
    const error = new Error(`Failed to load https://${host}/v1?token=abc123`);
    window.dispatchEvent(
      new ErrorEvent("error", { error, message: error.message }),
    );
  }, SECRET_HOST);
}

async function raiseRejection(page: Page): Promise<void> {
  await page.evaluate((host) => {
    const reason = new Error(`Rejected call to https://${host}/v1`);
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        // Settled, so the browser itself reports no real rejection.
        promise: Promise.resolve(),
        reason,
      }),
    );
  }, SECRET_HOST);
}

/** Settings opens on Appearance by default; the toggle lives under General. */
async function openGeneralSection(page: Page): Promise<void> {
  await page.getByTestId("nav-general").click();
}

async function waitForAppReady(page: Page): Promise<void> {
  await page.goto("/app");
  await expect(page.locator("main, [data-testid]").first()).toBeVisible();
}

const exceptionsOf = (ingest: Ingest): WireEvent[] =>
  ingest.events().filter((e) => e.name === "$exception");

test.describe("Analytics opt-out @qa", () => {
  test("@critical with the override enabled and DNT=1, no /api/ingest request is made", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);
    await sendDoNotTrack(page);

    await waitForAppReady(page);
    expect(await page.evaluate(() => navigator.doNotTrack)).toBe("1");
    expect(
      await page.evaluate(() => window.__RQ_ANALYTICS_E2E__ === true),
    ).toBe(true);
    await outlastFlush(page);

    expect(ingest.hits).toHaveLength(0);
    await snap("01-dnt-no-ingest");
  });

  test("@critical with the override enabled and GPC=1, no /api/ingest request is made", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);
    await sendGpc(page);

    await waitForAppReady(page);
    expect(
      await page.evaluate(
        () =>
          (navigator as Navigator & { globalPrivacyControl?: boolean })
            .globalPrivacyControl,
      ),
    ).toBe(true);
    await outlastFlush(page);

    expect(ingest.hits).toHaveLength(0);
    await snap("01-gpc-no-ingest");
  });

  test("@critical with the override enabled, toggling Share anonymous usage data off in Settings stops requests in the same session and rq_analytics_id is removed", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);

    // app_opened only fires on /app; it proves the adapter is live and mints the id.
    const firstBatch = page.waitForRequest(
      (req) => new URL(req.url()).pathname === "/api/ingest",
      { timeout: FLUSH_WAIT_MS },
    );
    await page.goto("/app");
    await firstBatch;
    // The toggle must act on this page load, with no reload after it.
    await page.goto("/settings");
    await openGeneralSection(page);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_ID_KEY),
      "analytics id minted while sending",
    ).toBeTruthy();

    const toggle = page.getByRole("switch", { name: ANALYTICS_LABEL });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), ANALYTICS_ID_KEY),
      )
      .toBeNull();

    const hitsAtOptOut = ingest.hits.length;
    await raiseWindowError(page);
    await outlastFlush(page);

    expect(ingest.hits).toHaveLength(hitsAtOptOut);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_ID_KEY),
    ).toBeNull();
    await snap("01-toggle-off-stops-requests");
  });

  test("@high the toggle shows disabled with an explanation under DNT", async ({
    page,
    snap,
  }) => {
    await stubIngest(page);
    await enableOverride(page);
    await sendDoNotTrack(page);

    await page.goto("/settings");
    await openGeneralSection(page);
    const toggle = page.getByRole("switch", { name: ANALYTICS_LABEL });
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeDisabled();
    await expect(toggle).not.toBeChecked();
    await expect(page.getByTestId("analytics-consent-note")).toHaveText(
      "Off because your browser sends Do Not Track.",
    );
    await snap("01-toggle-disabled-under-dnt");
  });

  test("@high with the override, an uncaught page error produces exactly one $exception batch entry with no URL in the message", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);

    await waitForAppReady(page);
    await raiseWindowError(page);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

    await expect.poll(() => exceptionsOf(ingest).length).toBeGreaterThan(0);
    // Let any duplicate flush land before counting.
    await outlastFlush(page);

    const exceptions = exceptionsOf(ingest);
    expect(exceptions).toHaveLength(1);
    const props = exceptions[0].props;
    expect(props.source).toBe("window");
    expect(typeof props.message).toBe("string");
    expect(props.message as string).not.toMatch(URL_IN_MESSAGE);
    expect(JSON.stringify(props)).not.toContain(SECRET_HOST);
    await snap("01-window-error-one-exception");
  });

  test("@high with the override, an unhandled promise rejection produces exactly one $exception entry", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);

    await waitForAppReady(page);
    await raiseRejection(page);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

    await expect.poll(() => exceptionsOf(ingest).length).toBeGreaterThan(0);
    await outlastFlush(page);

    const exceptions = exceptionsOf(ingest);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].props.source).toBe("promise");
    expect(JSON.stringify(exceptions[0].props)).not.toContain(SECRET_HOST);
    await snap("01-rejection-one-exception");
  });

  test("@high with the override and the toggle off, an uncaught page error produces no /api/ingest request", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);
    // The persisted opt-out, as the Settings toggle writes it.
    await page.addInitScript(() => {
      localStorage.setItem("rq_analytics_enabled", "false");
    });

    await waitForAppReady(page);
    expect(
      await page.evaluate(() => localStorage.getItem("rq_analytics_enabled")),
    ).toBe("false");
    await raiseWindowError(page);
    await outlastFlush(page);

    expect(ingest.hits).toHaveLength(0);
    await snap("01-toggle-off-error-silent");
  });
});
