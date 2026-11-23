import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const LAST_SEEN_KEY = "rq_whats_new_last_seen";
const SESSION_DAYS_KEY = "rq_session_days";
const NOTICE_DISMISSED_KEY = "rq_analytics_notice_dismissed";
const ONBOARDING_COMPLETE_KEY = "rq_onboarding_complete";
const PRIOR_SESSION_DAY = "2020-01-01";
const OLDER_VERSION = "0.0.1";
const CURRENT_VERSION = "0.1.0";
const SETTLE_MS = 4000;

const modal = (page: Page) => page.getByTestId("whats-new-modal");
const stored = (page: Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(k), key);

type ReturningOptions = {
  /** Also mark onboarding finished, so the tour never takes the prompt slot. */
  onboardingComplete: boolean;
};

/**
 * A returning user: an older stored version and a prior session day (so the
 * first-session gate passes), with the analytics notice out of the way. Seeds
 * only when absent so a reload keeps whatever the app has since written.
 */
async function asReturningUser(
  page: Page,
  { onboardingComplete }: ReturningOptions
): Promise<void> {
  await page.route("**/api/ingest", (route) => route.fulfill({ status: 204 }));
  await page.addInitScript(
    (args) => {
      if (localStorage.getItem(args.sessionKey) === null) {
        localStorage.setItem(args.sessionKey, JSON.stringify([args.day]));
      }
      if (localStorage.getItem(args.versionKey) === null) {
        localStorage.setItem(args.versionKey, args.version);
      }
      localStorage.setItem(args.noticeKey, "1");
      if (args.onboardingComplete) {
        localStorage.setItem(args.onboardingKey, "true");
      }
    },
    {
      sessionKey: SESSION_DAYS_KEY,
      day: PRIOR_SESSION_DAY,
      versionKey: LAST_SEEN_KEY,
      version: OLDER_VERSION,
      noticeKey: NOTICE_DISMISSED_KEY,
      onboardingKey: ONBOARDING_COMPLETE_KEY,
      onboardingComplete,
    }
  );
}

async function openWorkspace(page: Page): Promise<void> {
  await page.goto("/app");
  await expect(page.locator('[data-tour="environments"]')).toBeVisible();
}

/** Stable "never shows" check: waits past the async eligibility read before concluding. */
async function expectModalAbsent(page: Page): Promise<void> {
  await expect(modal(page)).toHaveCount(0);
  await expect(modal(page)).toHaveCount(0, { timeout: SETTLE_MS });
}

test.describe("What's New @qa", () => {
  test("@critical a returning user (seeded older stored version and a prior session day, so the first-session gate passes) sees the modal once and not after dismissal (SC6)", async ({
    page,
    snap,
  }) => {
    await asReturningUser(page, { onboardingComplete: true });
    await openWorkspace(page);

    await expect(modal(page)).toBeVisible();
    await expect(modal(page).getByRole("listitem").first()).toBeVisible();
    expect(await stored(page, LAST_SEEN_KEY)).toBe(OLDER_VERSION);
    await snap("01-whats-new-shown");

    await page.getByTestId("whats-new-dismiss").click();
    await expect(modal(page)).toBeHidden();
    await expect
      .poll(() => stored(page, LAST_SEEN_KEY))
      .toBe(CURRENT_VERSION);

    await page.reload();
    await openWorkspace(page);
    await expectModalAbsent(page);
    await snap("02-no-modal-after-dismissal");
  });

  test("@critical a brand-new profile sees no modal and the current version is recorded", async ({
    page,
    snap,
  }) => {
    await page.route("**/api/ingest", (route) =>
      route.fulfill({ status: 204 })
    );
    await openWorkspace(page);

    await expect
      .poll(() => stored(page, LAST_SEEN_KEY))
      .toBe(CURRENT_VERSION);
    await expectModalAbsent(page);
    await snap("03-new-profile-no-modal");
  });

  test("@high with __RQ_TOUR_E2E__ and an older stored version but no rq_onboarding_complete, the modal does not appear while the tour is active", async ({
    page,
    snap,
  }) => {
    await page.addInitScript(() => {
      (window as Window & { __RQ_TOUR_E2E__?: boolean }).__RQ_TOUR_E2E__ = true;
    });
    await asReturningUser(page, { onboardingComplete: false });
    await page.goto("/app");

    await expect(page.getByTestId("tour-popover")).toBeVisible();
    await expect(modal(page)).toHaveCount(0);
    await expect(modal(page)).toHaveCount(0, { timeout: SETTLE_MS });
    await expect(page.getByTestId("tour-popover")).toBeVisible();
    expect(await stored(page, LAST_SEEN_KEY)).toBe(OLDER_VERSION);
    await snap("04-tour-holds-slot");
  });

  test("@medium the modal does not appear on a non-app route such as /privacy (R45)", async ({
    page,
    snap,
  }) => {
    await asReturningUser(page, { onboardingComplete: true });
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectModalAbsent(page);
    expect(await stored(page, LAST_SEEN_KEY)).toBe(OLDER_VERSION);
    await snap("05-no-modal-on-privacy");

    // Same profile on the app route does show it, so the absence above is the route gate.
    await openWorkspace(page);
    await expect(modal(page)).toBeVisible();
  });
});
