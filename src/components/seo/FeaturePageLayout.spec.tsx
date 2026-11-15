/** @vitest-environment happy-dom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  FEATURE_PAGES,
  type FeaturePage,
} from "@/components/landing/data/seoPages";
import { FeaturePageLayout } from "./FeaturePageLayout";

vi.mock("@/components/landing/nav/LandingNav", () => ({
  LandingNav: () => <nav data-testid="nav" />,
}));
// next/dynamic never resolves under renderToStaticMarkup, so stand each demo in.
vi.mock("@/components/landing/features/demos/registry", () => ({
  getFeatureDemo: (slug: string) =>
    function DemoDouble() {
      return <div data-testid="demo" data-slug={slug} />;
    },
}));
vi.mock("@/components/landing/Footer", () => ({
  Footer: () => <footer data-testid="footer" />,
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // biome-ignore lint/performance/noImgElement: test double for next/image
    <img src={src} alt={alt} />
  ),
}));

function render(page: FeaturePage): Document {
  return new DOMParser().parseFromString(
    `<body>${renderToStaticMarkup(<FeaturePageLayout page={page} />)}</body>`,
    "text/html",
  );
}

const JSON_COMPARE = FEATURE_PAGES.find((p) => p.slug === "json-compare");
if (!JSON_COMPARE) throw new Error("json-compare fixture missing");

describe("FeaturePageLayout", () => {
  it.each(FEATURE_PAGES.map((p) => [p.slug, p] as const))(
    "%s renders exactly one h1 with the page heading",
    (_slug, page) => {
      const h1s = render(page).querySelectorAll("h1");
      expect(h1s).toHaveLength(1);
      expect(h1s[0].textContent).toBe(page.h1);
    },
  );

  it("renders the dark capture of the screenshot with its alt text", () => {
    const img = render(JSON_COMPARE).querySelector("main img");
    expect(img?.getAttribute("alt")).toBe(JSON_COMPARE.screenshot.alt);
    expect(img?.getAttribute("src")).toBe(
      JSON_COMPARE.screenshot.src.replace("-light.", "-dark."),
    );
  });

  it.each(FEATURE_PAGES.map((p) => [p.slug] as const))(
    "%s renders its registered demo inside the demo section",
    (slug) => {
      const page = FEATURE_PAGES.find((p) => p.slug === slug) as FeaturePage;
      const demo = render(page).querySelector('#feature-demo [data-testid="demo"]');
      expect(demo?.getAttribute("data-slug")).toBe(slug);
    },
  );

  it("renders the how-it-works steps and capability cards", () => {
    const doc = render(JSON_COMPARE);
    expect(doc.querySelectorAll("#feature-how ol > li").length).toBeGreaterThanOrEqual(3);
    expect(doc.querySelectorAll("#feature-capabilities h3").length).toBeGreaterThanOrEqual(2);
    expect(doc.querySelector("#feature-cta h2")).not.toBeNull();
  });

  it("throws for a page with no registered details", () => {
    expect(() => render({ ...JSON_COMPARE, slug: "unknown" })).toThrow(/unknown/);
  });

  it("links back to the features hub", () => {
    const hub = [...render(JSON_COMPARE).querySelectorAll("a")].find(
      (a) => a.getAttribute("href") === "/features",
    );
    expect(hub?.textContent).toBe("All features");
  });

  it("links the CTA to the matching tool route with the page's label", () => {
    const cta = [...render(JSON_COMPARE).querySelectorAll("header a")].find(
      (a) => a.getAttribute("href") === "/json-compare",
    );
    // The shared CTA trails a decorative arrow after the label.
    expect(cta?.textContent?.startsWith(JSON_COMPARE.cta.label)).toBe(true);
  });

  it("links to each related feature page by its heading, then the next one", () => {
    const links = [...render(JSON_COMPARE).querySelectorAll("#feature-related a")];
    const related = ["json-visualize", "transform-playground", "relay"];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      ...related.map((slug) => `/features/${slug}`),
      "/features/import",
    ]);
    related.forEach((slug, index) => {
      const h1 = FEATURE_PAGES.find((p) => p.slug === slug)?.h1 ?? "";
      expect(links[index].textContent).toContain(h1);
    });
  });

  it("emits a FAQ-free WebPage JSON-LD and a BreadcrumbList JSON-LD script", () => {
    const scripts = [
      ...render(JSON_COMPARE).querySelectorAll(
        'script[type="application/ld+json"]',
      ),
    ].map((s) => JSON.parse(s.textContent ?? ""));
    expect(scripts).toHaveLength(2);
    expect(scripts.map((s) => s["@type"]).sort()).toContain("BreadcrumbList");
    expect(JSON.stringify(scripts[0])).toContain(JSON_COMPARE.route);
  });

  it("renders the intro in the header and remaining paragraphs below", () => {
    const doc = render(JSON_COMPARE);
    const [intro, ...rest] = JSON_COMPARE.body;
    const headerParagraphs = [...doc.querySelectorAll("main header p")].map(
      (p) => p.textContent,
    );
    expect(headerParagraphs).toContain(intro);
    const paragraphs = [...doc.querySelectorAll("#feature-demo p")].map(
      (p) => p.textContent,
    );
    expect(paragraphs).toEqual(expect.arrayContaining([...rest]));
  });

  it("wraps content in the site Nav and Footer", () => {
    const doc = render(JSON_COMPARE);
    expect(doc.querySelector('[data-testid="nav"]')).not.toBeNull();
    expect(doc.querySelector('[data-testid="footer"]')).not.toBeNull();
    expect(doc.querySelector("main#app-main")).not.toBeNull();
  });

  it("omits the related section when no related slug resolves", () => {
    const doc = render({ ...JSON_COMPARE, related: ["does-not-exist"] });
    expect(doc.querySelector("#related-heading")).toBeNull();
  });
});
