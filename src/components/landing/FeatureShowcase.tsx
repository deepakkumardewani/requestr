"use client";

import { AnimatedContent } from "@/components/reactbits";
import { FeaturesGrid } from "./features/FeaturesGrid";

export function FeatureShowcase() {
  return (
    <section id="features" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedContent direction="up">
          <div className="mb-12 max-w-xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
              Features
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need.{" "}
              <span className="text-muted-foreground">Nothing you don't.</span>
            </h2>
          </div>
        </AnimatedContent>

        <FeaturesGrid />
      </div>
    </section>
  );
}
