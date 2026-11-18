"use client";

import { useEffect, useRef, useState } from "react";

/** A section counts as current once its top passes this share of the viewport. */
const ACTIVATION_LINE = 0.35;

export interface SectionTop {
  id: string;
  top: number;
}

/** Everything one scroll frame measured, for callers that draw from it directly. */
export interface SectionFrame {
  tops: readonly SectionTop[];
  /** The activation line, in viewport pixels. */
  line: number;
  viewportHeight: number;
}

interface ActiveSectionOptions {
  /** Runs on every measured frame; write styles here, not React state. */
  onFrame?: (frame: SectionFrame) => void;
}

/** Last section, in page order, whose top has scrolled past the line. */
export function pickActiveSection(
  sections: readonly SectionTop[],
  line: number,
): string | null {
  let active: string | null = null;
  for (const section of sections) {
    if (section.top <= line) active = section.id;
  }
  return active;
}

function measure(ids: readonly string[]): SectionTop[] {
  const tops: SectionTop[] = [];
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) tops.push({ id, top: element.getBoundingClientRect().top });
  }
  return tops;
}

/**
 * Id of the section the reader is in. Measured on scroll rather than cached,
 * because lazily loaded sections change the page height after first paint.
 */
export function useActiveSection(
  ids: readonly string[],
  options: ActiveSectionOptions = {},
): string | null {
  const [active, setActive] = useState<string | null>(null);
  // Held in a ref so an inline callback does not re-subscribe every render.
  const onFrameRef = useRef(options.onFrame);
  useEffect(() => {
    onFrameRef.current = options.onFrame;
  });

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const viewportHeight = window.innerHeight;
      const line = viewportHeight * ACTIVATION_LINE;
      const tops = measure(ids);
      setActive(pickActiveSection(tops, line));
      onFrameRef.current?.({ tops, line, viewportHeight });
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);

  return active;
}
