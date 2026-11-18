import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
} from "../../constants";
import { type FeaturePage, getFeaturePage } from "../../data/seoPages";
import { getFeatureDetail } from "../data/featureDetails";
import { nextFeatureSlug } from "../data/featurePageModel";
import { FEATURE_SECTION_IDS, RELATED_HEADING_ID } from "./pageConstants";

const HEADING = "Related features";
const NEXT_LABEL = "Next feature";
const CARD_CLASS =
  "group flex h-full flex-col justify-between gap-6 rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-[var(--landing-accent)]/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function RelatedCard({ page, label }: { page: FeaturePage; label?: string }) {
  return (
    <Link href={page.route} className={CARD_CLASS}>
      <span className="font-mono text-xs text-muted-foreground">
        {label ?? getFeatureDetail(page.slug)?.eyebrow}
      </span>
      <span className="flex items-end justify-between gap-4">
        <span className="text-balance font-display text-lg font-semibold text-foreground">
          {page.h1}
        </span>
        <span
          aria-hidden="true"
          className="text-[var(--landing-accent)] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none"
        >
          →
        </span>
      </span>
    </Link>
  );
}

/** Pages worth reading next, plus the one after this in the feature order. */
export function FeatureRelated({ page }: { page: FeaturePage }) {
  const related = page.related.flatMap((slug) => getFeaturePage(slug) ?? []);
  if (related.length === 0) return null;
  const nextSlug = nextFeatureSlug(page.slug, page.related);
  const next = nextSlug ? getFeaturePage(nextSlug) : undefined;

  return (
    <section
      id={FEATURE_SECTION_IDS.related}
      aria-labelledby={RELATED_HEADING_ID}
      className={cn(SECTION_PADDING, SECTION_DIVIDER)}
    >
      <div className={SECTION_CONTAINER}>
        <h2
          id={RELATED_HEADING_ID}
          className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          {HEADING}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {related.map((feature) => (
            <li key={feature.slug}>
              <RelatedCard page={feature} />
            </li>
          ))}
        </ul>
        {next ? (
          <div className="mt-4">
            <RelatedCard page={next} label={NEXT_LABEL} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
