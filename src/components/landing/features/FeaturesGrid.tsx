"use client";

import { AnimatedContent } from "@/components/reactbits";
import type { Feature } from "../data/features";
import { HERO_FEATURES } from "../data/features";
import { FeatureCard } from "./FeatureCard";

interface FeaturesGridProps {
  features?: Feature[];
}

export function FeaturesGrid({ features = HERO_FEATURES }: FeaturesGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature, i) => (
        <AnimatedContent
          key={feature.id}
          direction="up"
          delay={i * 0.07}
          duration={0.5}
        >
          <FeatureCard feature={feature} titleClassName="text-lg" />
        </AnimatedContent>
      ))}
    </div>
  );
}
