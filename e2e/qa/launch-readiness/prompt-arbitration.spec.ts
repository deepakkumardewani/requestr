import type { Page } from "@playwright/test";
import { openRelay } from "../../fixtures/relayE2eHelpers";
import { expect, test } from "../../fixtures/qa";

const NOTICE_TESTID = "analytics-notice";
const DISMISS_LABEL = "Dismiss";
const DISMISSED_KEY = "rq_analytics_notice_dismissed";
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const TYPED_URL = "https://example.com/typed";

async function enableOverride(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__RQ_ANALYTICS_E2E__ = true;
  });
}

/** Keeps the run offline: nothing reaches the real ingest endpoint. */
async function stubIngest(page: Page): Promise<void> {
  await page.route("**/api/ingest", (route) => route.fulfill({ status: 204 }));
}

async function prepare(page: Page): Promise<void> {
  await stubIngest(page);
  await enableOverride(page);
}

const notice = (page: Page) => page.getByTestId(NOTICE_TESTID);

test.describe("Prompt arbitration @qa", () => {
  test("@critical with the override, a fresh profile on mobile width sees the notice directly; dismissing it persists across reload (R20)", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await prepare(page);

    await page.goto("/app");
    await expect(page.getByTestId("mobile-layout")).toBeVisible();
    await expect(notice(page)).toBeVisible();
    await snap("01-mobile-notice-shown");

    await notice(page).getByRole("button", { name: DISMISS_LABEL }).click();
    await expect(notice(page)).toBeHidden();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY)
    ).toBe("1");

    await page.reload();
    await expect(page.getByTestId("mobile-layout")).toBeVisible();
    await expect(notice(page)).toBeHidden();
    await snap("02-mobile-notice-stays-dismissed");
  });

  test("@critical with the override, opening Relay while the notice shows hides the notice and shows only Relay's coach (R43)", async ({
    page,
    snap,
  }) => {
    await prepare(page);

    await page.goto("/app");
    await expect(notice(page)).toBeVisible();

    await openRelay(page);
    await expect(page.getByTestId("relay-dock")).toBeVisible();
    await expect(page.getByTestId("relay-onboarding")).toBeVisible();
    await expect(notice(page)).toBeHidden();
    await snap("01-relay-open-notice-hidden");
  });

  test("@high with the override and DNT=1, the notice never appears", async ({
    page,
    snap,
  }) => {
    await prepare(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", { get: () => "1" });
    });

    await page.goto("/app");
    expect(await page.evaluate(() => navigator.doNotTrack)).toBe("1");
    // The app shell is interactive, so an eligible notice would have mounted.
    await expect(page.getByTestId("create-new-dropdown-trigger")).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    await snap("01-dnt-no-notice");
  });

  test("@high with the override and GPC=1, the notice never appears", async ({
    page,
  }) => {
    await prepare(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "globalPrivacyControl", {
        get: () => true,
      });
    });

    await page.goto("/app");
    await expect(page.getByTestId("create-new-dropdown-trigger")).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test("@high with the override, the notice never blocks typing in the URL bar", async ({
    page,
    snap,
  }) => {
    await prepare(page);

    await page.goto("/app");
    await expect(notice(page)).toBeVisible();

    await page.getByTestId("create-new-dropdown-trigger").click();
    await page.getByRole("menuitem", { name: "HTTP" }).click();
    const urlInput = page.getByTestId("url-input");
    await urlInput.click();
    await urlInput.fill(TYPED_URL);
    await expect(urlInput).toHaveValue(TYPED_URL);
    await expect(notice(page)).toBeVisible();
    await snap("01-typing-with-notice");
  });
});
