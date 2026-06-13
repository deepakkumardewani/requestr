"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface TextTypeProps {
  /** Phrase(s) to type. Multiple phrases cycle with a delete-and-retype loop. */
  text: string | string[];
  className?: string;
  /** ms per character while typing */
  typingSpeed?: number;
  /** ms per character while deleting */
  deletingSpeed?: number;
  /** ms to hold a fully-typed phrase before deleting */
  pauseDuration?: number;
  showCursor?: boolean;
  cursorChar?: string;
}

/**
 * Typewriter text. The first phrase is rendered statically for SSR/LCP and
 * when reduced-motion is requested — the animation only starts after hydration.
 */
export function TextType({
  text,
  className,
  typingSpeed = 60,
  deletingSpeed = 35,
  pauseDuration = 2000,
  showCursor = true,
  cursorChar = "|",
}: TextTypeProps) {
  const phrases = Array.isArray(text) ? text : [text];
  const reduced = useReducedMotion();

  const [display, setDisplay] = useState(phrases[0]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (reduced) return;
    // Begin from an empty string on first client tick so the typing is visible.
    if (!startedRef.current) {
      startedRef.current = true;
      setDisplay("");
      return;
    }

    const phrase = phrases[phraseIndex];
    const atFull = display === phrase;
    const atEmpty = display === "";

    let delay = deleting ? deletingSpeed : typingSpeed;
    if (atFull && !deleting) delay = pauseDuration;

    const id = setTimeout(() => {
      if (!deleting) {
        if (atFull) {
          if (phrases.length > 1) setDeleting(true);
          return;
        }
        setDisplay(phrase.slice(0, display.length + 1));
      } else {
        if (atEmpty) {
          setDeleting(false);
          setPhraseIndex((i) => (i + 1) % phrases.length);
          return;
        }
        setDisplay(phrase.slice(0, display.length - 1));
      }
    }, delay);

    return () => clearTimeout(id);
  }, [
    display,
    deleting,
    phraseIndex,
    phrases,
    reduced,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
  ]);

  return (
    <span className={cn("inline-block", className)}>
      <span className="sr-only">{phrases[0]}</span>
      <span aria-hidden={reduced ? undefined : true}>{display}</span>
      {showCursor && !reduced && (
        <span className="ml-0.5 animate-pulse" aria-hidden="true">
          {cursorChar}
        </span>
      )}
    </span>
  );
}
