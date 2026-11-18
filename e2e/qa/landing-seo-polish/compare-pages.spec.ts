import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// Marketing routes live at the origin root; baseURL carries the /app basePath.
const DEFAULT_SITE_URL = "https://requestr-api.vercel.app";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(
  /\/+$/,
  "",
);

const COMPETITORS = ["postman", "insomnia"] as const;

const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

const attr = (page: Page, selector: string, name: string) =>
  page.locator(selector).first().getAttribute(name);

const horizontalOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

const useLight = async (page: Page) =>
  page.addInitScript(() => localStorage.setItem("theme", "light"));

test.describe("Compare pages @qa", () => {
  test("@critical /compare/postman and /compare/insomnia return 200 with unique title, canonical, OG/Twitter and parseable JSON-LD", async ({
    page,
    baseURL,
    snap,
  }) => {
    await useLight(page);
    const titles: string[] = [];
    const canonicals: string[] = [];

    for (const slug of COMPETITORS) {
      const res = await page.goto(originUrl(baseURL, `/compare/${slug}`));
      expect(res?.status(), slug).toBe(200);

      const title = await page.title();
      expect(title.length, `${slug} title`).toBeGreaterThan(0);
      titles.push(title);

      const canonical = await attr(page, 'link[rel="canonical"]', "href");
      expect(canonical, `${slug} canonical`).toBe(`${SITE_URL}/compare/${slug}`);
      canonicals.push(canonical as string);

      expect(await attr(page, 'meta[property="og:title"]', "content")).toBe(
        title,
      );
      expect(await attr(page, 'meta[property="og:url"]', "content")).toBe(
        canonical,
      );
      expect(
        await attr(page, 'meta[property="og:image"]', "content"),
        `${slug} og:image`,
      ).toMatch(new RegExp(`^${SITE_URL}/`));
      expect(
        await attr(page, 'meta[name="twitter:card"]', "content"),
      ).toBeTruthy();
      expect(await attr(page, 'meta[name="twitter:title"]', "content")).toBe(
        title,
      );
      expect(
        await attr(page, 'meta[name="twitter:image"]', "content"),
        `${slug} twitter:image`,
      ).toMatch(new RegExp(`^${SITE_URL}/`));
      expect(
        await attr(page, 'meta[name="description"]', "content"),
      ).toBeTruthy();

      const ld = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
      expect(ld.length, `${slug} json-ld count`).toBeGreaterThan(0);
      for (const raw of ld) {
        const parsed = JSON.parse(raw);
        expect(parsed["@context"], slug).toMatch(/schema\.org/);
        expect(parsed["@type"], slug).toBeTruthy();
      }
    }

    expect(new Set(titles).size).toBe(COMPETITORS.length);
    expect(new Set(canonicals).size).toBe(COMPETITORS.length);
    await snap("01-metadata-last-page");
  });

  test("@critical one <h1>, every comparison fact links to a source, a 'where they are stronger' section is visible, no 'measured' text", async ({
    page,
    baseURL,
    snap,
  }) => {
    await useLight(page);
    for (const slug of COMPETITORS) {
      await page.goto(originUrl(baseURL, `/compare/${slug}`));
      const main = page.getByRole("main");

      await expect(page.getByRole("heading", { level: 1 }), slug).toHaveCount(1);
      await expect(main.getByRole("heading", { level: 1 })).toBeVisible();

      const rows = main.locator("tbody tr");
      const rowCount = await rows.count();
      expect(rowCount, `${slug} fact rows`).toBeGreaterThan(0);
      for (let i = 0; i < rowCount; i++) {
        const link = rows.nth(i).getByRole("link", { name: /^Source for / });
        await expect(link, `${slug} row ${i} source`).toHaveCount(1);
        await expect(link).toHaveAttribute("href", /^https?:\/\/\S+/);
      }

      const stronger = main.getByRole("heading", {
        level: 2,
        name: "Where they are stronger",
      });
      await expect(stronger, slug).toBeVisible();
      const items = main
        .getByRole("region", { name: "Where they are stronger" })
        .getByRole("listitem");
      expect(await items.count(), `${slug} stronger items`).toBeGreaterThan(0);

      const text = await page.locator("body").innerText();
      expect(text, slug).not.toMatch(/measured/i);

      await stronger.scrollIntoViewIfNeeded();
      await snap(`02-${slug}`);
    }
  });

  test("@high /compare/unknown returns 404", async ({ request, baseURL }) => {
    const res = await request.get(originUrl(baseURL, "/compare/unknown"));
    expect(res.status()).toBe(404);
    expect(await res.text()).not.toContain('rel="canonical"');
  });

  for (const viewport of [
    { width: 375, height: 800 },
    { width: 1280, height: 800 },
  ]) {
    for (const theme of ["light", "dark"] as const) {
      test(`@medium ${viewport.width} px ${theme}: no horizontal scroll`, async ({
        page,
        baseURL,
        snap,
      }) => {
        await page.addInitScript((value) => {
          localStorage.setItem("theme", value);
        }, theme);
        await page.setViewportSize(viewport);

        for (const slug of COMPETITORS) {
          await page.goto(originUrl(baseURL, `/compare/${slug}`));
          await expect(page.locator("html")).toHaveClass(
            new RegExp(`\\b${theme}\\b`),
          );
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          expect(await horizontalOverflow(page), slug).toBeLessThanOrEqual(0);
        }
        await snap(`03-${viewport.width}-${theme}`);
      });
    }
  }
});
