import { describe, expect, it, vi } from "vitest";
import type {
  ComparePage,
  FeaturePage,
} from "@/components/landing/data/seoPages";
import {
  absoluteUrl,
  buildBreadcrumbList,
  buildComparePageSchema,
  buildFaqPageSchema,
  buildFeaturePageSchema,
  buildPageBreadcrumbs,
} from "./jsonLdBuilders";

vi.mock("@/lib/constants", () => ({ SITE_URL: "https://example.test" }));

const ORIGIN = "https://example.test";

const FEATURE: FeaturePage = {
  slug: "relay",
  route: "/features/relay",
  title: "Relay title",
  description: "Relay description",
  h1: "Relay heading",
  screenshot: { src: "/screens/relay.webp", alt: "alt" },
  cta: { href: "/app", label: "Open" },
  body: ["intro"],
  related: [],
};

const COMPARE: ComparePage = {
  slug: "postman",
  route: "/compare/postman",
  title: "Requestr vs Postman",
  description: "Compare description",
  h1: "Requestr vs Postman",
  screenshot: { src: "/screens/x.webp", alt: "alt" },
  cta: { href: "/app", label: "Open" },
  body: ["intro"],
  related: [],
  strongerNotes: [],
};

function roundTrip(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

describe("absoluteUrl", () => {
  it("prefixes a path with the site origin", () => {
    expect(absoluteUrl("/features")).toBe(`${ORIGIN}/features`);
  });
});

describe("buildBreadcrumbList", () => {
  it("emits ordered 1-based positions with absolute URLs", () => {
    const result = buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Features", path: "/features" },
    ]);
    expect(roundTrip(result)).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
        {
          "@type": "ListItem",
          position: 2,
          name: "Features",
          item: `${ORIGIN}/features`,
        },
      ],
    });
  });

  it("returns an empty list for no items", () => {
    expect(buildBreadcrumbList([]).itemListElement).toEqual([]);
  });
});

describe("buildPageBreadcrumbs", () => {
  it("builds home, features hub, then the page", () => {
    expect(buildPageBreadcrumbs(FEATURE)).toEqual([
      { name: "Requestr", path: "/" },
      { name: "Features", path: "/features" },
      { name: "Relay heading", path: "/features/relay" },
    ]);
  });

  it("feeds a breadcrumb list in the same order", () => {
    const names = buildBreadcrumbList(buildPageBreadcrumbs(COMPARE))
      .itemListElement.map((i) => i.name);
    expect(names).toEqual(["Requestr", "Features", "Requestr vs Postman"]);
  });
});

describe("buildFeaturePageSchema", () => {
  it("describes a free web SoftwareApplication with absolute urls", () => {
    expect(roundTrip(buildFeaturePageSchema(FEATURE))).toEqual({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Requestr: Relay heading",
      description: "Relay description",
      url: `${ORIGIN}/features/relay`,
      image: `${ORIGIN}/screens/relay.webp`,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any (web browser)",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
  });
});

describe("buildComparePageSchema", () => {
  it("describes a WebPage that is part of the site", () => {
    expect(roundTrip(buildComparePageSchema(COMPARE))).toEqual({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Requestr vs Postman",
      description: "Compare description",
      url: `${ORIGIN}/compare/postman`,
      isPartOf: { "@type": "WebSite", name: "Requestr", url: ORIGIN },
    });
  });
});

describe("buildFaqPageSchema", () => {
  it("emits exactly the entries it is given, in order", () => {
    const result = buildFaqPageSchema([
      { question: "Q1?", answer: "A1" },
      { question: "Q2?", answer: "A2" },
    ]);
    expect(roundTrip(result)).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Q1?",
          acceptedAnswer: { "@type": "Answer", text: "A1" },
        },
        {
          "@type": "Question",
          name: "Q2?",
          acceptedAnswer: { "@type": "Answer", text: "A2" },
        },
      ],
    });
  });

  it("emits no questions when there is no visible FAQ", () => {
    expect(buildFaqPageSchema([]).mainEntity).toEqual([]);
  });
});
