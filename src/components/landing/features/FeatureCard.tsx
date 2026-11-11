"use client";

import Link from "next/link";
import { BorderGlow, GlareHover } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import type { Feature } from "../data/features";
import { getFeaturePage } from "../data/seoPages";
import { LINK_INTERACTIVE } from "../interactionStyles";
import { FeaturePreview } from "./FeaturePreview";

const CARD_RADIUS = 16;
const LEARN_MORE_LABEL = "Learn more";

interface FeatureCardProps {
  feature: Feature;
  titleClassName?: string;
  className?: string;
}

export function FeatureCard({
  feature,
  titleClassName = "text-lg",
  className,
}: FeatureCardProps) {
  const detailRoute = feature.seoSlug
    ? getFeaturePage(feature.seoSlug)?.route
    : undefined;

  const card = (
    <BorderGlow
      className={cn("h-full", className)}
      borderRadius={CARD_RADIUS}
      backgroundColor="var(--card)"
      glowRadius={28}
    >
      <GlareHover className="h-full rounded-[inherit]">
        <div className="flex h-full flex-col p-4">
          {feature.preview && (
            <div className="mb-3 shrink-0">
              <FeaturePreview id={feature.preview} />
            </div>
          )}
          <h3
            className={cn(
              "mb-1.5 font-display font-semibold text-foreground",
              titleClassName,
            )}
          >
            {feature.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {feature.description}
          </p>
          {detailRoute && (
            <span className="mt-auto pt-3 text-sm font-medium text-foreground">
              {LEARN_MORE_LABEL} <span aria-hidden="true">&rarr;</span>
            </span>
          )}
        </div>
      </GlareHover>
    </BorderGlow>
  );

  if (!detailRoute) return card;

  return (
    <Link
      href={detailRoute}
      className={cn(
        LINK_INTERACTIVE,
        "block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {card}
    </Link>
  );
}
