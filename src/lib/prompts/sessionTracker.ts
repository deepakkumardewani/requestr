import { safeStorage } from "@/lib/analytics/dedupe";

/**
 * Local-date strings of the days the app was opened. Independent of analytics
 * consent: prompts and `session_day_index` read it even when analytics is off.
 */
export const SESSION_DAYS_STORAGE_KEY = "rq_session_days";
const MAX_STORED_DAYS = 365;
const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

function toLocalDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function readStoredDays(): string[] {
  const raw = safeStorage.get(SESSION_DAYS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is string =>
        typeof value === "string" && DAY_FORMAT.test(value),
    );
  } catch (error) {
    console.warn("[requestly] sessionTracker: corrupt session days", error);
    return [];
  }
}

/** Sorted, de-duplicated days up to and including today; future-dated entries are ignored. */
export function getSessionDays(now: Date = new Date()): string[] {
  const today = toLocalDay(now);
  return [...new Set(readStoredDays())].filter((day) => day <= today).sort();
}

/** Records today as a session day (idempotent within a day). */
export function recordSession(now: Date = new Date()): void {
  const today = toLocalDay(now);
  const days = getSessionDays(now);
  if (days.includes(today)) return;
  const next = [...days, today].slice(-MAX_STORED_DAYS);
  safeStorage.set(SESSION_DAYS_STORAGE_KEY, JSON.stringify(next));
}

/** True when no day is recorded yet or the earliest recorded day is today. */
export function isFirstSession(now: Date = new Date()): boolean {
  const [first] = getSessionDays(now);
  return first === undefined || first === toLocalDay(now);
}
