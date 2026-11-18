import { AnimatedContent } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import type { Feature } from "../data/features";
import { FeatureCard } from "./FeatureCard";
import { placeGroup } from "./hub/hubModel";

const CARD_STAGGER_S = 0.06;
const CARD_REVEAL_S = 0.5;

interface FeaturesGridProps {
  features: readonly Feature[];
}

/** A two-column bento: preview cards span the row, the rest pair up. */
export function FeaturesGrid({ features }: FeaturesGridProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {placeGroup(features).map(({ feature, wide }, index) => (
        <li key={feature.id} className={cn(wide && "sm:col-span-2")}>
          <AnimatedContent
            direction="up"
            delay={index * CARD_STAGGER_S}
            duration={CARD_REVEAL_S}
            className="h-full"
          >
            <FeatureCard feature={feature} wide={wide} />
          </AnimatedContent>
        </li>
      ))}
    </ul>
  );
}
