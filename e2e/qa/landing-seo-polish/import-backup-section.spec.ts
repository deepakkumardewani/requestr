import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// The marketing root lives at the origin root, not under the /app basePath.
const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

const SECTION_COUNT = 9;
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

async function gotoLanding(page: Page, baseURL: string | undefined) {
  await page.goto(originUrl(baseURL, "/"));
  // Relay is code-split; wait for the last lazy section before using the page.
  await expect(page.locator("main > section")).toHaveCount(SECTION_COUNT);
  // Real input finalises LCP so lazy below-fold images are not flagged.
  await page.mouse.wheel(0, 1);
}

const horizontalOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe("Import and backup landing section @qa", () => {
  test("@high section order position is Import and backup between BeyondSend and ComparisonTable", async ({
    page,
    baseURL,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await gotoLanding(page, baseURL);

    const ids = await page
      .locator("main > section")
      .evaluateAll((els) => els.map((el) => el.id));
    const at = ids.indexOf("import");
    expect(at).toBeGreaterThan(-1);
    expect(ids[at - 1]).toBe("beyond-send");
    expect(ids[at + 1]).toBe("compare");

    const section = page.locator("#import");
    await section.scrollIntoViewIfNeeded();
    await expect(
      section.getByRole("heading", {
        level: 2,
        name: "Bring what you have. Keep what you build.",
      }),
    ).toBeVisible();

    await snap("01-import-section-order");
  });

  test("@high two groups visible, all screenshots loaded with alt text", async ({
    page,
    baseURL,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await gotoLanding(page, baseURL);
    // Real input finalises LCP so lazy below-fold images are not flagged.
    await page.mouse.wheel(0, 1);

    const section = page.locator("#import");
    await section.scrollIntoViewIfNeeded();

    const importGroup = section.getByRole("group", { name: "Import", exact: true });
    const backupGroup = section.getByRole("group", { name: "Backup", exact: true });
    await expect(importGroup).toBeVisible();
    await expect(backupGroup).toBeVisible();
    // AnimatedContent fades in; wait until the effective opacity (the product
    // along the ancestor chain) is 1 so assertions and the screenshot are final.
    for (const group of [importGroup, backupGroup]) {
      await expect
        .poll(() =>
          group.evaluate((el) => {
            let opacity = 1;
            for (let n: Element | null = el; n; n = n.parentElement) {
              opacity *= Number(getComputedStyle(n).opacity);
            }
            return opacity;
          }),
        )
        .toBe(1);
    }
    await expect(
      importGroup.getByRole("heading", { level: 3, name: "Import" }),
    ).toBeVisible();
    await expect(
      backupGroup.getByRole("heading", { level: 3, name: "Backup" }),
    ).toBeVisible();

    // Import group carries both theme variants, each with non-empty alt.
    const light = importGroup.locator('img[src*="import-light"]');
    const dark = importGroup.locator('img[src*="import-dark"]');
    await expect(light).toHaveCount(1);
    await expect(dark).toHaveCount(1);
    await expect(light).toHaveAttribute("alt", /\S{3,}/);
    await expect(dark).toHaveAttribute("alt", /\S{3,}/);

    // The active-theme (light) variant is displayed and decoded.
    await expect(light).toBeVisible();
    await expect(dark).toBeHidden();
    await expect
      .poll(() =>
        light.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);

    // Backup group is text-only for now: it renders content but no images.
    await expect(backupGroup.getByRole("term").first()).toBeVisible();
    await expect(backupGroup.locator("img")).toHaveCount(0);

    await snap("02-import-backup-groups");
  });

  for (const viewport of [MOBILE, DESKTOP]) {
    for (const theme of ["light", "dark"] as const) {
      test(`@medium ${viewport.width} px ${theme}: no horizontal overflow`, async ({
        page,
        baseURL,
        snap,
      }) => {
        await page.addInitScript((value) => {
          localStorage.setItem("theme", value);
        }, theme);
        await page.setViewportSize(viewport);
        await gotoLanding(page, baseURL);
        await expect(page.locator("html")).toHaveClass(
          new RegExp(`\\b${theme}\\b`),
        );
        await page.mouse.wheel(0, 1);

        const section = page.locator("#import");
        await section.scrollIntoViewIfNeeded();
        const shot = section.locator("img:visible");
        await expect(shot).toHaveCount(1);
        await expect(shot).toHaveAttribute("src", new RegExp(`import-${theme}`));
        await expect
          .poll(() =>
            shot.evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
          )
          .toBe(true);

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        await snap(`03-section-${viewport.width}-${theme}`);
      });
    }
  }
});
