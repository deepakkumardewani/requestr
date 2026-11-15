"use client";

import { motion, useInView } from "motion/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { DATA_STEPS_LABEL, type DataStep } from "../data/copy";

const STEP_DURATION_S = 6;
const IN_VIEW_AMOUNT = 0.4;
const INDEX_PAD_LENGTH = 2;
/** The captures are full 1440x900 app windows with the dialog in the middle. */
const CAPTURE_WIDTH = 1440;
const CAPTURE_HEIGHT = 900;
/** Wider than the frame because the capture is cropped and zoomed inside it. */
const CAPTURE_SIZES = "(min-width: 1024px) 1400px, 240vw";
/** Zooms each capture so the dialog, not the dimmed app behind it, fills the frame. */
const DIALOG_ZOOM_CLASS = "scale-[1.5]";

interface StepButtonProps {
  step: DataStep;
  index: number;
  isActive: boolean;
  /** Fills over the step's duration, then asks for the next step. */
  onElapsed?: () => void;
  onPick: () => void;
}

function StepButton({
  step,
  index,
  isActive,
  onElapsed,
  onPick,
}: StepButtonProps) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={isActive}
        onClick={onPick}
        className={cn(
          "relative w-full overflow-hidden rounded-lg border px-4 py-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive
            ? "border-[var(--landing-accent)]/50 bg-[var(--landing-accent)]/[0.06]"
            : "border-border hover:border-muted-foreground/40 hover:bg-muted/40",
        )}
      >
        <span className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-muted-foreground/80">
            {String(index + 1).padStart(INDEX_PAD_LENGTH, "0")}
          </span>
          <span
            className={cn(
              "font-mono text-xs uppercase tracking-widest",
              isActive
                ? "text-[var(--landing-accent)]"
                : "text-muted-foreground",
            )}
          >
            {step.label}
          </span>
        </span>
        <span className="mt-2 block font-display text-base font-semibold text-foreground">
          {step.title}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </span>
        {isActive && onElapsed ? (
          <motion.span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[var(--landing-accent)]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: STEP_DURATION_S, ease: "linear" }}
            onAnimationComplete={onElapsed}
          />
        ) : null}
      </button>
    </li>
  );
}

function StepCaptures({
  steps,
  activeIndex,
}: {
  steps: readonly DataStep[];
  activeIndex: number;
}) {
  return (
    <div className="relative aspect-[8/7] overflow-hidden rounded-xl border border-border bg-[var(--surface-deep)] shadow-2xl">
      {steps.map((step, index) => (
        <Image
          key={step.id}
          src={step.screenshot.src}
          alt={step.screenshot.alt}
          width={CAPTURE_WIDTH}
          height={CAPTURE_HEIGHT}
          sizes={CAPTURE_SIZES}
          aria-hidden={index !== activeIndex}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none",
            DIALOG_ZOOM_CLASS,
            index === activeIndex ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}

/** Three steps, each with the real dialog it happens in. Advances on its own until picked. */
export function DataStepShowcase({ steps }: { steps: readonly DataStep[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: IN_VIEW_AMOUNT });
  const reduced = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  // Autoplay stops for good once someone picks a step themselves.
  const [autoplay, setAutoplay] = useState(true);
  const advancing = autoplay && inView && !reduced;

  const showNext = () => setActiveIndex((index) => (index + 1) % steps.length);
  const pick = (index: number) => {
    setAutoplay(false);
    setActiveIndex(index);
  };

  return (
    <div
      ref={rootRef}
      className="grid items-center gap-8 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-12"
    >
      <ol aria-label={DATA_STEPS_LABEL} className="space-y-2">
        {steps.map((step, index) => (
          <StepButton
            key={step.id}
            step={step}
            index={index}
            isActive={index === activeIndex}
            onElapsed={advancing ? showNext : undefined}
            onPick={() => pick(index)}
          />
        ))}
      </ol>
      <StepCaptures steps={steps} activeIndex={activeIndex} />
    </div>
  );
}
