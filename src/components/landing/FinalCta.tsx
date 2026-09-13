"use client";

import Link from "next/link";
import { AnimatedContent, BlurText, ClickSpark } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
  SECTION_SURFACE_ALT,
} from "./constants";
import { CTA_INTERACTIVE } from "./interactionStyles";

export function FinalCta() {
  return (
    <section
      className={cn(SECTION_DIVIDER, SECTION_SURFACE_ALT, SECTION_PADDING)}
    >
      <div className={SECTION_CONTAINER}>
        <div className="mx-auto max-w-2xl space-y-5 text-center sm:space-y-6">
          <AnimatedContent direction="up">
            <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              <BlurText
                text="Stop waiting for Postman to load."
                as="span"
                duration={0.5}
              />
            </h2>
          </AnimatedContent>

          <AnimatedContent direction="up" delay={0.1}>
            <p className="text-balance text-lg text-muted-foreground leading-relaxed">
              <BlurText
                text="Open a tab, paste a URL, send it. Your requests stay in this browser."
                as="span"
                duration={0.45}
                delay={0.05}
              />
            </p>
          </AnimatedContent>

          <AnimatedContent direction="up" delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <ClickSpark color="var(--landing-accent)" count={12}>
                <Link
                  href="/app"
                  className={cn(
                    CTA_INTERACTIVE,
                    "group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  Open the app
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none"
                  >
                    →
                  </span>
                </Link>
              </ClickSpark>
            </div>
          </AnimatedContent>

          <AnimatedContent direction="up" delay={0.24}>
            <p className="text-xs text-muted-foreground/80">
              Free, open source, and yours — no sign-up required.
            </p>
          </AnimatedContent>
        </div>
      </div>
    </section>
  );
}
