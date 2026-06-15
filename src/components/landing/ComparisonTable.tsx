"use client";

import { AnimatedContent, CardSwap } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import {
  COMPARISON_ROWS,
  type ComparisonEmphasis,
  type ComparisonRow,
} from "./data/comparison";

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
      <h3 className="font-display text-xl font-semibold text-emerald-400">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function cellEmphasisClass(
  column: NonNullable<ComparisonEmphasis>,
  emphasis: ComparisonEmphasis,
): string {
  if (emphasis !== column) return "text-muted-foreground";
  if (column === "requestr") return "text-emerald-400 font-medium";
  return "text-foreground/90 font-medium";
}

function ComparisonCell({
  value,
  column,
  emphasis,
}: {
  value: string;
  column: NonNullable<ComparisonEmphasis>;
  emphasis: ComparisonEmphasis;
}) {
  const isRequestrColumn = column === "requestr";

  return (
    <td
      className={cn(
        "py-3.5 px-4 align-top transition-colors",
        isRequestrColumn && "bg-emerald-500/[0.04]",
        cellEmphasisClass(column, emphasis),
      )}
    >
      {value}
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
        value={row.requestr}
        column="requestr"
        emphasis={row.emphasis}
      />
      <ComparisonCell
        value={row.postman}
        column="postman"
        emphasis={row.emphasis}
      />
      <ComparisonCell
        value={row.insomnia}
        column="insomnia"
        emphasis={row.emphasis}
      />
    </tr>
  );
}

function ComparisonMobileCards() {
  return (
    <div className="space-y-4 md:hidden">
      {COMPARISON_ROWS.map((row) => (
        <article
          key={row.feature}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h3 className="mb-3 font-medium text-foreground">{row.feature}</h3>
          <dl className="space-y-3 text-sm">
            <div
              className={cn(
                "rounded-lg border border-transparent p-2.5",
                row.emphasis === "requestr" &&
                  "border-emerald-500/20 bg-emerald-500/[0.04]",
              )}
            >
              <dt className="font-semibold text-emerald-400">Requestr</dt>
              <dd className="mt-1 text-muted-foreground">{row.requestr}</dd>
            </div>
            <div
              className={cn(
                "rounded-lg border border-transparent p-2.5",
                row.emphasis === "postman" && "border-border/60 bg-muted/30",
              )}
            >
              <dt className="font-medium text-foreground/80">Postman</dt>
              <dd className="mt-1 text-muted-foreground">{row.postman}</dd>
            </div>
            <div
              className={cn(
                "rounded-lg border border-transparent p-2.5",
                row.emphasis === "insomnia" && "border-border/60 bg-muted/30",
              )}
            >
              <dt className="font-medium text-foreground/80">Insomnia</dt>
              <dd className="mt-1 text-muted-foreground">{row.insomnia}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export function ComparisonTable() {
  return (
    <section id="compare" className="py-16 sm:py-24 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedContent direction="up">
          <div className="mb-12 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
                Compare
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                How Requestr compares
              </h2>
              <p className="mt-3 text-muted-foreground">
                Zero-setup, browser-native API testing — side by side with
                desktop clients.
              </p>
            </div>

            <div className="md:hidden">
              <HighlightCard
                title={HIGHLIGHTS[0].title}
                body={HIGHLIGHTS[0].body}
              />
            </div>

            <CardSwap
              className="hidden h-40 w-full max-w-xs shrink-0 self-center md:block lg:self-auto"
              interval={3200}
            >
              {HIGHLIGHTS.map((h) => (
                <HighlightCard key={h.title} title={h.title} body={h.body} />
              ))}
            </CardSwap>
          </div>
        </AnimatedContent>

        <AnimatedContent direction="up" delay={0.1}>
          <ComparisonMobileCards />
          <div className="hidden overflow-x-auto rounded-xl border border-border [-webkit-overflow-scrolling:touch] md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="py-3 pl-4 pr-6 text-left font-medium text-muted-foreground/70 w-[28%]">
                    Feature
                  </th>
                  <th className="py-3 px-4 text-left font-semibold text-foreground w-[24%] bg-emerald-500/[0.06]">
                    Requestr
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground/70 w-[24%]">
                    Postman
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground/70 w-[24%]">
                    Insomnia
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <ComparisonRowView key={row.feature} row={row} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}
