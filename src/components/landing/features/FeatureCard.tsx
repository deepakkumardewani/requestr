"use client";

import { BorderGlow, GlareHover } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import type { Feature } from "../data/features";

const CARD_RADIUS = 16;

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
  return (
    <BorderGlow
      className={cn("h-full", className)}
      borderRadius={CARD_RADIUS}
      backgroundColor="var(--card)"
      glowRadius={28}
    >
      <GlareHover className="h-full rounded-[inherit]">
        <div className="flex h-full flex-col p-4">
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
