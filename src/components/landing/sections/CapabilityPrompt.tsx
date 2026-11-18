"use client";

import { useEffect } from "react";
import type { LandingCapability } from "../data/capabilities";
import { CAPABILITIES_PROMPT_LABEL } from "../data/copy";
import { useTypedText } from "../hooks/useTypedText";

/** How long a finished prompt stays up before the next area takes over. */
const HOLD_AFTER_TYPED_MS = 2400;
const WINDOW_DOT_KEYS = ["close", "minimise", "zoom"] as const;

interface CapabilityPromptProps {
  capability: LandingCapability;
  running: boolean;
  instant: boolean;
  /** Called once the prompt has been typed and held; omitted when autoplay is off. */
  onHeld?: () => void;
}

/** A composer-style panel that types the example prompt for one area. */
export function CapabilityPrompt({
  capability,
  running,
  instant,
  onHeld,
}: CapabilityPromptProps) {
  const { typed, done } = useTypedText(capability.example, {
    running,
    instant,
  });

  useEffect(() => {
    if (!done || !running || !onHeld) return;
    const timer = setTimeout(onHeld, HOLD_AFTER_TYPED_MS);
    return () => clearTimeout(timer);
  }, [done, running, onHeld]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[var(--surface-deep)] shadow-[0_24px_80px_-32px_rgb(52_211_153/0.35)]">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        {WINDOW_DOT_KEYS.map((key) => (
          <span
            key={key}
            aria-hidden="true"
            className="size-2.5 rounded-full bg-muted-foreground/25"
          />
        ))}
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          Relay · {capability.title}
        </span>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {capability.description}
        </p>
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/80">
            {CAPABILITIES_PROMPT_LABEL}
          </p>
          <p className="flex min-h-[4.5rem] gap-2 rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm leading-relaxed text-foreground sm:text-base">
            <span aria-hidden="true" className="text-[var(--landing-accent)]">
              &gt;
            </span>
            <span className="sr-only">{capability.example}</span>
            <span aria-hidden="true">
              {typed}
              <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.2em] bg-[var(--landing-accent)] motion-safe:animate-pulse" />
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
