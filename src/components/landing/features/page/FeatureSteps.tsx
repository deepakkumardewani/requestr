"use client";

import { motion, useScroll } from "motion/react";
import { useRef } from "react";
import { AnimatedContent } from "@/components/reactbits";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
  SECTION_SURFACE_ALT,
} from "../../constants";
import { SectionHeader } from "../../SectionHeader";
import type { FeatureStep } from "../data/featureDetails";
import { FEATURE_SECTION_IDS, titleId } from "./pageConstants";

const EYEBROW = "How it works";
const TITLE = "From first click to result.";
const TITLE_ID = titleId(FEATURE_SECTION_IDS.how);
/** The rail fills from when the list enters the lower viewport until its end passes the middle. */
const SCROLL_OFFSET: ["start 85%", "end 55%"] = ["start 85%", "end 55%"];
const STEP_STAGGER_S = 0.08;

function StepItem({ step, index }: { step: FeatureStep; index: number }) {
  return (
    <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-5 pb-10 last:pb-0">
      <span className="relative z-10 flex size-10 items-center justify-center rounded-full border border-border bg-background font-mono text-sm text-[var(--landing-accent)]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <AnimatedContent delay={index * STEP_STAGGER_S} distance={16}>
        <h3 className="pt-1.5 font-display text-xl font-semibold text-foreground">
          {step.title}
        </h3>
        <p className="mt-2 max-w-xl leading-relaxed text-muted-foreground">
          {step.body}
        </p>
      </AnimatedContent>
    </li>
  );
}

/** Numbered steps on a rail that fills as you scroll through them. */
export function FeatureSteps({ steps }: { steps: readonly FeatureStep[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: SCROLL_OFFSET,
  });

  return (
    <section
      id={FEATURE_SECTION_IDS.how}
      aria-labelledby={TITLE_ID}
      className={cn(SECTION_PADDING, SECTION_DIVIDER, SECTION_SURFACE_ALT)}
    >
      <div className={SECTION_CONTAINER}>
        <SectionHeader titleId={TITLE_ID} eyebrow={EYEBROW} title={TITLE} />
        <div ref={railRef} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-5 bottom-5 left-5 w-px -translate-x-1/2 bg-border"
          />
          <motion.span
            aria-hidden="true"
            style={{ scaleY: reduced ? 1 : scrollYProgress }}
            className="absolute top-5 bottom-5 left-5 w-px origin-top -translate-x-1/2 bg-[var(--landing-accent)]"
          />
          <ol>
            {steps.map((step, index) => (
              <StepItem key={step.title} step={step} index={index} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
