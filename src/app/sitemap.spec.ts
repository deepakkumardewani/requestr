import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DEFAULT_ORIGIN = "https://requestr-api.vercel.app";

const EXPECTED_ROUTES = [
  "/",
  "/features",
  "/privacy",
  "/terms",
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
];

async function loadSitemap() {
  vi.resetModules();
  const mod = await import("./sitemap");
  return mod.default();
}

describe("sitemap", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists exactly the expected routes, in order, and nothing else", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const urls = (await loadSitemap()).map((entry) => entry.url);

    const expected = EXPECTED_ROUTES.map((route) =>
      route === "/" ? DEFAULT_ORIGIN : `${DEFAULT_ORIGIN}${route}`,
    );
    expect(urls).toEqual(expected);
  });

  it("emits only absolute https URLs with no duplicates", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const urls = (await loadSitemap()).map((entry) => entry.url);

    expect(urls.every((url) => url.startsWith("https://"))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("reflects a NEXT_PUBLIC_SITE_URL override after module reset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/");
    const urls = (await loadSitemap()).map((entry) => entry.url);

    expect(urls[0]).toBe("https://example.test");
    expect(urls).toContain("https://example.test/features/relay");
    expect(urls.some((url) => url.includes(DEFAULT_ORIGIN))).toBe(false);
    expect(urls.some((url) => url.includes("//features"))).toBe(false);
  });
});
