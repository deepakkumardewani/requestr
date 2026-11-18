import type { Page } from "@playwright/test";
import {
  IMPORT_FORMAT_CHIPS,
  IMPORT_HEADLINE,
} from "../../../src/components/landing/constants";
import { DATA_FORMATS_LABEL } from "../../../src/components/landing/data/copy";
import { SECTION_ORDER } from "../../../src/components/landing/data/links";
import { expect, test } from "../../fixtures/qa";

// The marketing root lives at the origin root, not under the /app basePath.
const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

// Every landing section carries an id, the closing FinalCta included.
const SECTION_COUNT = SECTION_ORDER.length;
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
  test("@high Import and backup sits between Command palette and Toolbox and lists the formats", async ({
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
    expect(ids[at - 1]).toBe("command-palette");
    expect(ids[at + 1]).toBe("toolbox");

    const section = page.locator("#import");
    await section.scrollIntoViewIfNeeded();
    await expect(
      section.getByRole("heading", { level: 2, name: IMPORT_HEADLINE }),
    ).toBeVisible();

    const formats = section.getByRole("list", { name: DATA_FORMATS_LABEL });
    await expect(formats.getByRole("listitem")).toHaveText([
      ...IMPORT_FORMAT_CHIPS,
    ]);

    await snap("01-import-section-order");
  });

  for (const viewport of [MOBILE, DESKTOP]) {
    test(`@medium ${viewport.width} px: no horizontal overflow`, async ({
      page,
      baseURL,
      snap,
    }) => {
      await page.setViewportSize(viewport);
      await gotoLanding(page, baseURL);

      const section = page.locator("#import");
      await section.scrollIntoViewIfNeeded();
      await expect(
        section.getByRole("heading", { level: 2, name: IMPORT_HEADLINE }),
      ).toBeInViewport();

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

      await snap(`03-section-${viewport.width}`);
    });
  }
});
