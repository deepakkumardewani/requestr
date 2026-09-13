"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AnimatedContent, BlurText } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_PADDING,
  SECTION_SURFACE_ALT,
} from "./constants";
import { HERO_FEATURES } from "./data/features";
import { FeaturesGrid } from "./features/FeaturesGrid";
import { LINK_INTERACTIVE } from "./interactionStyles";

export function FeatureShowcase() {
  return (
    <section
      id="features"
      className={cn(
        "scroll-mt-20",
        SECTION_DIVIDER,
        SECTION_SURFACE_ALT,
        SECTION_PADDING,
      )}
    >
      <div className={SECTION_CONTAINER}>
        <AnimatedContent direction="up">
          <div className="mb-12">
            <p className={SECTION_EYEBROW}>Features</p>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 className="text-balance max-w-xl font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                <BlurText
                  text="The tools desktop clients charge for."
                  as="span"
                  duration={0.45}
                />
              </h2>
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
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Diff, transform and visualize JSON. Share a request as a link.
              Built in, not upsold.
            </p>
          </div>
        </AnimatedContent>

        <FeaturesGrid
          features={HERO_FEATURES}
          gridClassName="grid gap-6 sm:grid-cols-2"
        />
      </div>
    </section>
  );
}
