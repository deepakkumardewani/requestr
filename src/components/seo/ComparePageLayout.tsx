import Link from "next/link";
import {
  SECTION_CONTAINER,
  SECTION_EYEBROW,
  SECTION_HEADING,
} from "@/components/landing/constants";
import {
  COMPARISON_CHECKED_ON,
  COMPARISON_ROWS,
  formatCheckedMonth,
} from "@/components/landing/data/comparison";
import {
  type ComparePage,
  type CompetitorKey,
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
  buildComparePageSchema,
  buildPageBreadcrumbs,
} from "./jsonLdBuilders";

const HUB_PATH = "/features";
const BACK_LABEL = "All features";
const EYEBROW_LABEL = "Compare";
const TABLE_HEADING = "Side by side";
const STRONGER_HEADING = "Where they are stronger";
const RELATED_HEADING = "Related features";
const SOURCE_LABEL = "Source";

const COMPETITOR_NAMES: Record<CompetitorKey, string> = {
  postman: "Postman",
  insomnia: "Insomnia",
};

const CTA_CLASS = cn(
  CTA_INTERACTIVE,
  "inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);
const RELATED_LINK_CLASS = cn(
  LINK_INTERACTIVE,
  "block rounded-lg border border-border/60 bg-muted/30 p-4 text-sm font-medium text-foreground hover:border-border",
);
const CELL_CLASS = "px-4 py-3 align-top text-sm leading-relaxed";

interface ComparePageLayoutProps {
  page: ComparePage;
}

function ComparisonTable({ competitor }: { competitor: CompetitorKey }) {
  const name = COMPETITOR_NAMES[competitor];

  return (
    <section aria-labelledby="table-heading" className="mt-16">
      <h2 id="table-heading" className={SECTION_HEADING}>
        {TABLE_HEADING}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        {name} details were last checked in{" "}
        {formatCheckedMonth(COMPARISON_CHECKED_ON)}. Each one links to its
        source.
      </p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className={CELL_CLASS}>
                Feature
              </th>
              <th scope="col" className={CELL_CLASS}>
                Requestr
              </th>
              <th scope="col" className={CELL_CLASS}>
                {name}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {COMPARISON_ROWS.map((row) => {
              const claim = row[competitor];
              return (
                <tr key={row.feature}>
                  <th
                    scope="row"
                    className={cn(CELL_CLASS, "font-medium text-foreground")}
                  >
                    {row.feature}
                  </th>
                  <td className={cn(CELL_CLASS, "text-muted-foreground")}>
                    {row.requestr.text}
                  </td>
                  <td className={cn(CELL_CLASS, "text-muted-foreground")}>
                    <p>{claim.text}</p>
                    {claim.tier && <p className="mt-1 text-xs">{claim.tier}</p>}
                    <a
                      href={claim.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${SOURCE_LABEL} for ${row.feature}`}
                      className={cn(
                        LINK_INTERACTIVE,
                        "mt-1 inline-block text-xs underline underline-offset-2",
                      )}
                    >
                      {SOURCE_LABEL}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StrongerNotes({
  notes,
  name,
}: {
  notes: readonly string[];
  name: string;
}) {
  return (
    <section aria-labelledby="stronger-heading" className="mt-16 max-w-3xl">
      <h2 id="stronger-heading" className={SECTION_HEADING}>
        {STRONGER_HEADING}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Where {name} is the better fit.
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
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

export function ComparePageLayout({ page }: ComparePageLayoutProps) {
  const [intro, ...details] = page.body;
  const name = COMPETITOR_NAMES[page.slug];

  return (
    <>
      <JsonLd data={buildComparePageSchema(page)} />
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
          <ComparisonTable competitor={page.slug} />
          <StrongerNotes notes={page.strongerNotes} name={name} />
          <RelatedFeatures slugs={page.related} />
        </div>
      </main>
      <Footer />
    </>
  );
}
