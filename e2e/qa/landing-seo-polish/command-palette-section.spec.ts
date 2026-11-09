import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// The marketing root lives at the origin root, not under the /app basePath.
const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

const SECTION_COUNT = 9;
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
  test("@high section sits between FeatureShowcase and BeyondSend and shows a loaded screenshot with alt text", async ({
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
    expect(ids[at - 1]).toBe("features");
    expect(ids[at + 1]).toBe("beyond-send");

    const section = page.locator("#command-palette");
    await section.scrollIntoViewIfNeeded();
    await expect(
      section.getByRole("heading", { level: 2, name: "Do anything from one keystroke." }),
    ).toBeVisible();

    const shot = section.getByRole("img", { name: /^Command palette open/ });
    await expect(shot).toBeVisible();
    await expect(shot).toHaveAttribute("alt", /search box.*requests/);
    await expect
      .poll(() =>
        shot.evaluate(
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
    for (const theme of ["light", "dark"] as const) {
      test(`@high ${viewport.width} px ${theme}: no horizontal overflow, image visible`, async ({
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

        // Real user input finalises LCP, so a lazy below-fold image that loads
        // on scroll is not flagged by Next as a missing-priority LCP image.
        await page.mouse.wheel(0, 1);
        const section = page.locator("#command-palette");
        await section.scrollIntoViewIfNeeded();
        // Only the image for the active theme is displayed.
        const shot = section.locator("img:visible");
        await expect(shot).toHaveCount(1);
        await expect(shot).toBeInViewport();
        await expect(shot).toHaveAttribute(
          "src",
          new RegExp(`command-palette-${theme}`),
        );
        await expect
          .poll(() =>
            shot.evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
          )
          .toBe(true);

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        await snap(`02-section-${viewport.width}-${theme}`);
      });
    }
  }

  test("@medium the top Nav has no new link for this section", async ({
    page,
    baseURL,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await gotoLanding(page, baseURL);
    const nav = page.getByRole("navigation", { name: "Main navigation" });

    // Positive anchor: the known links render, so the absence checks are real.
    await expect(nav.getByRole("link", { name: "Features", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: /command palette/i })).toHaveCount(0);
    await expect(nav.locator('a[href$="#command-palette"]')).toHaveCount(0);

    await snap("03-nav-unchanged");
  });
});
