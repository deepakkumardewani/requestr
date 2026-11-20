import type { Page, Request } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openTab } from "../../fixtures/qaHelpers";

const INGEST_GLOB = "**/api/ingest";
const PROXY_GLOB = "**/api/proxy";
const FLUSH_WAIT_MS = 15_000;
/** Longer than the adapter's 5s flush interval, so a silent adapter is really silent. */
const QUIET_WINDOW_MS = 7_000;
const SECRET_HOST = "secret-host.example.com";
const SECRET_TOKEN = "tok-9f8e7d6c";
const SECRET_HEADER_NAME = "X-Secret-Header";
const SECRET_HEADER_VALUE = "hdr-value-5a4b3c";
const LEAKS = [
  SECRET_HOST,
  SECRET_TOKEN,
  SECRET_HEADER_NAME,
  SECRET_HEADER_VALUE,
];

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

/** Forces the unload flush path so queued events leave immediately. */
const flushNow = (page: Page): Promise<void> =>
  page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
  });

const eventsNamed = (ingest: Ingest, name: string): WireEvent[] =>
  ingest.events().filter((e) => e.name === name);

test.describe("Analytics landing and app events @qa", () => {
  test("@critical with the override, landing load posts landing_viewed with path / and referrer direct (SC11)", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /open the app/i }).first()
    ).toBeVisible();
    await flushNow(page);
    await expect
      .poll(() => eventsNamed(ingest, "landing_viewed").length, {
        timeout: FLUSH_WAIT_MS,
      })
      .toBeGreaterThan(0);

    const viewed = eventsNamed(ingest, "landing_viewed");
    expect(viewed).toHaveLength(1);
    expect(viewed[0].props.path).toBe("/");
    expect(viewed[0].props.referrer_domain).toBe("direct");
    await snap("01-landing-viewed");
  });

  test("@critical with the override, clicking the hero Open app CTA posts landing_cta_clicked and navigates to /app (SC11)", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);

    await page.goto("/");
    const cta = page
      .locator("#hero")
      .getByRole("link", { name: /open the app/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/app\/?$/);
    // The unmount of the landing page flushes on pagehide; poll covers the timer path too.
    await expect
      .poll(() => eventsNamed(ingest, "landing_cta_clicked").length, {
        timeout: FLUSH_WAIT_MS,
      })
      .toBeGreaterThan(0);

    const clicked = eventsNamed(ingest, "landing_cta_clicked");
    expect(clicked).toHaveLength(1);
    expect(clicked[0].props.cta_id).toBe("hero_open_app");
    expect(clicked[0].props.path).toBe("/");
    await snap("01-cta-navigated-to-app");
  });

  test("@high with the override, sending a request posts request_sent whose payload contains no URL, host or header from the request", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);
    let proxied = "";
    await page.route(PROXY_GLOB, (route) => {
      proxied = route.request().postData() ?? "";
      return route.fulfill({
        json: { status: 200, statusText: "OK", headers: {}, body: "{}" },
      });
    });

    await openTab(page);
    const layout = page.getByTestId("desktop-layout");
    await layout
      .getByTestId("url-input")
      .fill(`https://${SECRET_HOST}/v1/items?token=${SECRET_TOKEN}`);
    await layout.getByTestId("request-tab-headers").click();
    await page
      .locator(':visible [data-testid="headers-draft-row-key"]')
      .fill(SECRET_HEADER_NAME);
    await page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .fill(SECRET_HEADER_VALUE);
    await layout.getByTestId("url-input").click();
    await layout.getByTestId("send-request-btn").first().click();

    await expect(page.getByTestId("response-status-badge")).toContainText(
      "200"
    );
    // Non-vacuity: the request really carried the secrets, so their absence below means something.
    for (const secret of LEAKS) expect(proxied).toContain(secret);

    await flushNow(page);
    await expect
      .poll(() => eventsNamed(ingest, "request_sent").length, {
        timeout: FLUSH_WAIT_MS,
      })
      .toBeGreaterThan(0);

    const sent = eventsNamed(ingest, "request_sent");
    expect(sent).toHaveLength(1);
    expect(sent[0].props.method).toBe("GET");
    const wire = ingest.hits.map((hit) => hit.postData() ?? "").join("\n");
    for (const secret of LEAKS) expect(wire).not.toContain(secret);
    expect(JSON.stringify(sent[0].props)).not.toMatch(/https?:\/\/|token/i);
    await snap("01-request-sent-no-leak");
  });

  test("@high with the override and DNT=1, the landing page sends nothing", async ({
    page,
    snap,
  }) => {
    const ingest = await stubIngest(page);
    await enableOverride(page);
    await sendDoNotTrack(page);

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /open the app/i }).first()
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.doNotTrack)).toBe("1");
    expect(
      await page.evaluate(() => window.__RQ_ANALYTICS_E2E__ === true)
    ).toBe(true);
    await page.evaluate(async (ms) => {
      window.dispatchEvent(new Event("pagehide"));
      await new Promise((resolve) => setTimeout(resolve, ms));
    }, QUIET_WINDOW_MS);

    expect(ingest.hits).toHaveLength(0);
    await snap("01-landing-dnt-silent");
  });
});
