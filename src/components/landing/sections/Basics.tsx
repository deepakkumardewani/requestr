import { AnimatedContent } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
  SECTION_SURFACE_ALT,
} from "../constants";
import {
  BASIC_FACTS,
  BASICS_EYEBROW,
  BASICS_HEADLINE,
  type BasicFact,
} from "../data/copy";
import { SECTION_IDS } from "../data/links";
import { SectionHeader } from "../SectionHeader";
import { SpotlightCard } from "../SpotlightCard";

const TITLE_ID = "basics-title";
const STAGGER_S = 0.1;

function FactCard({ fact }: { fact: BasicFact }) {
  return (
    <SpotlightCard color={fact.color} className="h-full">
      <div className="flex h-full flex-col p-6">
        <p
          className="flex items-center gap-2 font-mono text-xs font-semibold"
          style={{ color: fact.color }}
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]"
          />
          {fact.tag}
        </p>
        <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
          {fact.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {fact.body}
        </p>
      </div>
    </SpotlightCard>
  );
}

export function Basics() {
  return (
    <section
      id={SECTION_IDS.basics}
      aria-labelledby={TITLE_ID}
      className={cn(
        "scroll-mt-20",
        SECTION_DIVIDER,
        SECTION_SURFACE_ALT,
        SECTION_PADDING,
      )}
    >
      <div className={SECTION_CONTAINER}>
        <SectionHeader
          titleId={TITLE_ID}
          eyebrow={BASICS_EYEBROW}
          title={BASICS_HEADLINE}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {BASIC_FACTS.map((fact, index) => (
            <AnimatedContent
              key={fact.id}
              direction="up"
              delay={index * STAGGER_S}
              className="h-full"
            >
              <FactCard fact={fact} />
            </AnimatedContent>
          ))}
        </div>
      </div>
    </section>
  );
}
