import Link from "next/link";
import {
  SECTION_CONTAINER,
  SECTION_EYEBROW,
  SECTION_HEADING,
} from "@/components/landing/constants";
import {
  type FeaturePage,
  getFeaturePage,
} from "@/components/landing/data/seoPages";
import { Footer } from "@/components/landing/Footer";
import {
  CTA_INTERACTIVE,
  LINK_INTERACTIVE,
} from "@/components/landing/interactionStyles";
import { Nav } from "@/components/landing/Nav";
import { cn } from "@/lib/utils";
import { FeatureMedia } from "./FeatureMedia";
import { JsonLd } from "./JsonLd";
import {
  buildBreadcrumbList,
  buildFeaturePageSchema,
  buildPageBreadcrumbs,
} from "./jsonLdBuilders";

const HUB_PATH = "/features";
const BACK_LABEL = "All features";
const RELATED_HEADING = "Related features";
const EYEBROW_LABEL = "Feature";

const CTA_CLASS = cn(
  CTA_INTERACTIVE,
  "inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);
const RELATED_LINK_CLASS = cn(
  LINK_INTERACTIVE,
  "block rounded-lg border border-border/60 bg-muted/30 p-4 text-sm font-medium text-foreground hover:border-border",
);

interface FeaturePageLayoutProps {
  page: FeaturePage;
}

function RelatedFeatures({ slugs }: { slugs: readonly string[] }) {
  const related = slugs.flatMap((slug) => getFeaturePage(slug) ?? []);
  if (related.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="mt-16">
      <h2 id="related-heading" className={SECTION_HEADING}>
        {RELATED_HEADING}
      </h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {related.map((feature) => (
          <li key={feature.slug}>
            <Link href={feature.route} className={RELATED_LINK_CLASS}>
              {feature.h1}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FeaturePageLayout({ page }: FeaturePageLayoutProps) {
  const [intro, ...details] = page.body;

  return (
    <>
      <JsonLd data={buildFeaturePageSchema(page)} />
      <JsonLd data={buildBreadcrumbList(buildPageBreadcrumbs(page))} />
      <Nav />
      <main id="app-main" className="overflow-x-hidden pt-24 pb-16">
        <div className={SECTION_CONTAINER}>
          <Link
            href={HUB_PATH}
            className={cn(LINK_INTERACTIVE, "text-sm text-muted-foreground")}
          >
            {BACK_LABEL}
          </Link>
          <header className="mt-6 max-w-3xl">
            <p className={SECTION_EYEBROW}>{EYEBROW_LABEL}</p>
            <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {page.h1}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {intro}
            </p>
            <Link href={page.cta.href} className={cn(CTA_CLASS, "mt-6")}>
              {page.cta.label}
            </Link>
          </header>
          <div className="mt-10">
            <FeatureMedia screenshot={page.screenshot} priority />
          </div>
          <div className="mt-10 max-w-3xl space-y-4 leading-relaxed text-muted-foreground">
            {details.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <RelatedFeatures slugs={page.related} />
        </div>
      </main>
      <Footer />
    </>
  );
}
