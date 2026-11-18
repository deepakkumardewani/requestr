"use client";

import { ArrowRightIcon } from "lucide-react";
import { useInView } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { Feature } from "../data/features";
import { getFeaturePage } from "../data/seoPages";
import { SpotlightCard } from "../SpotlightCard";
import { FeaturePreview } from "./FeaturePreview";

const LEARN_MORE_LABEL = "Learn more";
/** Previews only animate while at least this share of the card is visible. */
const PREVIEW_VISIBLE_AMOUNT = 0.2;

interface FeatureCardProps {
  feature: Feature;
  /** Lays the preview beside the copy across a full grid row. */
  wide?: boolean;
  titleClassName?: string;
  className?: string;
}

function CardCopy({
  feature,
  linked,
  titleClassName,
}: {
  feature: Feature;
  linked: boolean;
  titleClassName: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <h3
        className={cn(
          "font-display font-semibold text-foreground",
          titleClassName,
        )}
      >
        {feature.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {feature.description}
      </p>
      {linked ? (
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-foreground">
          {LEARN_MORE_LABEL}
          <ArrowRightIcon
            aria-hidden="true"
            className="size-3.5 transition-transform duration-200 group-hover/card:translate-x-0.5"
          />
        </span>
      ) : null}
    </div>
  );
}

export function FeatureCard({
  feature,
  wide = false,
  titleClassName = "text-lg",
  className,
}: FeatureCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: PREVIEW_VISIBLE_AMOUNT });
  const detailRoute = feature.seoSlug
    ? getFeaturePage(feature.seoSlug)?.route
    : undefined;
  const showPreview = Boolean(feature.preview);

  const card = (
    <SpotlightCard className={cn("h-full", className)}>
      <div
        ref={ref}
        className={cn(
          "grid h-full gap-4 p-5",
          wide && showPreview && "sm:grid-cols-[1fr_1.15fr] sm:items-center",
        )}
      >
        {feature.preview ? (
          <FeaturePreview id={feature.preview} paused={!inView} />
        ) : null}
        <div className={cn(wide && showPreview && "sm:order-first")}>
          <CardCopy
            feature={feature}
            linked={Boolean(detailRoute)}
            titleClassName={titleClassName}
          />
        </div>
      </div>
    </SpotlightCard>
  );

  if (!detailRoute) return card;

  return (
    <Link
      href={detailRoute}
      className="group/card block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {card}
    </Link>
  );
}
