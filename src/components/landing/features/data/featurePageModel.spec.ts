import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_PAGES, getFeaturePage } from "../../data/seoPages";
import { FEATURE_DETAILS } from "./featureDetails";
import { heroMedia, nextFeatureSlug, splitHeadline } from "./featurePageModel";

describe("splitHeadline", () => {
  it("splits the h1 around the highlighted phrase", () => {
    expect(splitHeadline("Diff two payloads fast", "two payloads")).toEqual({
      lead: "Diff ",
      highlight: "two payloads",
      tail: " fast",
    });
  });

  it("keeps the h1 whole when the phrase is missing or empty", () => {
    const whole = { lead: "Diff fast", highlight: "", tail: "" };
    expect(splitHeadline("Diff fast", "nope")).toEqual(whole);
    expect(splitHeadline("Diff fast", "")).toEqual(whole);
  });

  it.each(FEATURE_PAGES.map((page) => [page.slug, page.h1] as const))(
    "finds the %s highlight in its h1",
    (slug, h1) => {
      const parts = splitHeadline(h1, FEATURE_DETAILS[slug].highlight);
      expect(parts.highlight).not.toBe("");
      expect(parts.lead + parts.highlight + parts.tail).toBe(h1);
    },
  );
});

describe("nextFeatureSlug", () => {
  const slugs = FEATURE_PAGES.map((page) => page.slug);

  it("returns the following page", () => {
    expect(nextFeatureSlug(slugs[0], [])).toBe(slugs[1]);
  });

  it("wraps from the last page to the first", () => {
    expect(nextFeatureSlug(slugs[slugs.length - 1], [])).toBe(slugs[0]);
  });

  it("skips pages already linked as related", () => {
    expect(nextFeatureSlug(slugs[0], [slugs[1]])).toBe(slugs[2]);
  });

  it("returns null for an unknown slug or when every other page is related", () => {
    expect(nextFeatureSlug("nope", [])).toBeNull();
    expect(nextFeatureSlug(slugs[0], slugs.slice(1))).toBeNull();
  });
});

describe("heroMedia", () => {
  it("prefers the detail's own hero capture", () => {
    const page = getFeaturePage("relay");
    if (!page) throw new Error("relay page missing");
    expect(heroMedia(page, FEATURE_DETAILS.relay)).toBe(FEATURE_DETAILS.relay.hero);
  });

  it("falls back to the dark capture of the page screenshot and its alt", () => {
    const page = getFeaturePage("json-compare");
    if (!page) throw new Error("json-compare page missing");
    const media = heroMedia(page, { ...FEATURE_DETAILS["json-compare"], hero: undefined });
    expect(media).toEqual({
      src: page.screenshot.src.replace("-light.", "-dark."),
      alt: page.screenshot.alt,
    });
  });

  it.each(FEATURE_PAGES.map((page) => [page.slug, page] as const))(
    "points the %s hero at a dark capture",
    (slug, page) => {
      const { src } = heroMedia(page, FEATURE_DETAILS[slug]);
      expect(src).toMatch(/-dark\.webp$/);
      expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
    },
  );
});
