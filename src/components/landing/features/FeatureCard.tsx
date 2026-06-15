"use client";

import { BorderGlow, GlareHover } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import type { Feature } from "../data/features";
import { FeaturePreview } from "../FeaturePreview";

/** Nested radius: inner = outer − padding (clamp at 0). */
const CARD_RADIUS = 16;
const CARD_PADDING = 16;
const PREVIEW_RADIUS = Math.max(0, CARD_RADIUS - CARD_PADDING);

interface FeatureCardProps {
  feature: Feature;
  previewMinHeight?: string;
  titleClassName?: string;
  className?: string;
}

export function FeatureCard({
  feature,
  previewMinHeight = "min-h-[88px]",
  titleClassName = "text-lg",
  className,
}: FeatureCardProps) {
  return (
    <BorderGlow
      className={cn("h-full", className)}
      borderRadius={CARD_RADIUS}
      backgroundColor="var(--card)"
      glowRadius={28}
    >
      {/* Card face comes from BorderGlow background — keep GlareHover transparent so edge glow shows through */}
      <GlareHover className="h-full rounded-[inherit]">
        <div className="flex h-full flex-col p-4">
          <div
            className={cn(
              "mb-4 w-full overflow-hidden bg-background/50 flex items-center",
              previewMinHeight,
            )}
            style={{ borderRadius: `${PREVIEW_RADIUS}px` }}
          >
            <FeaturePreview id={feature.id} />
          </div>

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
        </div>
      </GlareHover>
    </BorderGlow>
  );
}
