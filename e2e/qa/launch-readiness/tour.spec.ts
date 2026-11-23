import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const COMPLETE_KEY = "rq_onboarding_complete";
const NOTICE_TESTID = "analytics-notice";
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const REPLAY_LABEL = "Replay tour";
const PROGRESS_PATTERN = /^Step (\d+)\/(\d+)$/;

/** Every scenario opts in, so negatives fail for the right reason rather than webdriver suppression. */
async function optInToTourAutoStart(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as Window & { __RQ_TOUR_E2E__?: boolean }).__RQ_TOUR_E2E__ = true;
  });
}

async function enableAnalyticsOverride(page: Page): Promise<void> {
  await page.route("**/api/ingest", (route) => route.fulfill({ status: 204 }));
  await page.addInitScript(() => {
    window.__RQ_ANALYTICS_E2E__ = true;
  });
}

async function markTourComplete(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "true");
  }, COMPLETE_KEY);
}

const popover = (page: Page) => page.getByTestId("tour-popover");
const storedFlag = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), COMPLETE_KEY);

async function expectWorkspaceReady(page: Page): Promise<void> {
  await expect(page.locator('[data-tour="environments"]')).toBeVisible();
  await expect(page.locator('[data-tour="chains"]')).toBeVisible();
}

/** Stable "tour never starts" check: waits past the anchor wait window before asserting absence. */
async function expectTourNeverStarts(page: Page): Promise<void> {
  await expect(page.getByTestId("tour-popover")).toHaveCount(0);
  // The anchor wait is bounded at 3s; the workspace anchor must be ready before we conclude.
  await expectWorkspaceReady(page);
  await expect(page.getByTestId("tour-popover")).toHaveCount(0, {
    timeout: 4000,
  });
}

async function walkToDone(page: Page): Promise<void> {
  const progress = await popover(page)
    .getByText(PROGRESS_PATTERN)
    .textContent();
  const total = Number(progress?.match(PROGRESS_PATTERN)?.[2]);
  expect(total).toBeGreaterThanOrEqual(4);
  for (let step = 1; step < total; step++) {
    await expect(
      popover(page).getByText(`Step ${step}/${total}`)
    ).toBeVisible();
    await page.getByTestId("tour-next").click();
  }
  await expect(popover(page).getByText(`Step ${total}/${total}`)).toBeVisible();
  await page.getByTestId("tour-next").click();
}

test.describe("First-run tour @qa", () => {
  test.beforeEach(async ({ page }) => {
    await optInToTourAutoStart(page);
  });

  test("@critical with __RQ_TOUR_E2E__, a fresh desktop profile auto-starts the tour on /app; after completing it, reload does not restart it", async ({
    page,
    snap,
  }) => {
    await page.goto("/app");
    await expect(popover(page)).toBeVisible();
    await expect(
      popover(page).getByText("Step 1/", { exact: false })
    ).toBeVisible();
    await snap("01-tour-auto-started");

    await walkToDone(page);
    await expect(popover(page)).toHaveCount(0);
    expect(await storedFlag(page)).toBe("true");

    await page.reload();
    await expectTourNeverStarts(page);
    await snap("02-no-restart-after-reload");
  });

  test("@critical Skip sets completion and the tour does not return after reload", async ({
    page,
    snap,
  }) => {
    await page.goto("/app");
    await expect(popover(page)).toBeVisible();

    await page.getByTestId("tour-skip").click();
    await expect(popover(page)).toHaveCount(0);
    expect(await storedFlag(page)).toBe("true");
    await snap("01-skipped");

    await page.reload();
    await expectTourNeverStarts(page);
  });

  test("@critical with both flags, after the tour is skipped the analytics notice appears (R44 first-visit sequence)", async ({
    page,
    snap,
  }) => {
    await enableAnalyticsOverride(page);
    await page.goto("/app");
    await expect(popover(page)).toBeVisible();
    await expect(page.getByTestId(NOTICE_TESTID)).toBeHidden();
    await snap("01-tour-first-notice-waits");

    await page.getByTestId("tour-skip").click();
    await expect(popover(page)).toHaveCount(0);
    await expect(page.getByTestId(NOTICE_TESTID)).toBeVisible();
    await snap("02-notice-after-skip");
  });

  test("@critical below 768px the tour does not auto-start", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/app");
    await expect(page.getByTestId("mobile-layout")).toBeVisible();
    await expect(popover(page)).toHaveCount(0, { timeout: 4000 });
    expect(await storedFlag(page)).toBeNull();
    await snap("01-mobile-no-tour");
  });

  test("@high Settings Replay tour starts the tour when already completed", async ({
    page,
    snap,
  }) => {
    await markTourComplete(page);
    await page.goto("/settings");
    await page.getByTestId("nav-general").click();
    await page.getByTestId("restart-tour-btn").click();
    await expect(popover(page)).toBeVisible({ timeout: 10_000 });
    await snap("01-replay-from-settings");
  });

  test("@high the command palette Replay tour item starts the tour when already completed", async ({
    page,
    snap,
  }) => {
    await markTourComplete(page);
    await page.goto("/app");
    await expectWorkspaceReady(page);
    await expect(popover(page)).toHaveCount(0);

    await page.keyboard.press("Control+k");
    await page.getByRole("option", { name: REPLAY_LABEL }).click();
    await expect(popover(page)).toBeVisible({ timeout: 10_000 });
    await snap("01-replay-from-palette");
  });

  test("@high Esc closes the tour and focus returns to the app", async ({
    page,
    snap,
  }) => {
    await page.goto("/app");
    await expect(popover(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    await expect(page.locator(".driver-overlay")).toHaveCount(0);
    await expect(page.getByTestId("tour-next")).toHaveCount(0);
    const focusInTour = await page.evaluate(
      () => !!document.activeElement?.closest("[data-tour-host]")
    );
    expect(focusInTour).toBe(false);
    // Keyboard input reaches the app again: the palette shortcut opens it.
    await page.keyboard.press("Control+k");
    await expect(
      page.getByRole("option", { name: REPLAY_LABEL })
    ).toBeVisible();
    await snap("01-esc-closed");
  });

  test("@high a restored-from-backup profile (completion flag set) does not auto-start", async ({
    page,
    snap,
  }) => {
    await markTourComplete(page);
    await page.goto("/app");
    await expectTourNeverStarts(page);
    await snap("01-restored-profile-no-tour");
  });
});
