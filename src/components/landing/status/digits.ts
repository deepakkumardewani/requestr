/** Every HTTP status code has exactly three digits. */
export const DIGIT_COUNT = 3;
const DIGIT_BASE = 10;
/** Pause between one changed digit and the next, so the roll reads left to right. */
export const ROLL_STAGGER_MS = 70;

export interface DigitRoll {
  digit: number;
  changed: boolean;
  /** How long this column waits before it starts rolling. */
  delayMs: number;
}

/** The three digits of a status code, most significant first. */
export function toDigits(code: number): readonly number[] {
  const text = String(code);
  if (!Number.isInteger(code) || text.length !== DIGIT_COUNT) {
    throw new RangeError(`Expected a three-digit status code, got ${code}`);
  }
  return [...text].map(Number);
}

/**
 * Per-column instructions for rolling from one code to the next. Unchanged
 * columns stay still; changed ones start one after another.
 */
export function rollDigits(from: number, to: number): readonly DigitRoll[] {
  const before = toDigits(from);
  let changedSoFar = 0;
  return toDigits(to).map((digit, index) => {
    const changed = digit !== before[index];
    const delayMs = changed ? changedSoFar * ROLL_STAGGER_MS : 0;
    if (changed) changedSoFar += 1;
    return { digit, changed, delayMs };
  });
}

/** translateY for a 0-9 strip so that `digit` sits in the window. */
export function stripOffsetPercent(digit: number): number {
  return -(digit * 100) / DIGIT_BASE;
}
