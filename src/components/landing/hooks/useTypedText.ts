"use client";

import { useEffect, useState } from "react";

const TYPE_INTERVAL_MS = 26;

interface TypedTextOptions {
  /** False pauses the typing where it is, e.g. while off screen. */
  running: boolean;
  /** True shows the whole text at once, for reduced motion. */
  instant: boolean;
}

/**
 * Reveals `text` one character at a time. Mount it under a `key` that changes
 * with the text so each new text starts from empty.
 */
export function useTypedText(
  text: string,
  { running, instant }: TypedTextOptions,
) {
  const [length, setLength] = useState(0);
  const done = instant || length >= text.length;

  useEffect(() => {
    if (done || !running) return;
    const timer = setInterval(
      () => setLength((current) => current + 1),
      TYPE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [done, running]);

  return { typed: instant ? text : text.slice(0, length), done };
}
