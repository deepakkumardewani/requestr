import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_SEO_ROUTES,
  COMPARE_PAGES,
  FEATURE_PAGES,
  getComparePage,
  getFeaturePage,
} from "./seoPages";

const ALL_PAGES = [...FEATURE_PAGES, ...COMPARE_PAGES];
const FEATURE_SLUGS = [
  "relay",
  "request-chains",
  "transform-playground",
  "json-compare",
  "json-visualize",
  "import",
  "collections-environments",
  "command-palette",
  "backup-restore",
];
const COMPARE_SLUGS = ["postman", "insomnia"];
const KNOWN_CTA_TARGETS = [
  "/app",
  "/json-compare",
  "/json-visualize",
  "/transform",
  "/import",
  "/environments",
];
const BANNED_TERMS = [
  "cards",
  "undone",
  "seamlessly",
  "leverage",
  "unlock",
  "supercharge",
  "measured",
];
const INTERNAL_NAMES = [/\bFR-\d+/i, /\bscenario\b/i, /\bengine\b/i, /\bmock\b/i];
const DOMAIN_PATTERN = /https?:\/\/|www\.|\.(com|dev|app|io|net|org)\b/i;

function allCopy(page: (typeof ALL_PAGES)[number]): string {
  const notes = "strongerNotes" in page ? page.strongerNotes : [];
  return [
    page.title,
    page.description,
    page.h1,
    page.screenshot.alt,
    page.cta.label,
    ...page.body,
    ...notes,
  ].join("\n");
}

describe("seoPages data", () => {
  it("defines the expected feature and compare slugs", () => {
    expect(FEATURE_PAGES.map((p) => p.slug)).toEqual(FEATURE_SLUGS);
    expect(COMPARE_PAGES.map((p) => p.slug)).toEqual(COMPARE_SLUGS);
  });

  it("has unique slugs and routes", () => {
    const routes = ALL_PAGES.map((p) => p.route);
    expect(new Set(FEATURE_PAGES.map((p) => p.slug)).size).toBe(
      FEATURE_PAGES.length,
    );
    expect(new Set(COMPARE_PAGES.map((p) => p.slug)).size).toBe(
      COMPARE_PAGES.length,
    );
    expect(new Set(routes).size).toBe(routes.length);
  });

  it.each(ALL_PAGES.map((p) => [p.route, p] as const))(
    "%s has metadata within length limits",
    (_route, page) => {
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeGreaterThanOrEqual(120);
      expect(page.description.length).toBeLessThanOrEqual(160);
      expect(page.h1.length).toBeGreaterThan(0);
      expect(page.body.length).toBeGreaterThan(0);
    },
  );

  it("builds each route from its section and slug", () => {
    for (const page of FEATURE_PAGES) {
      expect(page.route).toBe(`/features/${page.slug}`);
    }
    for (const page of COMPARE_PAGES) {
      expect(page.route).toBe(`/compare/${page.slug}`);
    }
  });

  it.each(ALL_PAGES.map((p) => [p.route, p] as const))(
    "%s has related slugs that resolve to feature pages, not itself",
    (_route, page) => {
      expect(page.related.length).toBeGreaterThan(0);
      for (const slug of page.related) {
        expect(FEATURE_SLUGS).toContain(slug);
        expect(slug).not.toBe(page.slug);
      }
    },
  );

  it("points every CTA at a known app route", () => {
    for (const page of ALL_PAGES) {
      expect(KNOWN_CTA_TARGETS).toContain(page.cta.href);
      expect(page.cta.label.length).toBeGreaterThan(0);
    }
  });

  it("uses the matching tool route as the CTA for tool pages", () => {
    const ctaBySlug = Object.fromEntries(
      FEATURE_PAGES.map((p) => [p.slug, p.cta.href]),
    );
    expect(ctaBySlug["json-compare"]).toBe("/json-compare");
    expect(ctaBySlug["json-visualize"]).toBe("/json-visualize");
    expect(ctaBySlug["transform-playground"]).toBe("/transform");
    expect(ctaBySlug.import).toBe("/import");
    expect(ctaBySlug["collections-environments"]).toBe("/environments");
  });

  it("has a screenshot with a root-relative src and alt text on every page", () => {
    for (const page of ALL_PAGES) {
      expect(page.screenshot.src).toMatch(/^\/(screens|media\/relay)\/.+\.webp$/);
      expect(page.screenshot.alt.length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_PAGES.map((p) => [p.route, p] as const))(
    "%s screenshot file and its dark twin exist in public/",
    (_route, page) => {
      const publicFile = (src: string) =>
        path.join(process.cwd(), "public", src);
      expect(existsSync(publicFile(page.screenshot.src))).toBe(true);
      const dark = page.screenshot.src.replace("-light.", "-dark.");
      expect(existsSync(publicFile(dark))).toBe(true);
    },
  );

  it("lists every page route in ALL_SEO_ROUTES and nothing else", () => {
    expect([...ALL_SEO_ROUTES].sort()).toEqual(
      [
        ...FEATURE_SLUGS.map((s) => `/features/${s}`),
        ...COMPARE_SLUGS.map((s) => `/compare/${s}`),
      ].sort(),
    );
  });

  it("gives every compare page honest notes on where the other tool is stronger", () => {
    for (const page of COMPARE_PAGES) {
      expect(page.strongerNotes.length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_PAGES.map((p) => [p.route, p] as const))(
    "%s copy has no banned terms, internal names or domains",
    (_route, page) => {
      const copy = allCopy(page);
      for (const term of BANNED_TERMS) {
        expect(copy.toLowerCase()).not.toMatch(new RegExp(`\\b${term}\\b`));
      }
      for (const pattern of INTERNAL_NAMES) {
        expect(copy).not.toMatch(pattern);
      }
      expect(copy).not.toMatch(DOMAIN_PATTERN);
    },
  );

  describe("getFeaturePage / getComparePage", () => {
    it("returns the page for a known slug", () => {
      expect(getFeaturePage("relay")?.route).toBe("/features/relay");
      expect(getComparePage("postman")?.route).toBe("/compare/postman");
    });

    it("returns undefined for unknown or cross-section slugs", () => {
      expect(getFeaturePage("nope")).toBeUndefined();
      expect(getFeaturePage("postman")).toBeUndefined();
      expect(getComparePage("relay")).toBeUndefined();
      expect(getComparePage("")).toBeUndefined();
    });
  });
});
