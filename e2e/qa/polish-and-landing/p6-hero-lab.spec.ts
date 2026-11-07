import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const THEME_KEY = "theme";
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];
const CONCEPTS = [
  { id: "a", path: "/hero-lab/a", h1: /Send a request\. Right here\./ },
  { id: "b", path: "/hero-lab/b", h1: /From request to test, in one scroll\./ },
  { id: "c", path: "/hero-lab/c", h1: /Send the request\./ },
] as const;
const PHONE = { width: 375, height: 667 };
const STATUS_TICK_MS = 2200;
const STAGE_TITLES = ["Send", "Read", "Chain", "Relay"];
const CTA_NAME = /Open the app/;

async function openLab(page: Page, path: string, theme: Theme) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_KEY, theme]
  );
  await page.goto(path);
  await expect(page.locator("html")).toHaveClass(
    theme === "dark" ? /dark/ : /^(?!.*dark)/
  );
}

test.describe("P6 hero lab", () => {
  for (const concept of CONCEPTS) {
    for (const theme of THEMES) {
      test(`@critical ${concept.path} loads with no console errors in ${theme}`, async ({
        page,
        snap,
      }) => {
        await openLab(page, concept.path, theme);
        await expect(
          page.getByRole("heading", { level: 1, name: concept.h1 })
        ).toBeVisible();
        await expect(page.getByRole("link", { name: CTA_NAME })).toBeVisible();
        await snap(`p6-${concept.id}-${theme}`);
        // consoleGuard (auto fixture) fails the test on any console error/warning.
      });
    }
  }

  test("@critical reduced motion: concept A makes no auto-play request", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const proxyCalls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/proxy")) proxyCalls.push(r.url());
    });
    await openLab(page, "/hero-lab/a", "light");
    await expect(
      page.getByText("Press Send to make a real request.")
    ).toBeVisible();
    await expect(page.getByTestId("hero-a-response")).toHaveCount(0);
    expect(proxyCalls).toEqual([]);
  });

  test("@critical reduced motion: concept B renders every stage static, nothing pinned", async ({
    page,
    snap,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openLab(page, "/hero-lab/b", "light");
    for (const title of STAGE_TITLES) {
      await expect(
        page.getByRole("heading", { level: 2, name: title, exact: true })
      ).toBeAttached();
    }
    await expect(page.getByTestId("hero-b-track")).toHaveCount(0);
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await snap("p6-b-reduced");
  });

  test("@critical motion allowed: concept B pins a single stage (control)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openLab(page, "/hero-lab/b", "light");
    await expect(page.getByTestId("hero-b-track")).toBeAttached();
    await expect(page.getByTestId("hero-b-stage")).toHaveCount(1);
  });

  test("@critical reduced motion: concept C status ticker stays on 200", async ({
    page,
  }) => {
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openLab(page, "/hero-lab/c", "light");
    const status = page.getByTestId("hero-c-status");
    await expect(status).toContainText("200 OK");
    await page.clock.runFor(STATUS_TICK_MS * 6);
    await expect(status).toContainText("200 OK");
  });

  test("@critical motion allowed: concept C status ticker advances (control)", async ({
    page,
  }) => {
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openLab(page, "/hero-lab/c", "light");
    const status = page.getByTestId("hero-c-status");
    await expect(status).toContainText("200 OK");
    await page.clock.runFor(STATUS_TICK_MS + 100);
    await expect(status).toContainText("201 Created");
  });

  for (const concept of CONCEPTS) {
    test(`@high ${concept.path} at 375x667 has no horizontal scroll and CTA visible`, async ({
      page,
      snap,
    }) => {
      await page.setViewportSize(PHONE);
      await openLab(page, concept.path, "light");
      const cta = page.getByRole("link", { name: CTA_NAME });
      await expect(cta).toBeInViewport();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await snap(`p6-${concept.id}-375`);
    });

    test(`@high ${concept.path} is noindex`, async ({ page }) => {
      await page.goto(concept.path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/
      );
    });
  }

  test("@high no public nav links to the lab", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("banner").first()).toBeVisible();
    await expect(page.locator('a[href*="hero-lab"]')).toHaveCount(0);
  });
});
