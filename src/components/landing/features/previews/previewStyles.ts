import type { CSSProperties } from "react";

/** Shared frame for the hub's mini-previews: small mono type on the card ground. */
export const PREVIEW_FRAME =
  "flex h-full w-full flex-col justify-center gap-1.5 px-3 font-mono text-[10px] leading-tight";
export const PREVIEW_PANEL =
  "rounded-md border border-border/60 bg-background/60 px-2 py-1.5";
/** Lines fade in one after another, hold, then reset; still and visible under reduced motion. */
export const PREVIEW_RISE =
  "motion-safe:animate-[preview-rise_6s_ease-out_infinite]";
export const PREVIEW_BLINK =
  "motion-safe:animate-[preview-blink_2s_ease-in-out_infinite]";

const STAGGER_S = 0.6;

/** Offsets the nth line of a sequence so they arrive in order. */
export function staggerStyle(index: number): CSSProperties {
  return { animationDelay: `${index * STAGGER_S}s` };
}
