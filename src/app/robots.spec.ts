import { afterEach, describe, expect, it, vi } from "vitest";

async function loadRobots() {
  vi.resetModules();
  const mod = await import("./robots");
  return mod.default();
}

describe("robots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows the site and disallows /api/ for all agents", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const result = await loadRobots();

    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    });
  });

  it("references the absolute sitemap URL on the default origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const result = await loadRobots();

    expect(result.sitemap).toBe("https://requestr-api.vercel.app/sitemap.xml");
  });

  it("follows the NEXT_PUBLIC_SITE_URL override", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/");
    const result = await loadRobots();

    expect(result.sitemap).toBe("https://example.test/sitemap.xml");
  });
});
