"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AnimatedContent, BlurText } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import { HERO_FEATURES } from "./data/features";
import { FeaturesGrid } from "./features/FeaturesGrid";
import { LINK_INTERACTIVE } from "./interactionStyles";

export function FeatureShowcase() {
  return (
    <section id="features" className="py-16 sm:py-24 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedContent direction="up">
          <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
                Features
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                <BlurText
                  text="Tools the desktop clients skip."
                  as="span"
                  duration={0.45}
                />{" "}
                <BlurText
                  text="Zero bloat."
                  as="span"
                  className="text-muted-foreground"
                  duration={0.45}
                  delay={0.12}
                />
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Transform, compare, and visualize JSON, share requests as links,
                and more — rarely found in a browser-based API client.
              </p>
            </div>
            <Link
              href="/features"
              className={cn(
                LINK_INTERACTIVE,
                "inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80",
              )}
            >
              See all features
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </AnimatedContent>

        <FeaturesGrid features={HERO_FEATURES} />
      </div>
    </section>
  );
}
