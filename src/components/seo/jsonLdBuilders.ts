import type {
  ComparePage,
  FeaturePage,
} from "@/components/landing/data/seoPages";
import { SITE_URL } from "@/lib/constants";

const SCHEMA_CONTEXT = "https://schema.org";
const SITE_NAME = "Requestr";
const HUB_PATH = "/features";

export interface BreadcrumbItem {
  name: string;
  /** Relative path, e.g. "/features". */
  path: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export type JsonLdObject = Record<string, unknown>;

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

export function buildBreadcrumbList(items: readonly BreadcrumbItem[]) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildFeaturePageSchema(page: FeaturePage) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SoftwareApplication",
    name: `${SITE_NAME}: ${page.h1}`,
    description: page.description,
    url: absoluteUrl(page.route),
    image: absoluteUrl(page.screenshot.src),
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any (web browser)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function buildComparePageSchema(page: ComparePage) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: absoluteUrl(page.route),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
}

/** Only call this for a page that renders the same questions visibly. */
export function buildFaqPageSchema(entries: readonly FaqEntry[]) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/** Breadcrumb trail for a page that sits under the features hub. */
export function buildPageBreadcrumbs(
  page: Pick<FeaturePage | ComparePage, "route" | "h1">,
): BreadcrumbItem[] {
  return [
    { name: SITE_NAME, path: "/" },
    { name: "Features", path: HUB_PATH },
    { name: page.h1, path: page.route },
  ];
}
