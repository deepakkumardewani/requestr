"use client";

import { AnimatedContent, BlurText, CardSwap } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_PADDING,
} from "./constants";
import {
  COMPARISON_CHECKED_ON,
  COMPARISON_GROUPS,
  COMPARISON_ROWS,
  type ComparisonEmphasis,
  type ComparisonRow,
  type CompetitorCell,
  formatCheckedMonth,
  type RequestrCell,
} from "./data/comparison";

type CellData = CompetitorCell | RequestrCell;

const HIGHLIGHTS = [
  {
    title: "100% local",
    body: "Requests run in your browser. Nothing is sent to our servers.",
  },
  {
    title: "Zero setup",
    body: "No download, no account. Open a tab and start sending.",
  },
  {
    title: "Free & open",
    body: "No paywalled features, no seat limits, no upsells.",
  },
];

function HighlightCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col justify-center rounded-xl border border-border bg-card p-6 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-xl">
      <h3 className="font-display text-xl font-semibold text-compare-accent">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function HighlightChipRow() {
  return (
    <div className="flex gap-2 overflow-x-auto md:hidden" role="list">
      {HIGHLIGHTS.map((h) => (
        <div
          key={h.title}
          role="listitem"
          className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-compare-accent"
        >
          {h.title}
        </div>
      ))}
    </div>
  );
}

function cellEmphasisClass(
  column: NonNullable<ComparisonEmphasis>,
  emphasis: ComparisonEmphasis,
): string {
  if (emphasis !== column) return "text-muted-foreground";
  if (column === "requestr") return "text-compare-accent font-medium";
  return "text-foreground/90 font-medium";
}

function CellEvidence({
  cell,
  feature,
  vendor,
}: {
  cell: CellData;
  feature: string;
  vendor: string;
}) {
  // Requestr claims are proven by code paths kept in the data, never rendered
  if (!("source" in cell)) return null;
  return (
    <>
      {cell.tier && (
        <span className="mt-2 block w-fit rounded-full bg-compare-chip px-2 py-0.5 text-xs font-medium text-compare-chip-foreground">
          {cell.tier}
        </span>
      )}
      <a
        href={cell.source}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Source for ${vendor}: ${feature}`}
        className="block w-fit rounded-sm py-3.5 text-xs text-compare-link underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-compare-focus"
        data-testid="comparison-source-link"
      >
        Source
      </a>
    </>
  );
}

function ComparisonCell({
  cell,
  feature,
  vendor,
  column,
  emphasis,
}: {
  cell: CellData;
  feature: string;
  vendor: string;
  column: NonNullable<ComparisonEmphasis>;
  emphasis: ComparisonEmphasis;
}) {
  const isRequestrColumn = column === "requestr";

  return (
    <td
      className={cn(
        "py-3.5 px-4 align-top transition-colors",
        isRequestrColumn &&
          "bg-[var(--landing-accent,var(--method-get))]/[0.04]",
        cellEmphasisClass(column, emphasis),
      )}
    >
      {cell.text}
      <CellEvidence cell={cell} feature={feature} vendor={vendor} />
    </td>
  );
}

function ComparisonRowView({
  row,
  index,
}: {
  row: ComparisonRow;
  index: number;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/50 last:border-0 transition-colors",
        "hover:bg-muted/30",
        index % 2 === 0 ? "bg-background/30" : "bg-transparent",
      )}
    >
      <td className="py-3.5 pl-4 pr-6 font-medium text-foreground/80 align-top">
        {row.feature}
      </td>
      <ComparisonCell
        cell={row.requestr}
        feature={row.feature}
        vendor="Requestr"
        column="requestr"
        emphasis={row.emphasis}
      />
      <ComparisonCell
        cell={row.postman}
        feature={row.feature}
        vendor="Postman"
        column="postman"
        emphasis={row.emphasis}
      />
      <ComparisonCell
        cell={row.insomnia}
        feature={row.feature}
        vendor="Insomnia"
        column="insomnia"
        emphasis={row.emphasis}
      />
    </tr>
  );
}

function ComparisonGroupBody({
  title,
  rows,
}: {
  title: string;
  rows: ComparisonRow[];
}) {
  return (
    <tbody>
      <tr>
        <th
          scope="rowgroup"
          colSpan={4}
          className="bg-compare-group py-2.5 pl-4 pr-6 text-left text-xs font-semibold uppercase tracking-widest text-compare-group-foreground"
        >
          {title}
        </th>
      </tr>
      {rows.map((row, i) => (
        <ComparisonRowView key={row.feature} row={row} index={i} />
      ))}
    </tbody>
  );
}

export function ComparisonTable() {
  return (
    <section
      id="compare"
      className={cn("scroll-mt-20", SECTION_DIVIDER, SECTION_PADDING)}
    >
      <div className={SECTION_CONTAINER}>
        <AnimatedContent direction="up">
          <div className="mb-12 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className={cn(SECTION_EYEBROW, "text-compare-muted")}>
                Compare
              </p>
              <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                <BlurText
                  text="How Requestr stacks up"
                  as="span"
                  duration={0.45}
                />
              </h2>
              <p className="mt-3 text-muted-foreground">
                <BlurText
                  text="Desktop clients got slow and put basic testing behind a sign-up. Here's the honest comparison."
                  as="span"
                  duration={0.4}
                  delay={0.1}
                />
              </p>
            </div>

            <CardSwap
              className="hidden h-40 w-full max-w-xs shrink-0 self-center md:block lg:self-auto"
              interval={3200}
              pauseOnHover
              showIndicators
            >
              {HIGHLIGHTS.map((h) => (
                <HighlightCard key={h.title} title={h.title} body={h.body} />
              ))}
            </CardSwap>
          </div>

          <HighlightChipRow />
        </AnimatedContent>

        <AnimatedContent direction="up" delay={0.1}>
          <div className="max-w-full overflow-x-auto rounded-xl border border-border [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="py-3 pl-4 pr-6 text-left font-medium text-compare-muted w-[28%]">
                    Feature
                  </th>
                  <th className="py-3 px-4 text-left font-semibold text-foreground w-[24%] bg-[var(--landing-accent,var(--method-get))]/[0.06]">
                    Requestr
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-compare-muted w-[24%]">
                    Postman
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-compare-muted w-[24%]">
                    Insomnia
                  </th>
                </tr>
              </thead>
              {COMPARISON_GROUPS.map((group) => (
                <ComparisonGroupBody
                  key={group.id}
                  title={group.title}
                  rows={COMPARISON_ROWS.filter((row) => row.group === group.id)}
                />
              ))}
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Based on each vendor&apos;s public docs and pricing, last checked{" "}
            {formatCheckedMonth(COMPARISON_CHECKED_ON)}. Plans change, so check
            their sites for the latest.
          </p>
        </AnimatedContent>
      </div>
    </section>
  );
}
