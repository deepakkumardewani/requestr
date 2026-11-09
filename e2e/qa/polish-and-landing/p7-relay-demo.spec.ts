import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const LANDING_PATH = "/";
const THEME_KEY = "theme";
const THEMES = ["light", "dark"] as const;
const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const POSTER_ALT = "Relay proposing edits across an API collection";

async function openLanding(page: Page, theme?: string) {
  if (theme) {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [THEME_KEY, theme]
    );
  }
  await page.goto(LANDING_PATH);
}

async function showRelay(page: Page) {
  const section = page.locator("#relay");
  await section.scrollIntoViewIfNeeded();
  await expect(
    section.getByRole("heading", { name: /Ask for the change/ })
  ).toBeVisible();
  return section;
}

test.describe("P7 Relay section (poster) @qa", () => {
  test("@critical the Relay section shows a static poster with no demo controls", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await openLanding(page);
    const section = await showRelay(page);

    await expect(section.getByRole("img", { name: POSTER_ALT })).toBeVisible();
    await expect(
      section.getByRole("group", { name: "Relay prompt" })
    ).toHaveCount(0);
    await expect(section.getByRole("button")).toHaveCount(0);
    await snap("p7-relay-01-poster");
  });

  for (const theme of THEMES) {
    test(`@medium the section renders in ${theme} with no horizontal scroll at 375px`, async ({
      page,
      snap,
    }) => {
      await page.setViewportSize(MOBILE);
      await openLanding(page, theme);
      const section = await showRelay(page);

      await expect(section.getByRole("img", { name: POSTER_ALT })).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await snap(`p7-relay-04-375-${theme}`);
    });
  }
});
