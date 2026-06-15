"use client";

import { AnimatedContent } from "@/components/reactbits";
import { FEATURES } from "../data/features";
import { FeatureCard } from "./FeatureCard";

export function FeaturesGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature, i) => (
        <AnimatedContent
          key={feature.id}
          direction="up"
          delay={i * 0.07}
          duration={0.5}
        >
          <FeatureCard
            feature={feature}
            previewMinHeight="min-h-[88px]"
            titleClassName="text-lg"
          />
        </AnimatedContent>
      ))}
    </div>
  );
}
