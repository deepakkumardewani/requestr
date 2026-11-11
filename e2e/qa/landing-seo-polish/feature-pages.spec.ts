import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// Marketing routes live at the origin root; baseURL carries the /app basePath.
const DEFAULT_SITE_URL = "https://requestr-api.vercel.app";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(
  /\/+$/,
  "",
);

// Restated from SPEC section C: slug -> matching tool route (`/app` when no
// dedicated tool route exists). Not read from seoPages.ts.
const FEATURES = [
  { slug: "relay", cta: "/app" },
  { slug: "request-chains", cta: "/app" },
  { slug: "transform-playground", cta: "/transform" },
  { slug: "json-compare", cta: "/json-compare" },
  { slug: "json-visualize", cta: "/json-visualize" },
  { slug: "import", cta: "/import" },
  { slug: "collections-environments", cta: "/environments" },
  { slug: "command-palette", cta: "/app" },
  { slug: "backup-restore", cta: "/app" },
] as const;

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

// Scenarios 1 and 2 assert theme-independent content, so they pin the light theme.
const useLight = async (page: Page) =>
  page.addInitScript(() => localStorage.setItem("theme", "light"));

test.describe("Feature pages @qa", () => {
  test("@critical each of the 9 /features/<slug> routes returns 200 with a unique title, a canonical on one origin, OG/Twitter tags and a parseable JSON-LD script", async ({
    page,
    baseURL,
    snap,
  }) => {
    await useLight(page);
    const titles: string[] = [];
    const canonicals: string[] = [];

    for (const { slug } of FEATURES) {
      const res = await page.goto(originUrl(baseURL, `/features/${slug}`));
      expect(res?.status(), slug).toBe(200);

      const title = await page.title();
      expect(title.length, `${slug} title`).toBeGreaterThan(0);
      titles.push(title);

      const canonical = await attr(page, 'link[rel="canonical"]', "href");
      expect(canonical, `${slug} canonical`).toBe(
        `${SITE_URL}/features/${slug}`,
      );
      canonicals.push(canonical as string);

      expect(await attr(page, 'meta[property="og:title"]', "content")).toBe(
        title,
      );
      expect(
        await attr(page, 'meta[property="og:url"]', "content"),
        `${slug} og:url`,
      ).toBe(canonical);
      expect(
        await attr(page, 'meta[property="og:image"]', "content"),
        `${slug} og:image`,
      ).toMatch(new RegExp(`^${SITE_URL}/`));
      expect(
        await attr(page, 'meta[name="twitter:card"]', "content"),
      ).toBeTruthy();
      expect(
        await attr(page, 'meta[name="twitter:title"]', "content"),
      ).toBe(title);
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

    expect(new Set(titles).size).toBe(FEATURES.length);
    expect(new Set(canonicals).size).toBe(FEATURES.length);
    expect(new Set(canonicals.map((c) => new URL(c).origin))).toEqual(
      new Set([new URL(SITE_URL).origin]),
    );

    await snap("01-metadata-last-page");
  });

  test("@critical exactly one <h1>, an image with non-empty alt, a link to /features, a related-page link, and a CTA to the matching tool route", async ({
    page,
    baseURL,
    snap,
  }) => {
    await useLight(page);
    for (const { slug, cta } of FEATURES) {
      await page.goto(originUrl(baseURL, `/features/${slug}`));
      const main = page.getByRole("main");

      await expect(page.getByRole("heading", { level: 1 }), slug).toHaveCount(
        1,
      );
      await expect(main.getByRole("heading", { level: 1 })).toBeVisible();

      const alts = await main
        .locator("img")
        .evaluateAll((imgs) =>
          imgs.map((i) => (i.getAttribute("alt") ?? "").trim()),
        );
      expect(
        alts.filter(Boolean).length,
        `${slug} images with alt (${alts.length} imgs)`,
      ).toBeGreaterThan(0);

      await expect(
        main.locator('a[href="/features"]'),
        `${slug} hub link`,
      ).not.toHaveCount(0);

      const relatedLinks = main.locator(
        `a[href^="/features/"]:not([href="/features/${slug}"])`,
      );
      expect(await relatedLinks.count(), `${slug} related`).toBeGreaterThan(0);

      await expect(
        main.locator(`a[href="${cta}"]`).first(),
        `${slug} CTA ${cta}`,
      ).toBeVisible();

      await snap(`02-${slug}`);
    }
  });

  test("@high /features/not-a-page returns 404", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(originUrl(baseURL, "/features/not-a-page"));
    expect(res.status()).toBe(404);
    expect(await res.text()).not.toContain('rel="canonical"');
  });

  test.describe("JavaScript disabled", () => {
    test.use({ javaScriptEnabled: false });

    test("@high JavaScript disabled: content and metadata are still in the HTML", async ({
      page,
      baseURL,
      snap,
    }) => {
      for (const { slug, cta } of FEATURES) {
        await page.goto(originUrl(baseURL, `/features/${slug}`));

        await expect(page.getByRole("heading", { level: 1 }), slug).toHaveCount(
          1,
        );
        await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
        await expect(page.locator(`main a[href="${cta}"]`).first()).toBeVisible();
        await expect(page.locator('main a[href="/features"]').first()).toBeVisible();

        expect(await page.title(), slug).not.toBe("");
        expect(await attr(page, 'link[rel="canonical"]', "href")).toBe(
          `${SITE_URL}/features/${slug}`,
        );
        expect(
          await attr(page, 'meta[property="og:title"]', "content"),
        ).toBeTruthy();
        const ld = await page
          .locator('script[type="application/ld+json"]')
          .allTextContents();
        expect(ld.length).toBeGreaterThan(0);
        for (const raw of ld) expect(() => JSON.parse(raw)).not.toThrow();
      }
      await snap("04-no-js");
    });
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

        for (const { slug } of FEATURES) {
          await page.goto(originUrl(baseURL, `/features/${slug}`));
          await expect(page.locator("html")).toHaveClass(
            new RegExp(`\\b${theme}\\b`),
          );
          await expect(
            page.getByRole("heading", { level: 1 }),
          ).toBeVisible();
          expect(await horizontalOverflow(page), slug).toBeLessThanOrEqual(0);
        }
        await snap(`05-${viewport.width}-${theme}`);
      });
    }
  }
});
