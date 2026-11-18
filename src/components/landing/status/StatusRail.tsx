"use client";

import { type CSSProperties, useRef } from "react";
import { SECTION_ORDER } from "../data/links";
import { type SectionFrame, useActiveSection } from "../hooks/useActiveSection";
import { RailTrack } from "./RailTrack";
import { RollingCode } from "./RollingCode";
import { railProgress } from "./railProgress";
import {
  STATUS_CLASS_COLOR,
  STATUS_PHRASES,
  statusClassOf,
  statusForSection,
} from "./statusCodes";

/** The element that holds every section; the footer starts where it ends. */
const MAIN_ID = "app-main";
/** Once the page's end rises above this share of the viewport, the rail bows out. */
const EXIT_LINE = 0.85;

/** Writes progress and the exit flag straight to the DOM so scrolling never re-renders. */
function useRailFrame() {
  const railRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);

  const onFrame = ({ tops, line, viewportHeight }: SectionFrame) => {
    const main = document.getElementById(MAIN_ID);
    if (!main) return;
    const end = main.getBoundingClientRect().bottom;
    const progress = railProgress(SECTION_ORDER, tops, { line, end });
    fillRef.current?.style.setProperty("transform", `scaleY(${progress})`);
    railRef.current?.setAttribute(
      "data-exit",
      String(end < viewportHeight * EXIT_LINE),
    );
  };

  return { railRef, fillRef, onFrame };
}

interface RailPhraseProps {
  code: number;
  phrase: string;
  aside?: string;
}

/**
 * Reason phrase and aside, set on their side like a book spine. In vertical
 * writing `flex-col` lays them out as neighbouring columns, so each gets the
 * full rail height instead of splitting it and wrapping mid-phrase.
 */
function RailPhrase({ code, phrase, aside }: RailPhraseProps) {
  return (
    <span
      key={code}
      className="hidden animate-[panel-in_320ms_ease-out] flex-col gap-1.5 [writing-mode:vertical-rl] motion-reduce:animate-none xl:flex"
    >
      <span className="font-mono text-[11px] font-medium tracking-wide whitespace-nowrap text-[var(--status-color)] transition-colors duration-500">
        {phrase}
      </span>
      {aside ? (
        <span className="text-[11px] text-muted-foreground/70">{aside}</span>
      ) : null}
    </span>
  );
}

/**
 * The current section's HTTP status, pinned in the right-hand gutter. Pure
 * decoration: the codes are a running joke, not navigation.
 */
export function StatusRail() {
  const { railRef, fillRef, onFrame } = useRailFrame();
  const status = statusForSection(useActiveSection(SECTION_ORDER, { onFrame }));
  const color = STATUS_CLASS_COLOR[statusClassOf(status.code)];

  return (
    <div
      ref={railRef}
      aria-hidden="true"
      data-testid="status-rail"
      data-exit="false"
      data-yield={String(Boolean(status.yieldsRail))}
      style={{ "--status-color": color } as CSSProperties}
      className="pointer-events-none fixed top-1/2 right-1 z-40 hidden -translate-y-1/2 flex-col items-center gap-3 transition-opacity duration-500 select-none data-[exit=true]:opacity-0 data-[yield=true]:opacity-0 md:flex xl:right-5"
    >
      <RollingCode
        code={status.code}
        className="hidden font-mono text-[13px] font-semibold text-[var(--status-color)] transition-colors duration-500 xl:inline-flex"
      />
      <div className="flex h-64 gap-2.5">
        <RailPhrase
          code={status.code}
          phrase={STATUS_PHRASES[status.code]}
          aside={status.aside}
        />
        <RailTrack activeId={status.sectionId} fillRef={fillRef} />
      </div>
    </div>
  );
}
