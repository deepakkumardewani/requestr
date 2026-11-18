"use client";

import { useInView } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import type { LandingCapability } from "../data/capabilities";
import { CAPABILITIES_PICKER_LABEL } from "../data/copy";
import { CapabilityPrompt } from "./CapabilityPrompt";

interface CapabilityTileProps {
  capability: LandingCapability;
  isActive: boolean;
  onPick: () => void;
}

function CapabilityTile({ capability, isActive, onPick }: CapabilityTileProps) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={isActive}
        onClick={onPick}
        className={cn(
          "flex h-full w-full flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive
            ? "border-[var(--landing-accent)]/60 bg-[var(--landing-accent)]/[0.07]"
            : "border-border bg-card hover:border-muted-foreground/40 hover:bg-muted/40",
        )}
      >
        <span
          className={cn(
            "font-display text-sm font-semibold",
            isActive ? "text-[var(--landing-accent)]" : "text-foreground",
          )}
        >
          {capability.title}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {capability.description}
        </span>
      </button>
    </li>
  );
}

/** Share of the explorer that must be on screen before it starts typing. */
const IN_VIEW_AMOUNT = 0.3;

interface CapabilityExplorerProps {
  /** Passed in from the server so the tool registry stays out of the client bundle. */
  capabilities: readonly LandingCapability[];
}

/**
 * Eight areas on the left, one composer on the right typing what you would
 * ask for the selected area. It cycles on its own until someone picks one.
 */
export function CapabilityExplorer({ capabilities }: CapabilityExplorerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: IN_VIEW_AMOUNT });
  const reduced = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  // Autoplay stops for good once someone picks an area themselves.
  const [autoplay, setAutoplay] = useState(true);
  const active = capabilities[activeIndex] ?? capabilities[0];
  const count = capabilities.length;

  const showNext = useCallback(() => {
    setActiveIndex((index) => (index + 1) % count);
  }, [count]);
  const pick = (index: number) => {
    setAutoplay(false);
    setActiveIndex(index);
  };

  if (!active) return null;
  return (
    <div
      ref={rootRef}
      className="grid items-start gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10"
    >
      <ul
        aria-label={CAPABILITIES_PICKER_LABEL}
        className="order-2 grid gap-2 sm:grid-cols-2 lg:order-1"
      >
        {capabilities.map((capability, index) => (
          <CapabilityTile
            key={capability.id}
            capability={capability}
            isActive={index === activeIndex}
            onPick={() => pick(index)}
          />
        ))}
      </ul>
      <div className="order-1 lg:sticky lg:top-24 lg:order-2">
        <CapabilityPrompt
          key={active.id}
          capability={active}
          running={inView}
          instant={reduced}
          onHeld={autoplay && !reduced ? showNext : undefined}
        />
      </div>
    </div>
  );
}
