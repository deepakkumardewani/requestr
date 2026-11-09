import { afterEach, describe, expect, it, vi } from "vitest";

import { isSensitiveHeaderKey } from "./constants";

async function loadSiteUrl() {
  vi.resetModules();
  const mod = await import("./constants");
  return mod.SITE_URL;
}

describe("SITE_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the production origin when the env var is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(await loadSiteUrl()).toBe("https://requestr-api.vercel.app");
  });

  it("uses NEXT_PUBLIC_SITE_URL when provided", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
    expect(await loadSiteUrl()).toBe("https://example.test");
  });

  it("strips a single trailing slash", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/");
    expect(await loadSiteUrl()).toBe("https://example.test");
  });

  it("strips multiple trailing slashes but keeps path segments", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/base///");
    expect(await loadSiteUrl()).toBe("https://example.test/base");
  });
});

describe("isSensitiveHeaderKey", () => {
  it.each(["Authorization", "  X-API-KEY ", "x-auth-token"])(
    "flags %j as sensitive regardless of case and padding",
    (key) => {
      expect(isSensitiveHeaderKey(key)).toBe(true);
    },
  );

  it.each(["Content-Type", "", "authorization-extra"])(
    "does not flag %j",
    (key) => {
      expect(isSensitiveHeaderKey(key)).toBe(false);
    },
  );
});
