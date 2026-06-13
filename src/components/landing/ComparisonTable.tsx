"use client";

import { AnimatedContent, CardSwap } from "@/components/reactbits";
import { COMPARISON_ROWS } from "./data/comparison";

const HIGHLIGHTS = [
  { title: "100% local", body: "Requests run in your browser. Nothing is sent to our servers." },
  { title: "Zero setup", body: "No download, no account. Open a tab and start sending." },
  { title: "Free & open", body: "No paywalled features, no seat limits, no upsells." },
];

function HighlightCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col justify-center rounded-xl border border-border bg-card p-6 shadow-lg">
      <h3 className="font-display text-xl font-semibold text-emerald-400">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Check({ wins }: { wins: boolean }) {
  return wins ? (
    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2.5 7l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground/50">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function ComparisonTable() {
  return (
    <section id="compare" className="py-24 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedContent direction="up">
          <div className="mb-12 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
                Compare
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Requestr vs Postman
              </h2>
              <p className="mt-3 text-muted-foreground">
                An honest look — no strawmen.
              </p>
            </div>

            <CardSwap className="h-40 w-full max-w-xs shrink-0 self-center sm:self-auto" interval={3200}>
              {HIGHLIGHTS.map((h) => (
                <HighlightCard key={h.title} title={h.title} body={h.body} />
              ))}
            </CardSwap>
          </div>
        </AnimatedContent>

        <AnimatedContent direction="up" delay={0.1}>
          {/* Horizontally scrollable on mobile */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="py-3 pl-4 pr-6 text-left font-medium text-muted-foreground/70 w-2/5">
                    Feature
                  </th>
                  <th className="py-3 px-4 text-left font-semibold text-foreground w-[30%] bg-emerald-500/[0.06]">
                    Requestr
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground/70 w-[30%]">
                    Postman
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-border/50 last:border-0 ${
                      i % 2 === 0 ? "bg-background/30" : "bg-transparent"
                    }`}
                  >
                    <td className="py-3 pl-4 pr-6 font-medium text-foreground/80">
                      {row.feature}
                    </td>
                    <td className="py-3 px-4 bg-emerald-500/[0.06]">
                      <span className="flex items-center gap-2 text-emerald-400 font-medium">
                        <Check wins />
                        {row.requestr}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {row.postman}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}
