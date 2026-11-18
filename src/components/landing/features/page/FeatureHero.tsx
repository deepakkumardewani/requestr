import { ArrowLeftIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { GridBackdrop } from "../../background/GridBackdrop";
import { SECTION_CONTAINER } from "../../constants";
import { FEATURES_HUB_PATH } from "../../data/links";
import type { FeaturePage } from "../../data/seoPages";
import { LINK_INTERACTIVE } from "../../interactionStyles";
import { PrimaryCta } from "../../PrimaryCta";
import type { FeatureDetail } from "../data/featureDetails";
import { heroMedia, splitHeadline } from "../data/featurePageModel";
import {
  FEATURE_SECTION_IDS,
  MEDIA_HALO,
  SECONDARY_CTA_CLASS,
} from "./pageConstants";

const BACK_LABEL = "All features";
const DEMO_LINK_LABEL = "Try the demo";
const HERO_WIDTH = 1440;
const HERO_HEIGHT = 900;
const HERO_SIZES = "(min-width: 1024px) 560px, 100vw";

interface FeatureHeroProps {
  page: FeaturePage;
  detail: FeatureDetail;
}

function HeroHeadline({ page, detail }: FeatureHeroProps) {
  const { lead, highlight, tail } = splitHeadline(page.h1, detail.highlight);
  return (
    <h1 className="mt-3 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
      {lead}
      {highlight ? (
        <span className="bg-gradient-to-r from-foreground/70 via-[var(--landing-accent)] to-foreground/70 bg-clip-text text-transparent">
          {highlight}
        </span>
      ) : null}
      {tail}
    </h1>
  );
}

/** Promise, proof and the one action: the feature's own tool. */
export function FeatureHero({ page, detail }: FeatureHeroProps) {
  const [intro] = page.body;
  const hero = heroMedia(page, detail);
  return (
    <section className="relative isolate overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-24">
      <GridBackdrop glow />
      <div
        className={cn(
          SECTION_CONTAINER,
          "grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]",
        )}
      >
        <header>
          <Link
            href={FEATURES_HUB_PATH}
            className={cn(
              LINK_INTERACTIVE,
              "inline-flex items-center gap-1.5 text-sm text-muted-foreground",
            )}
          >
            <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
            {BACK_LABEL}
          </Link>
          <p className="mt-8 font-mono text-sm text-[var(--landing-accent)]">
            {detail.eyebrow}
          </p>
          <HeroHeadline page={page} detail={detail} />
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {intro}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PrimaryCta size="lg" href={page.cta.href} label={page.cta.label} />
            <a
              href={`#${FEATURE_SECTION_IDS.demo}`}
              className={SECONDARY_CTA_CLASS}
            >
              {DEMO_LINK_LABEL}
            </a>
          </div>
        </header>
        <div
          className="relative"
          style={{ "--halo-color": detail.color } as CSSProperties}
        >
          <div aria-hidden="true" className={MEDIA_HALO} />
          <Image
            src={hero.src}
            alt={hero.alt}
            width={HERO_WIDTH}
            height={HERO_HEIGHT}
            sizes={HERO_SIZES}
            priority
            className="h-auto w-full rounded-xl border border-border shadow-2xl shadow-black/40"
          />
        </div>
      </div>
    </section>
  );
}
