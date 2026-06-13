"use client";

import { AnimatedContent } from "@/components/reactbits";

const TRUST_SIGNALS = [
  "No install",
  "No account",
  "Local-first",
  "Zero setup",
];

export function TrustStrip() {
  return (
    <section className="border-y border-border/50 bg-muted/30 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedContent direction="up" delay={0.1}>
          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {TRUST_SIGNALS.map((signal, i) => (
              <span key={signal} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                {i > 0 && (
                  <span className="hidden sm:inline text-border" aria-hidden="true">
                    ·
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400" aria-hidden="true">✓</span>
                  {signal}
                </span>
              </span>
            ))}
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}
