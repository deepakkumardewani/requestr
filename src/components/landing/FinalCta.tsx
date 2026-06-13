"use client";

import Link from "next/link";
import { AnimatedContent, ClickSpark } from "@/components/reactbits";

export function FinalCta() {
  return (
    <section className="py-24 border-t border-border/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedContent direction="up">
          <div className="mx-auto max-w-2xl text-center space-y-6">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Your API. Your browser.{" "}
              <span className="text-muted-foreground">
                No strings attached.
              </span>
            </h2>

            <p className="text-lg text-muted-foreground leading-relaxed">
              Open a tab and start building. Everything runs locally, so there's
              nothing to configure and nothing to sync.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <ClickSpark color="var(--method-get)" count={12}>
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Try it now
                  <span aria-hidden="true">→</span>
                </Link>
              </ClickSpark>
            </div>

            <p className="text-xs text-muted-foreground/50">
              Works in any modern browser
            </p>
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}
