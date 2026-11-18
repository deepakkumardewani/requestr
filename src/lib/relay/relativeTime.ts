export type RelativeTimeUnit =
  | "now"
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months"
  | "years";

export type RelativeTime = { unit: RelativeTimeUnit; value: number };

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;
const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;

/**
 * Compact relative age for a thread row. Never reports seconds; future
 * timestamps (clock skew) clamp to "now".
 */
export function formatRelativeTime(
  timestamp: number,
  now: number = Date.now(),
): RelativeTime {
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < MS_PER_MINUTE) return { unit: "now", value: 0 };
  if (elapsed < MS_PER_HOUR) {
    return { unit: "minutes", value: Math.floor(elapsed / MS_PER_MINUTE) };
  }
  if (elapsed < MS_PER_DAY) {
    return { unit: "hours", value: Math.floor(elapsed / MS_PER_HOUR) };
  }
  const days = Math.floor(elapsed / MS_PER_DAY);
  if (days < DAYS_PER_WEEK) return { unit: "days", value: days };
  if (days < DAYS_PER_MONTH) {
    return { unit: "weeks", value: Math.floor(days / DAYS_PER_WEEK) };
  }
  if (days < DAYS_PER_YEAR) {
    return { unit: "months", value: Math.floor(days / DAYS_PER_MONTH) };
  }
  return { unit: "years", value: Math.floor(days / DAYS_PER_YEAR) };
}
