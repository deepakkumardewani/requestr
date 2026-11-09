import { expect, test } from "../../fixtures/qa";

// The app is served behind a /app basePath proxy (baseURL = <origin>/app), but
// the marketing root (/, /sitemap.xml, /robots.txt, /og-image.png) lives at the
// origin root, so every request here resolves against the origin, not baseURL.
const DEFAULT_SITE_URL = "https://requestr-api.vercel.app";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(
  /\/+$/,
  "",
);

// Restated from SPEC section C (sitemap criterion 10), not read from the sitemap under test.
const EXPECTED_PATHS = [
  "",
  "/features",
  "/features/relay",
  "/features/request-chains",
  "/features/transform-playground",
  "/features/json-compare",
  "/features/json-visualize",
  "/features/import",
  "/features/collections-environments",
  "/features/command-palette",
  "/features/backup-restore",
  "/compare/postman",
  "/compare/insomnia",
  "/privacy",
  "/terms",
];

test.describe("Landing site plumbing @qa", () => {
  test.beforeEach(({ baseURL }) => {
    expect(baseURL).toBeTruthy();
  });

  const originUrl = (baseURL: string | undefined, path: string) =>
    new URL(path, new URL(baseURL as string).origin).toString();

  test("@critical /sitemap.xml returns 200 XML listing exactly the 15 expected routes", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(originUrl(baseURL, "/sitemap.xml"));
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");

    const body = await res.text();
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const expected = EXPECTED_PATHS.map((p) => `${SITE_URL}${p}`);

    expect(locs).toHaveLength(15);
    expect([...locs].sort()).toEqual([...expected].sort());
    expect(locs.some((l) => /\/(app|api)(\/|$)/.test(l))).toBe(false);
  });

  test("@critical /robots.txt returns 200, disallows /api/, references the sitemap", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(originUrl(baseURL, "/robots.txt"));
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");

    const body = await res.text();
    expect(body).toMatch(/^User-Agent:\s*\*/im);
    expect(body).toMatch(/^Disallow:\s*\/api\/\s*$/m);
    expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });

  test("@high / has a canonical link, og:url, og:image and absolute URLs on one origin", async ({
    page,
    baseURL,
    snap,
  }) => {
    await page.goto(originUrl(baseURL, "/"));

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    const ogUrl = await page
      .locator('meta[property="og:url"]')
      .getAttribute("content");
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    const twitterImage = await page
      .locator('meta[name="twitter:image"]')
      .getAttribute("content");

    expect(canonical).toBe(SITE_URL);
    expect(ogUrl).toBe(SITE_URL);
    expect(ogImage).toBe(`${SITE_URL}/og-image.png`);
    expect(twitterImage).toBe(`${SITE_URL}/og-image.png`);

    const origins = [canonical, ogUrl, ogImage, twitterImage].map(
      (u) => new URL(u as string).origin,
    );
    expect(new Set(origins)).toEqual(new Set([new URL(SITE_URL).origin]));

    await snap("01-home-meta");
  });

  test("@medium /og-image.png returns 200 as an image", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(originUrl(baseURL, "/og-image.png"));
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^image\/png/);
    expect((await res.body()).byteLength).toBeGreaterThan(1000);
  });
});
