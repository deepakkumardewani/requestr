import type { Feature } from "../../data/features";

export const DEFAULT_CATEGORY = "More";

export interface FeatureGroup {
  category: string;
  features: Feature[];
}

export interface PlacedFeature {
  feature: Feature;
  /** Spans the full row of the two-column bento grid. */
  wide: boolean;
}

/** Groups keep their first-seen order, so the hub reads in the catalogue's order. */
export function groupByCategory(features: readonly Feature[]): FeatureGroup[] {
  const groups = new Map<string, Feature[]>();
  for (const feature of features) {
    const category = feature.category ?? DEFAULT_CATEGORY;
    groups.set(category, [...(groups.get(category) ?? []), feature]);
  }
  return [...groups].map(([category, items]) => ({
    category,
    features: items,
  }));
}

/** Category names contain spaces, which are invalid in an id, so slugify them. */
export function groupHeadingId(category: string): string {
  const slug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `group-${slug}`;
}

/**
 * Cards with a live preview go wide and lead the group; the rest pair up.
 * An odd one out also goes wide so the two-column grid never leaves a hole.
 */
export function placeGroup(features: readonly Feature[]): PlacedFeature[] {
  const showcased = features.filter((feature) => feature.preview);
  const compact = features.filter((feature) => !feature.preview);
  const lastCompact = compact.length % 2 === 1 ? compact.length - 1 : -1;
  return [
    ...showcased.map((feature) => ({ feature, wide: true })),
    ...compact.map((feature, index) => ({
      feature,
      wide: index === lastCompact,
    })),
  ];
}
