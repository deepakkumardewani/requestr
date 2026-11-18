import { AnimatedContent } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
} from "../../constants";
import { SectionHeader } from "../../SectionHeader";
import { SpotlightCard } from "../../SpotlightCard";
import type { FeatureCapability } from "../data/featureDetails";
import { FEATURE_SECTION_IDS, titleId } from "./pageConstants";

const EYEBROW = "Capabilities";
const TITLE = "The details that matter.";
const TITLE_ID = titleId(FEATURE_SECTION_IDS.capabilities);
const CARD_STAGGER_S = 0.06;

function CapabilityCard({ capability }: { capability: FeatureCapability }) {
  return (
    <SpotlightCard color={capability.color} className="h-full">
      <div className="flex h-full flex-col p-6">
        <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{ backgroundColor: capability.color }}
          />
          {capability.tag}
        </p>
        <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
          {capability.title}
        </h3>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          {capability.body}
        </p>
      </div>
    </SpotlightCard>
  );
}

/** What the feature can do, one spotlight card per capability. */
export function FeatureCapabilities({
  capabilities,
}: {
  capabilities: readonly FeatureCapability[];
}) {
  return (
    <section
      id={FEATURE_SECTION_IDS.capabilities}
      aria-labelledby={TITLE_ID}
      className={cn(SECTION_PADDING, SECTION_DIVIDER)}
    >
      <div className={SECTION_CONTAINER}>
        <SectionHeader titleId={TITLE_ID} eyebrow={EYEBROW} title={TITLE} />
        <ul className="grid gap-4 sm:grid-cols-2">
          {capabilities.map((capability, index) => (
            <li key={capability.id}>
              <AnimatedContent
                delay={index * CARD_STAGGER_S}
                className="h-full"
              >
                <CapabilityCard capability={capability} />
              </AnimatedContent>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
