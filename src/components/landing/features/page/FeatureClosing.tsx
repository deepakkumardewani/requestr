import Link from "next/link";
import { cn } from "@/lib/utils";
import { GridBackdrop } from "../../background/GridBackdrop";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_SURFACE_ALT,
} from "../../constants";
import { FINAL_FOOTNOTE } from "../../data/copy";
import { FEATURES_HUB_PATH } from "../../data/links";
import type { SeoCta } from "../../data/seoPages";
import { PrimaryCta } from "../../PrimaryCta";
import type { FeatureDetail } from "../data/featureDetails";
import {
  FEATURE_SECTION_IDS,
  SECONDARY_CTA_CLASS,
  titleId,
} from "./pageConstants";

const HUB_LINK_LABEL = "See every feature";
const TITLE_ID = titleId(FEATURE_SECTION_IDS.closing);

interface FeatureClosingProps {
  closing: FeatureDetail["closing"];
  cta: SeoCta;
}

/** The page ends where the landing does: one line and the action. */
export function FeatureClosing({ closing, cta }: FeatureClosingProps) {
  return (
    <section
      id={FEATURE_SECTION_IDS.closing}
      aria-labelledby={TITLE_ID}
      className={cn(
        "relative isolate overflow-hidden py-24 sm:py-32",
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
            {closing.headline}
          </h2>
          <p className="text-balance text-lg leading-relaxed text-muted-foreground">
            {closing.subline}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <PrimaryCta size="lg" href={cta.href} label={cta.label} />
            <Link href={FEATURES_HUB_PATH} className={SECONDARY_CTA_CLASS}>
              {HUB_LINK_LABEL}
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
