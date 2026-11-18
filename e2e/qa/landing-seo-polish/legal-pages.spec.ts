import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// Marketing routes live at the origin root; baseURL carries the /app basePath.
const DEFAULT_SITE_URL = "https://requestr-api.vercel.app";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(
  /\/+$/,
  "",
);

// Restated from SPEC section D / T11.1, not imported from the app under test.
const CONTACT_EMAIL = "kumard8308887772@gmail.com";
const LEGAL_ROUTES = ["/privacy", "/terms"] as const;
// Any case, with optional emoji/punctuation/whitespace between the words.
const REVIEW_MARKER = /legal[^a-z0-9]{0,8}review|review[^a-z0-9]{0,8}required/i;

const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

const horizontalOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

const useLight = (page: Page) =>
  page.addInitScript(() => localStorage.setItem("theme", "light"));

test.describe("Legal pages @qa", () => {
  test("@critical /privacy and /terms return 200 with one h1, unique title and canonical, and no review marker", async ({
    page,
    baseURL,
    snap,
  }) => {
    await useLight(page);
    const titles: string[] = [];
    const canonicals: string[] = [];

    for (const path of LEGAL_ROUTES) {
      const res = await page.goto(originUrl(baseURL, path));
      expect(res?.status(), path).toBe(200);

      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const title = await page.title();
      expect(title.length, `${path} title`).toBeGreaterThan(0);
      titles.push(title);

      const canonical = await page
        .locator('link[rel="canonical"]')
        .first()
        .getAttribute("href");
      expect(canonical, `${path} canonical`).toBe(`${SITE_URL}${path}`);
      canonicals.push(canonical as string);

      const html = await page.content();
      expect(html, `${path} html`).not.toMatch(REVIEW_MARKER);
      const text = await page.locator("body").innerText();
      expect(text.length, `${path} has real content`).toBeGreaterThan(500);
      expect(text, `${path} text`).not.toMatch(REVIEW_MARKER);
    }

    expect(new Set(titles).size).toBe(LEGAL_ROUTES.length);
    expect(new Set(canonicals).size).toBe(LEGAL_ROUTES.length);
    await snap("01-terms-light");
  });

  test("@high /privacy names DeepSeek, xAI, Upstash and the 24-hour share-link expiry; /terms shows the contact email", async ({
    page,
    baseURL,
    snap,
  }) => {
    await useLight(page);
    await page.goto(originUrl(baseURL, "/privacy"));
    const privacy = page.locator("main, body").first();
    await expect(privacy).toContainText("DeepSeek");
    await expect(privacy).toContainText("xAI");
    await expect(privacy).toContainText("Upstash");
    await expect(privacy).toContainText(/24[\s -]hours?/i);
    await snap("02-privacy-light");

    await page.goto(originUrl(baseURL, "/terms"));
    await expect(page.locator("body")).toContainText(CONTACT_EMAIL);
    await snap("03-terms-contact");
  });

  for (const viewport of [
    { width: 375, height: 800 },
    { width: 1280, height: 800 },
  ]) {
    for (const theme of ["light", "dark"] as const) {
      test(`@medium ${viewport.width} px ${theme}: readable, no horizontal scroll`, async ({
        page,
        baseURL,
        snap,
      }) => {
        await page.addInitScript((value) => {
          localStorage.setItem("theme", value);
        }, theme);
        await page.setViewportSize(viewport);

        for (const path of LEGAL_ROUTES) {
          await page.goto(originUrl(baseURL, path));
          await expect(page.locator("html")).toHaveClass(
            new RegExp(`\\b${theme}\\b`),
          );
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
          // Readable: body copy is not tiny.
          const fontSize = await page
            .locator("p")
            .first()
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
          expect(fontSize, `${path} font size`).toBeGreaterThanOrEqual(14);
        }
        await snap(`04-legal-${viewport.width}-${theme}`);
      });
    }
  }
});
