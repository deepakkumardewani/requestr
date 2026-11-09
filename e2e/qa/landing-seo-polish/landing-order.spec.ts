import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// The marketing root lives at the origin root, not under the /app basePath.
const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

// Restated from SPEC criterion 1 (T3.8 order); FinalCta carries no id.
const EXPECTED_SECTION_IDS = [
  "hero",
  "relay",
  "how-it-works",
  "features",
  "command-palette",
  "beyond-send",
  "import",
  "compare",
  "",
];

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

async function gotoLanding(page: Page, baseURL: string | undefined) {
  await page.goto(originUrl(baseURL, "/"));
  // Relay is code-split; wait for the last lazy section before reading order.
  await expect(page.locator("main > section#relay")).toBeAttached();
  await expect(page.locator("main > section")).toHaveCount(
    EXPECTED_SECTION_IDS.length,
  );
}

test.describe("Landing order and no stat strip @qa", () => {
  for (const [label, viewport] of [
    ["1280 px", DESKTOP],
    ["390 px", MOBILE],
  ] as const) {
    test(`@critical section order under <main> matches SPEC criterion 1 at ${label}`, async ({
      page,
      baseURL,
      snap,
    }) => {
      await page.setViewportSize(viewport);
      await gotoLanding(page, baseURL);

      const ids = await page
        .locator("main > section")
        .evaluateAll((els) => els.map((el) => el.id));
      expect(ids).toEqual(EXPECTED_SECTION_IDS);

      await snap(`01-order-${viewport.width}`);
    });
  }

  test('@critical no stat strip, "6.6 s", "759 KB" or "measured" text on /', async ({
    page,
    baseURL,
  }) => {
    await gotoLanding(page, baseURL);
    const main = page.locator("main");

    // Positive anchor so the absence checks run against a rendered page.
    await expect(main.getByRole("heading", { level: 2 }).first()).toBeVisible();

    await expect(main.getByText("6.6 s")).toHaveCount(0);
    await expect(main.getByText("759 KB")).toHaveCount(0);
    await expect(main.getByText(/measured/i)).toHaveCount(0);
    await expect(page.getByTestId("comparison-stat-strip")).toHaveCount(0);
    expect(await main.innerText()).not.toMatch(/6\.6\s*s|759\s*KB|measured/i);
  });

  test('@high comparison "Time to first request" row shows the three ranges and no stopwatch', async ({
    page,
    baseURL,
    snap,
  }) => {
    await gotoLanding(page, baseURL);
    const row = page.getByRole("row", { name: /Time to first request/ });
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeVisible();

    const cells = row.getByRole("cell");
    await expect(cells).toHaveCount(4);
    await expect(cells.nth(1)).toContainText("About 10-15 s");
    await expect(cells.nth(2)).toContainText("About 2-4 min");
    await expect(cells.nth(3)).toContainText("About 2-3 min");

    await expect(row.getByTestId(/stopwatch/i)).toHaveCount(0);
    await expect(row.getByRole("img")).toHaveCount(0);
    await expect(row.getByText(/stopwatch/i)).toHaveCount(0);

    await snap("02-time-to-first-request");
  });

  test("@medium Nav anchors scroll to existing sections", async ({
    page,
    baseURL,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await gotoLanding(page, baseURL);
    const nav = page.getByRole("navigation", { name: "Main navigation" });

    for (const [name, id] of [
      ["How it works", "how-it-works"],
      ["Features", "features"],
      ["Compare", "compare"],
    ] as const) {
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page.locator(`main > section#${id}`)).toBeInViewport();
    }

    await snap("03-nav-compare");
  });
});
