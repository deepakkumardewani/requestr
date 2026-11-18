import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const LANDING_PATH = "/";
const THEME_KEY = "theme";
const SOURCE_LINK = "comparison-source-link";
const MOBILE_VIEWPORT = { width: 375, height: 812 };
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };
const MAX_TABS_TO_FIRST_LINK = 80;
const THEMES = ["light", "dark"] as const;

/** Scroll-reveal wrappers start at opacity 0; wait until the element and its ancestors are fully opaque. */
async function expectRevealed(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      target.evaluate((el) => {
        let min = 1;
        for (let n: Element | null = el; n; n = n.parentElement) {
          min = Math.min(min, Number(getComputedStyle(n).opacity));
        }
        return min;
      })
    )
    .toBe(1);
}

async function openCompare(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_KEY, theme]
  );
  await page.goto(LANDING_PATH);
  const section = page.locator("#compare");
  await section.scrollIntoViewIfNeeded();
  await expect(
    section.getByRole("heading", { name: /How Requestr stacks up/ })
  ).toBeVisible();
  return section;
}

test.describe("P5 comparison table on the landing page @qa", () => {
  test("@critical each competitor cell on / exposes a source link with an https href", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const section = await openCompare(page, "light");
    const rows = section.locator("tbody tr:has(td)");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    for (let i = 0; i < rowCount; i++) {
      const cells = rows.nth(i).locator("td");
      // Columns: feature, Requestr, Postman, Insomnia.
      for (const col of [2, 3]) {
        const link = cells.nth(col).getByTestId(SOURCE_LINK);
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute(
          "href",
          /^https:\/\/[^\s/]+\.[^\s]+/
        );
      }
      await expect(cells.nth(1).getByTestId(SOURCE_LINK)).toHaveCount(0);
    }
    // The mobile cards also carry links (hidden at this width), so scope to the table.
    await expect(section.locator("table").getByTestId(SOURCE_LINK)).toHaveCount(
      rowCount * 2
    );
    await expectRevealed(section.locator("table"));
    await snap("01-desktop-source-links");
  });

  test("@high source links are reachable with Tab and have visible focus", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const section = await openCompare(page, "light");
    // Start sequential focus just before the table.
    const header = section.getByRole("columnheader", { name: "Requestr" });
    await expectRevealed(header);
    await header.click();

    const focused = page.locator(`[data-testid="${SOURCE_LINK}"]:focus`);
    let reached = false;
    for (let i = 0; i < MAX_TABS_TO_FIRST_LINK && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = (await focused.count()) === 1;
    }
    expect(reached).toBe(true);
    await expect(focused).toBeVisible();
    await expect(focused).toHaveCSS("box-shadow", /rgb/);
    await snap("02-focused-source-link");

    // A second Tab moves on to another source link, so each is keyboard-reachable.
    const firstHref = await focused.getAttribute("href");
    await page.keyboard.press("Tab");
    await expect(focused).toHaveCount(1);
    const secondLabel = await focused.getAttribute("aria-label");
    expect(secondLabel).toMatch(/^Source for /);
    expect(firstHref).toMatch(/^https:\/\//);
  });

  for (const theme of THEMES) {
    test(`@high at 375px the comparison fits the page with no horizontal scroll in ${theme}`, async ({
      page,
      snap,
    }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      const section = await openCompare(page, theme);
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /dark/ : /^(?!.*dark)/
      );

      // The page itself must not scroll sideways.
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        win: document.documentElement.clientWidth,
        body: document.body.scrollWidth,
      }));
      expect(overflow.doc).toBeLessThanOrEqual(overflow.win);
      expect(overflow.body).toBeLessThanOrEqual(overflow.win);

      // The wide table scrolls inside its own container instead of the page.
      const scroller = section.locator("table").locator("xpath=..");
      await expectRevealed(section.locator("table"));
      const dims = await scroller.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(dims.scrollWidth).toBeGreaterThan(dims.clientWidth);
      await expect(section.locator("table")).toBeVisible();
      await expect(
        section.locator("table").getByTestId(SOURCE_LINK).first()
      ).toBeAttached();
      await snap(`03-mobile-375-${theme}`);
    });
  }
});
