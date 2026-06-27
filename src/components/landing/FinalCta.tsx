"use client";

import Link from "next/link";
import { AnimatedContent, BlurText, ClickSpark } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import { CTA_INTERACTIVE } from "./interactionStyles";

export function FinalCta() {
  return (
    <section className="py-16 border-t border-border/50 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl space-y-5 sm:space-y-6">
          <AnimatedContent direction="up">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              <BlurText
                text="Your API. Your browser."
                as="span"
                duration={0.5}
              />{" "}
              <BlurText
                text="No strings attached."
                as="span"
                className="text-muted-foreground"
                duration={0.5}
                delay={0.15}
              />
            </h2>
          </AnimatedContent>

          <AnimatedContent direction="up" delay={0.1}>
            <p className="text-lg text-muted-foreground leading-relaxed">
              <BlurText
                text="Open a tab and start building. Everything runs locally, so there's nothing to configure and nothing to sync."
                as="span"
                duration={0.45}
                delay={0.05}
              />
            </p>
          </AnimatedContent>

          <AnimatedContent direction="up" delay={0.18}>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ClickSpark color="var(--method-get)" count={12}>
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
            <p className="text-xs text-muted-foreground/50">
              Free, open source, and yours — no sign-up required.
            </p>
          </AnimatedContent>
        </div>
      </div>
    </section>
  );
}
