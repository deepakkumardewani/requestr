"use client";

import { ScrollVelocity } from "@/components/reactbits";

const BENEFIT_PHRASES = [
  "No install",
  "No account",
  "Local-first",
  "Zero setup",
  "Open in a tab",
  "Privacy-first",
];

const MARQUEE_TEXT = BENEFIT_PHRASES.map((phrase) => `${phrase} · `).join("");

export function TrustStrip() {
  return (
    <section className="border-y border-border/50 bg-muted/30 py-6 overflow-hidden">
      <ScrollVelocity
        texts={[MARQUEE_TEXT, MARQUEE_TEXT]}
        velocity={40}
        className="text-muted-foreground/80"
        parallaxClassName="py-2"
        scrollerClassName="text-2xl md:text-3xl font-semibold tracking-tight"
        numCopies={4}
      />
    </section>
  );
}
