"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { rollDigits, stripOffsetPercent } from "./digits";

const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
/** Long enough to read as a roll, short enough to keep up with a fast scroll. */
const ROLL_MS = 620;
const ROLL_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
/**
 * Each row is taller than the glyph so a neighbouring digit's strokes, which
 * overshoot a 1em box in mono fonts, never peek into the clipped window.
 */
const ROW_HEIGHT = "h-[1.25em] leading-[1.25em]";

/** Remembers the code shown before the current one, to know which digits move. */
function usePreviousCode(code: number): number {
  const [current, setCurrent] = useState(code);
  const [previous, setPrevious] = useState(code);
  if (code !== current) {
    setPrevious(current);
    setCurrent(code);
  }
  return previous;
}

interface DigitColumnProps {
  digit: number;
  delayMs: number;
}

function DigitColumn({ digit, delayMs }: DigitColumnProps) {
  return (
    <span
      className={cn(
        "relative inline-block w-[1ch] overflow-hidden",
        ROW_HEIGHT,
      )}
    >
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform motion-reduce:transition-none"
        style={{
          transform: `translateY(${stripOffsetPercent(digit)}%)`,
          transitionDuration: `${ROLL_MS}ms`,
          transitionDelay: `${delayMs}ms`,
          transitionTimingFunction: ROLL_EASE,
        }}
      >
        {STRIP.map((value) => (
          <span key={value} className={cn("block text-center", ROW_HEIGHT)}>
            {value}
          </span>
        ))}
      </span>
    </span>
  );
}

interface RollingCodeProps {
  code: number;
  className?: string;
}

/** A three-digit odometer: each changed column rolls to its new digit. */
export function RollingCode({ code, className }: RollingCodeProps) {
  const previous = usePreviousCode(code);
  return (
    <span
      className={cn("inline-flex leading-none tabular-nums", className)}
      data-code={code}
    >
      {rollDigits(previous, code).map((roll, index) => (
        <DigitColumn
          // Columns are positional: the hundreds column is always column 0.
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed three columns
          key={index}
          digit={roll.digit}
          delayMs={roll.delayMs}
        />
      ))}
    </span>
  );
}
