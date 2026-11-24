export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const RATING_VALUES = [1, 2, 3, 4, 5] as const;

/** Ratings at or below this read as "something went wrong". */
export const LOW_RATING_MAX = 2;
/** The middle rating: neither a complaint nor praise. */
export const NEUTRAL_RATING = 3;

export type PromptTone = "none" | "low" | "neutral" | "high";
export type ThanksTone = "low" | "mid" | "top";

/** Picks the follow-up question that fits the rating the user gave. */
export function getPromptTone(rating: number | null): PromptTone {
  if (rating === null) return "none";
  if (rating <= LOW_RATING_MAX) return "low";
  if (rating === NEUTRAL_RATING) return "neutral";
  return "high";
}

/** Picks the thank-you message; only a perfect score gets the warmest copy. */
export function getThanksTone(rating: number): ThanksTone {
  if (rating <= LOW_RATING_MAX) return "low";
  if (rating < MAX_RATING) return "mid";
  return "top";
}

export function clampRating(value: number): number {
  return Math.min(MAX_RATING, Math.max(MIN_RATING, value));
}
