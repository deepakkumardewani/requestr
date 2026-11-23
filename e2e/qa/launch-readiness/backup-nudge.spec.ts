import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const SESSION_DAYS_KEY = "rq_session_days";
const SNOOZED_KEY = "rq_backup_nudge_snoozed_at";
const LAST_EXPORT_KEY = "rq_last_backup_export";
const NOTICE_DISMISSED_KEY = "rq_analytics_notice_dismissed";
const PRIOR_SESSION_DAY = "2020-01-01";
const SETTLE_MS = 4000;

const nudge = (page: Page) => page.getByTestId("backup-nudge");
const stored = (page: Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(k), key);

/** A returning user: an earlier session day is recorded and the analytics notice is out of the way. */
async function asReturningUser(page: Page): Promise<void> {
  await page.route("**/api/ingest", (route) => route.fulfill({ status: 204 }));
  await page.addInitScript(
    (args) => {
      if (localStorage.getItem(args.sessionKey) === null) {
        localStorage.setItem(args.sessionKey, JSON.stringify([args.day]));
      }
      localStorage.setItem(args.noticeKey, "1");
    },
    {
      sessionKey: SESSION_DAYS_KEY,
      day: PRIOR_SESSION_DAY,
      noticeKey: NOTICE_DISMISSED_KEY,
    }
  );
}

async function openWorkspace(page: Page): Promise<void> {
  await page.goto("/app");
  await expect(page.locator('[data-tour="environments"]')).toBeVisible();
}

/** Stable "never shows" check: waits past the async eligibility read before concluding. */
async function expectNudgeAbsent(page: Page): Promise<void> {
  await expect(nudge(page)).toHaveCount(0);
  await expect(nudge(page)).toHaveCount(0, { timeout: SETTLE_MS });
}

test.describe("Backup nudge @qa", () => {
  test("@critical with seeded data, a prior session and no export, the reminder appears and its action opens the export dialog", async ({
    seededPage: page,
    snap,
  }) => {
    await asReturningUser(page);
    await openWorkspace(page);

    await expect(nudge(page)).toBeVisible();
    await expect(
      nudge(page).getByText("Back up your workspace")
    ).toBeVisible();
    await snap("01-nudge-shown");

    await page.getByTestId("backup-nudge-action").click();
    await expect(nudge(page)).toBeHidden();
    await expect(page.getByTestId("backup-export-dialog")).toBeVisible();
    await expect(page.getByTestId("backup-download-btn")).toBeEnabled();
    await snap("02-export-dialog-open");
  });

  test("@high after a successful export the reminder does not appear", async ({
    seededPage: page,
    snap,
  }) => {
    await asReturningUser(page);
    await openWorkspace(page);
    await expect(nudge(page)).toBeVisible();
    expect(await stored(page, LAST_EXPORT_KEY)).toBeNull();

    await page.getByTestId("backup-nudge-action").click();
    await expect(page.getByTestId("backup-download-btn")).toBeEnabled();
    const download = page.waitForEvent("download");
    await page.getByTestId("backup-download-btn").click();
    await download;
    await expect
      .poll(() => stored(page, LAST_EXPORT_KEY))
      .toMatch(/^\d{13}$/);

    await page.reload();
    await openWorkspace(page);
    await expectNudgeAbsent(page);
    await snap("03-no-nudge-after-export");
  });

  test("@high dismiss hides it and it does not return on reload", async ({
    seededPage: page,
    snap,
  }) => {
    await asReturningUser(page);
    await openWorkspace(page);
    await expect(nudge(page)).toBeVisible();

    await page.getByTestId("backup-nudge-dismiss").click();
    await expect(nudge(page)).toBeHidden();
    expect(await stored(page, SNOOZED_KEY)).toMatch(/^\d{13}$/);

    await page.reload();
    await openWorkspace(page);
    await expectNudgeAbsent(page);
    await snap("04-no-nudge-after-dismiss");
  });

  test("@medium a fresh profile with no data never sees it", async ({
    page,
    snap,
  }) => {
    await asReturningUser(page);
    await openWorkspace(page);
    await expectNudgeAbsent(page);
    await snap("05-no-nudge-fresh-profile");
  });
});
