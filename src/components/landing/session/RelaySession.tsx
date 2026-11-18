"use client";

import { ArrowUpIcon, PlusIcon, ShieldCheckIcon } from "lucide-react";
import { useInView } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { RelayLogo } from "@/components/relay/RelayLogo";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { RELAY_SESSIONS } from "../data/sessions";
import { SessionTranscript } from "./SessionTranscript";

const COMPOSER_PLACEHOLDER = "Ask anything, @ to mention, / for actions";
const APPROVAL_MODE_LABEL = "Review for me";
const IN_VIEW_AMOUNT = 0.3;

function PanelHeader() {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <RelayLogo />
        Relay
      </p>
      <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <ShieldCheckIcon aria-hidden="true" className="size-3.5" />
        {APPROVAL_MODE_LABEL}
      </p>
    </div>
  );
}

/** A picture of the composer: the real one lives in the app. */
function ComposerMock() {
  return (
    <div
      aria-hidden="true"
      className="mx-3 mb-3 flex items-center gap-2 rounded-2xl border border-input bg-input/30 px-3 py-2.5"
    >
      <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {COMPOSER_PLACEHOLDER}
      </span>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <ArrowUpIcon className="size-3.5" />
      </span>
    </div>
  );
}

interface SessionPickerProps {
  activeIndex: number;
  onPick: (index: number) => void;
}

function SessionPicker({ activeIndex, onPick }: SessionPickerProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-muted-foreground/80">try:</span>
      {RELAY_SESSIONS.map((session, index) => (
        <button
          key={session.id}
          type="button"
          aria-pressed={index === activeIndex}
          onClick={() => onPick(index)}
          className={cn(
            "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            index === activeIndex
              ? "border-[var(--landing-accent)]/50 bg-[var(--landing-accent)]/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {session.tab}
        </button>
      ))}
    </div>
  );
}

/** The hero visual: Relay working through a request, the way its panel shows it. */
export function RelaySession() {
  const figureRef = useRef<HTMLElement>(null);
  // Off screen the current run finishes and holds instead of looping unseen.
  const inView = useInView(figureRef, { amount: IN_VIEW_AMOUNT });
  const reduced = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  // Autoplay stops for good once someone picks a session themselves.
  const [autoplay, setAutoplay] = useState(true);
  const session = RELAY_SESSIONS[activeIndex];

  const advance = useCallback(
    () => setActiveIndex((index) => (index + 1) % RELAY_SESSIONS.length),
    [],
  );

  function pick(index: number) {
    setAutoplay(false);
    setActiveIndex(index);
  }

  return (
    <figure ref={figureRef} aria-label="Example Relay conversations">
      <div className="overflow-hidden rounded-xl border border-border bg-[var(--surface-deep)] shadow-2xl shadow-black/40">
        <PanelHeader />
        <div className="h-[26rem] overflow-hidden px-4 py-4 sm:h-[21rem]">
          <SessionTranscript
            key={session.id}
            session={session}
            animate={!reduced}
            onFinished={autoplay && inView ? advance : undefined}
          />
        </div>
        <ComposerMock />
      </div>
      <SessionPicker activeIndex={activeIndex} onPick={pick} />
    </figure>
  );
}
