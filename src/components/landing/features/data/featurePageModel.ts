import { toDarkSource } from "@/components/seo/FeatureMedia";
import {
  FEATURE_PAGES,
  type FeaturePage,
  type FeatureSlug,
} from "../../data/seoPages";
import type { FeatureDetail, FeatureHeroMedia } from "./featureDetails";

export interface SplitHeadline {
  lead: string;
  highlight: string;
  tail: string;
}

/**
 * Splits an h1 around the phrase drawn with the accent gradient. A phrase that
 * is not in the h1 leaves it whole, so a copy edit never drops words.
 */
export function splitHeadline(h1: string, highlight: string): SplitHeadline {
  const start = highlight ? h1.indexOf(highlight) : -1;
  if (start === -1) return { lead: h1, highlight: "", tail: "" };
  return {
    lead: h1.slice(0, start),
    highlight,
    tail: h1.slice(start + highlight.length),
  };
}

/**
 * The page after this one in FEATURE_PAGES order, wrapping at the end, skipping
 * slugs already linked as related so the "next" card never repeats one.
 */
export function nextFeatureSlug(
  slug: string,
  related: readonly string[],
): FeatureSlug | null {
  const slugs: readonly FeatureSlug[] = FEATURE_PAGES.map((page) => page.slug);
  const start = slugs.indexOf(slug as FeatureSlug);
  if (start === -1) return null;
  for (let step = 1; step < slugs.length; step += 1) {
    const candidate = slugs[(start + step) % slugs.length];
    if (!related.includes(candidate)) return candidate;
  }
  return null;
}

/** Feature pages are always dark, so the hero shows the dark capture. */
export function heroMedia(
  page: FeaturePage,
  detail: FeatureDetail,
): FeatureHeroMedia {
  return (
    detail.hero ?? {
      src: toDarkSource(page.screenshot.src),
      alt: page.screenshot.alt,
    }
  );
}
