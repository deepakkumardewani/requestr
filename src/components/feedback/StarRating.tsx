"use client";

import { Star } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  clampRating,
  MAX_RATING,
  MIN_RATING,
  RATING_VALUES,
} from "./ratingTone";

const ARROW_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

type StarRatingProps = {
  value: number | null;
  onChange: (value: number) => void;
  /** Accessible name of the whole group. */
  label: string;
  /** Accessible name of one star, e.g. "4 out of 5, Pretty good". */
  optionLabel: (value: number) => string;
  /** Short word shown next to the stars, e.g. "Pretty good". */
  valueText: (value: number) => string;
  /** Shown next to the stars before anything is rated or previewed. */
  hint: string;
};

/** Arrow keys step one star (clamped), Home/End jump to the ends; other keys are ignored. */
function ratingForKey(key: string, current: number | null): number | null {
  if (key === "Home") return MIN_RATING;
  if (key === "End") return MAX_RATING;
  const step = ARROW_STEP[key];
  if (step === undefined) return null;
  return clampRating((current ?? 0) + step);
}

/** Only one star is in the tab order: the checked one, or the first when none is. */
function isTabStop(rating: number, value: number | null): boolean {
  return value === null ? rating === MIN_RATING : rating === value;
}

export function StarRating({
  value,
  onChange,
  label,
  optionLabel,
  valueText,
  hint,
}: StarRatingProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const starRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shown = preview ?? value;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = ratingForKey(event.key, value);
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    starRefs.current[next - 1]?.focus();
  };

  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label={label}
        className="-ml-1.5 flex"
        onKeyDown={handleKeyDown}
        onPointerLeave={() => setPreview(null)}
      >
        {RATING_VALUES.map((rating) => (
          <StarButton
            key={rating}
            ref={(node) => {
              starRefs.current[rating - 1] = node;
            }}
            rating={rating}
            checked={value === rating}
            lit={shown !== null && rating <= shown}
            tabStop={isTabStop(rating, value)}
            label={optionLabel(rating)}
            onSelect={() => onChange(rating)}
            onPreview={() => setPreview(rating)}
          />
        ))}
      </div>
      <span
        aria-hidden="true"
        data-testid="feedback-rating-text"
        className={cn(
          "text-sm transition-colors",
          shown === null
            ? "text-muted-foreground"
            : "font-medium text-foreground",
        )}
      >
        {shown === null ? hint : valueText(shown)}
      </span>
    </div>
  );
}

type StarButtonProps = {
  ref: (node: HTMLButtonElement | null) => void;
  rating: number;
  checked: boolean;
  lit: boolean;
  tabStop: boolean;
  label: string;
  onSelect: () => void;
  onPreview: () => void;
};

function StarButton({
  ref,
  rating,
  checked,
  lit,
  tabStop,
  label,
  onSelect,
  onPreview,
}: StarButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      tabIndex={tabStop ? 0 : -1}
      data-testid={`feedback-rating-${rating}`}
      className="rounded-md p-1.5 outline-none transition-transform duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:hover:scale-110 motion-safe:active:scale-95"
      onClick={onSelect}
      onPointerEnter={onPreview}
    >
      <Star
        strokeWidth={1.5}
        className={cn(
          "size-7 transition-colors duration-150",
          lit
            ? "fill-amber-400 text-amber-500 dark:text-amber-400"
            : // Full-strength outline keeps the empty star at >=3:1 (WCAG 1.4.11) in both themes.
              "fill-muted-foreground/15 text-muted-foreground",
        )}
      />
    </button>
  );
}
