import type { Page } from "@playwright/test";
import {
  COMMAND_PALETTE_HEADLINE,
  COMMAND_PALETTE_MEDIA,
} from "../../../src/components/landing/data/copy";
import { SECTION_ORDER } from "../../../src/components/landing/data/links";
import { expect, test } from "../../fixtures/qa";

// The marketing root lives at the origin root, not under the /app basePath.
const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

// Every landing section carries an id, the closing FinalCta included.
const SECTION_COUNT = SECTION_ORDER.length;
const LAYOUT_SHIFT_LIMIT = 0.1;
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

async function gotoLanding(page: Page, baseURL: string | undefined) {
  await page.goto(originUrl(baseURL, "/"));
  // Relay is code-split; wait for the last lazy section before using the page.
  await expect(page.locator("main > section")).toHaveCount(SECTION_COUNT);
}

const horizontalOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe("Command palette landing section @qa", () => {
  test("@high section sits between Control and Import and shows a loaded poster with alt text", async ({
    page,
    baseURL,
    snap,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!shift.hadRecentInput) w.__cls += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.setViewportSize(DESKTOP);
    await gotoLanding(page, baseURL);

    const ids = await page
      .locator("main > section")
      .evaluateAll((els) => els.map((el) => el.id));
    const at = ids.indexOf("command-palette");
    expect(at).toBeGreaterThan(-1);
    expect(ids[at - 1]).toBe("control");
    expect(ids[at + 1]).toBe("import");

    const section = page.locator("#command-palette");
    await section.scrollIntoViewIfNeeded();
    await expect(
      section.getByRole("heading", { level: 2, name: COMMAND_PALETTE_HEADLINE }),
    ).toBeVisible();

    const poster = section.getByRole("img", { name: COMMAND_PALETTE_MEDIA.alt });
    await expect(poster).toBeVisible();
    await expect
      .poll(() =>
        poster.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);

    const cls = await page.evaluate(
      () => (window as unknown as { __cls: number }).__cls,
    );
    expect(cls).toBeLessThan(LAYOUT_SHIFT_LIMIT);

    await snap("01-command-palette-section");
  });

  for (const viewport of [MOBILE, DESKTOP]) {
    test(`@high ${viewport.width} px: no horizontal overflow, poster in view`, async ({
      page,
      baseURL,
      snap,
    }) => {
      await page.setViewportSize(viewport);
      await gotoLanding(page, baseURL);

      // Real user input finalises LCP, so a lazy below-fold image that loads
      // on scroll is not flagged by Next as a missing-priority LCP image.
      await page.mouse.wheel(0, 1);
      const section = page.locator("#command-palette");
      await section.scrollIntoViewIfNeeded();
      const poster = section.getByRole("img", {
        name: COMMAND_PALETTE_MEDIA.alt,
      });
      await expect(poster).toBeInViewport();

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

      await snap(`02-section-${viewport.width}`);
    });
  }
});
