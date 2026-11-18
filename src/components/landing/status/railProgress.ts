import type { SectionTop } from "../hooks/useActiveSection";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Share of the page read so far, 0-1, laid out so each section owns an equal
 * slice of the rail. That keeps the ticks evenly spaced however tall the
 * sections are. `tops` are the sections found on the page, in order; `end`
 * is where the last one finishes.
 */
export function railProgress(
  order: readonly string[],
  tops: readonly SectionTop[],
  bounds: { line: number; end: number },
): number {
  const { line, end } = bounds;
  const passed = tops.filter((section) => section.top <= line);
  const current = passed.at(-1);
  if (!current || order.length === 0) return 0;

  const slot = order.indexOf(current.id);
  if (slot === -1) return 0;
  const nextTop = tops[tops.indexOf(current) + 1]?.top ?? end;
  const span = nextTop - current.top;
  const within = span > 0 ? clamp01((line - current.top) / span) : 1;
  return clamp01((slot + within) / order.length);
}

/** Where tick `index` of `count` sits along the rail, 0-1. */
export function tickPosition(index: number, count: number): number {
  return count > 0 ? index / count : 0;
}
