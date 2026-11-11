import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// Marketing routes live at the origin root; baseURL carries the /app basePath.
const DEFAULT_SITE_URL = "https://requestr-api.vercel.app";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(
  /\/+$/,
  "",
);

// Restated from SPEC section C, not imported from the data under test.
const FEATURE_ROUTES = [
  "/features/relay",
  "/features/request-chains",
  "/features/transform-playground",
  "/features/json-compare",
  "/features/json-visualize",
  "/features/import",
  "/features/collections-environments",
  "/features/command-palette",
  "/features/backup-restore",
];
const COMPARE_ROUTES = ["/compare/postman", "/compare/insomnia"];
const SEO_ROUTES = [...FEATURE_ROUTES, ...COMPARE_ROUTES];
const BASE_ROUTES = ["/", "/features", "/privacy", "/terms"];
const EXPECTED_SITEMAP_PATHS = ["", "/features", "/privacy", "/terms"]
  .concat(SEO_ROUTES)
  .sort();

const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

const useLight = async (page: Page) =>
  page.addInitScript(() => localStorage.setItem("theme", "light"));

const hrefsIn = (page: Page, scope: string) =>
  page
    .locator(`${scope} a[href]`)
    .evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? ""),
    );

test.describe("Hub, footer and link check @qa", () => {
  test("@critical /features links to all 9 feature pages and both compare pages, each reachable by click", async ({
    page,
    baseURL,
    snap,
  }) => {
    await useLight(page);
    const hub = originUrl(baseURL, "/features");
    await page.goto(hub);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await snap("hub");

    const hubHrefs = await hrefsIn(page, "main");
    expect(SEO_ROUTES).toHaveLength(11);
    for (const route of SEO_ROUTES) {
      expect(hubHrefs, `hub links ${route}`).toContain(route);
    }

    for (const route of SEO_ROUTES) {
      await page.goto(hub);
      await page.locator(`main a[href="${route}"]`).first().click();
      await expect(page).toHaveURL(
        new RegExp(`${route.replace(/\//g, "\\/")}/?$`),
      );
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("@critical footer on / has Features and Compare columns and every link returns 200", async ({
    page,
    request,
    baseURL,
    snap,
  }) => {
    await useLight(page);
    await page.goto(originUrl(baseURL, "/"));
    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByText("Features", { exact: true })).toBeVisible();
    await expect(footer.getByText("Compare", { exact: true })).toBeVisible();
    await snap("footer");

    const hrefs = await hrefsIn(page, "footer");
    for (const route of ["/features", ...SEO_ROUTES]) {
      expect(hrefs, `footer links ${route}`).toContain(route);
    }

    const internal = [
      ...new Set(hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//"))),
    ];
    expect(internal.length).toBeGreaterThan(11);
    for (const href of internal) {
      const res = await request.get(originUrl(baseURL, href));
      expect(res.status(), href).toBe(200);
    }
  });

  test("@high crawl: every internal link on /, /features, the 11 SEO pages, /privacy and /terms resolves to a non-404", async ({
    page,
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL as string).origin;
    const pages = [...BASE_ROUTES, ...SEO_ROUTES];
    const links = new Set<string>();

    for (const route of pages) {
      const res = await page.goto(originUrl(baseURL, route));
      expect(res?.status(), `page ${route}`).toBe(200);
      for (const raw of await hrefsIn(page, "body")) {
        const url = new URL(raw, originUrl(baseURL, route));
        if (url.origin !== origin) continue;
        links.add(url.pathname + url.search);
      }
    }

    // Non-vacuity: the crawl must have found the known routes among its links.
    expect(links.size).toBeGreaterThan(pages.length);
    for (const route of [...SEO_ROUTES, "/features", "/privacy", "/terms"]) {
      expect(links.has(route), `crawl saw ${route}`).toBe(true);
    }

    for (const link of links) {
      const res = await request.get(`${origin}${link}`);
      expect(res.status(), link).toBeLessThan(400);
    }
  });

  test("@high /sitemap.xml lists every one of the 11 SEO routes plus the base routes and no others", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(originUrl(baseURL, "/sitemap.xml"));
    expect(res.status()).toBe(200);
    const body = await res.text();
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect(locs).toHaveLength(15);
    expect([...locs].sort()).toEqual(
      EXPECTED_SITEMAP_PATHS.map((p) => `${SITE_URL}${p}`).sort(),
    );
  });
});
