import { describe, expect, it } from "vitest";
import { RELAY_TOOL_SCHEMAS } from "@/lib/relay/tools/schemas";
import { FEATURE_PAGES } from "../../data/seoPages";
import { FEATURE_DETAILS, getFeatureDetail } from "./featureDetails";

const SLUGS = FEATURE_PAGES.map((page) => page.slug);

describe("FEATURE_DETAILS", () => {
  it("has exactly one entry per feature page", () => {
    expect(Object.keys(FEATURE_DETAILS).sort()).toEqual([...SLUGS].sort());
  });

  it.each(SLUGS)("gives %s steps, capabilities and a closing line", (slug) => {
    const detail = FEATURE_DETAILS[slug];
    expect(detail.steps.length).toBeGreaterThanOrEqual(3);
    expect(detail.capabilities.length).toBeGreaterThanOrEqual(2);
    expect(new Set(detail.capabilities.map((c) => c.id)).size).toBe(detail.capabilities.length);
    expect(detail.closing.headline).not.toBe("");
  });

  it.each(SLUGS)("names only real Relay tools on %s", (slug) => {
    const tools = FEATURE_DETAILS[slug].relay?.tools ?? [];
    for (const tool of tools) expect(Object.hasOwn(RELAY_TOOL_SCHEMAS, tool)).toBe(true);
  });
});

describe("getFeatureDetail", () => {
  it("resolves a known slug and rejects unknown or inherited keys", () => {
    expect(getFeatureDetail("json-compare")).toBe(FEATURE_DETAILS["json-compare"]);
    expect(getFeatureDetail("nope")).toBeUndefined();
    expect(getFeatureDetail("toString")).toBeUndefined();
  });
});
