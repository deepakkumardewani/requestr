"use client";

import { AnimatedContent } from "@/components/reactbits";

const MANIFEST_ENTRIES = [
  {
    hint: "No install",
    key: "install",
    value: "null",
    valueClass: "text-emerald-400",
    hoverClass:
      "group-hover/cell:border-emerald-500/20 group-hover/cell:bg-emerald-500/[0.04]",
  },
  {
    hint: "No account",
    key: "account",
    value: "null",
    valueClass: "text-blue-400",
    hoverClass:
      "group-hover/cell:border-blue-500/20 group-hover/cell:bg-blue-500/[0.04]",
  },
  {
    hint: "Zero setup",
    key: "setup_time",
    value: "0ms",
    valueClass: "text-amber-400",
    hoverClass:
      "group-hover/cell:border-amber-500/20 group-hover/cell:bg-amber-500/[0.04]",
  },
  {
    hint: "Privacy-first",
    key: "data_location",
    value: '"browser-only"',
    valueClass: "text-purple-400",
    hoverClass:
      "group-hover/cell:border-purple-500/20 group-hover/cell:bg-purple-500/[0.04]",
  },
] as const;

export function TrustStrip() {
  return (
    <section
      aria-labelledby="trust-manifest-title"
      className="relative z-10 -mt-6 px-4 pb-12 sm:-mt-10 sm:px-6 sm:pb-14 lg:px-8"
    >
      <div className="mx-auto max-w-3xl">
        <AnimatedContent direction="up" delay={0.05}>
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)]">
            <div className="flex items-center gap-2 border-b border-border/60 bg-background/50 px-4 py-2.5 font-mono text-[10px] text-muted-foreground/70">
              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-red-400/80" />
                <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                <span className="motion-safe:animate-pulse h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span id="trust-manifest-title" className="text-foreground/80">
                requestr.manifest
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span>read-only</span>
              <span className="ml-auto rounded border border-border/50 bg-background/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
                local
              </span>
            </div>

            <div className="grid divide-y divide-border/40 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {MANIFEST_ENTRIES.map((entry, i) => (
                <AnimatedContent
                  key={entry.key}
                  direction="up"
                  delay={0.08 + i * 0.05}
                  className={`group/cell border border-transparent p-4 transition-colors duration-200 ${entry.hoverClass}`}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/45">
                    {entry.hint}
                  </p>
                  <p className="mt-2 font-mono text-sm leading-none">
                    <span className="text-blue-400/80">{entry.key}</span>
                    <span className="text-muted-foreground/35">: </span>
                    <span className={entry.valueClass}>{entry.value}</span>
                    <span className="text-muted-foreground/35">,</span>
                  </p>
                </AnimatedContent>
              ))}
            </div>

            <div className="border-t border-border/40 bg-[oklch(0.12_0.005_285)] px-4 py-2 font-mono text-[10px] text-muted-foreground/45">
              <span className="text-muted-foreground/30">{"// "}</span>
              your requests never leave this tab
            </div>
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}
