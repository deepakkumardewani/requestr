import { describe, expect, it } from "vitest";
import { FEATURE_PAGES } from "../../data/seoPages";
import { FEATURE_DEMOS, getFeatureDemo } from "./registry";

describe("FEATURE_DEMOS", () => {
  it("registers a demo for every feature page and nothing else", () => {
    expect(Object.keys(FEATURE_DEMOS).sort()).toEqual(FEATURE_PAGES.map((page) => page.slug).sort());
  });

  it.each(FEATURE_PAGES.map((page) => page.slug))("resolves the %s demo", (slug) => {
    expect(getFeatureDemo(slug)).toBe(FEATURE_DEMOS[slug]);
  });

  it("returns undefined for unknown or inherited keys", () => {
    expect(getFeatureDemo("nope")).toBeUndefined();
    expect(getFeatureDemo("constructor")).toBeUndefined();
  });
});
