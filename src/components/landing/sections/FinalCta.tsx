import Link from "next/link";
import { cn } from "@/lib/utils";
import { GridBackdrop } from "../background/GridBackdrop";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_SURFACE_ALT,
} from "../constants";
import { FINAL_FOOTNOTE, FINAL_HEADLINE, FINAL_SUBLINE } from "../data/copy";
import { FEATURES_HUB_PATH, SECTION_IDS } from "../data/links";
import { CTA_INTERACTIVE } from "../interactionStyles";
import { PrimaryCta } from "../PrimaryCta";

const TITLE_ID = "final-cta-title";

export function FinalCta() {
  return (
    <section
      id={SECTION_IDS.finalCta}
      aria-labelledby={TITLE_ID}
      className={cn(
        "relative isolate py-24 sm:py-32",
        SECTION_DIVIDER,
        SECTION_SURFACE_ALT,
      )}
    >
      <GridBackdrop mask="center" />
      <div className={SECTION_CONTAINER}>
        <div className="mx-auto max-w-2xl space-y-5 text-center sm:space-y-6">
          <h2
            id={TITLE_ID}
            className="text-balance font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            {FINAL_HEADLINE}
          </h2>
          <p className="text-balance text-lg leading-relaxed text-muted-foreground">
            {FINAL_SUBLINE}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <PrimaryCta size="lg" />
            <Link
              href={FEATURES_HUB_PATH}
              className={cn(
                CTA_INTERACTIVE,
                "inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-6 py-3 text-base font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              See every feature
            </Link>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {FINAL_FOOTNOTE}
          </p>
        </div>
      </div>
    </section>
  );
}
