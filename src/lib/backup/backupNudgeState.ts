import { safeStorage } from "@/lib/analytics/dedupe";
import { collectBackupData } from "@/lib/backup/exporter";
import { isFirstSession } from "@/lib/prompts/sessionTracker";

/** Epoch ms of the last successful export. Deliberately not in the backup preferences allowlist. */
export const LAST_BACKUP_EXPORT_KEY = "rq_last_backup_export";
export const BACKUP_NUDGE_SNOOZED_AT_KEY = "rq_backup_nudge_snoozed_at";

export const BACKUP_NUDGE_MIN_REQUESTS = 5;
export const BACKUP_NUDGE_MIN_CHAINS = 1;
export const BACKUP_NUDGE_MIN_COLLECTIONS_WITH_REQUESTS = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const BACKUP_NUDGE_INTERVAL_MS = 30 * MS_PER_DAY;
export const BACKUP_NUDGE_SNOOZE_MS = 14 * MS_PER_DAY;

/** At most one nudge per page session, even if the component remounts. */
let shownThisSession = false;

/** Epoch ms stored under `key`; null when absent, unparsable or future-dated (a bad clock must not suppress forever). */
function readTimestamp(key: string, now: number): number | null {
  const raw = safeStorage.get(key);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value <= now ? value : null;
}

function isWithin(timestamp: number | null, windowMs: number, now: number) {
  return timestamp !== null && now - timestamp < windowMs;
}

type CountedRecord = { id?: unknown; collectionId?: unknown };

function hasEnoughData(data: Awaited<ReturnType<typeof collectBackupData>>) {
  const requests = (data.requests ?? []) as CountedRecord[];
  const chains = data.chains ?? [];
  const collections = (data.collections ?? []) as CountedRecord[];
  if (requests.length >= BACKUP_NUDGE_MIN_REQUESTS) return true;
  if (chains.length >= BACKUP_NUDGE_MIN_CHAINS) return true;
  const populated = new Set(requests.map((request) => request.collectionId));
  const withContent = collections.filter((c) => populated.has(c.id)).length;
  return withContent >= BACKUP_NUDGE_MIN_COLLECTIONS_WITH_REQUESTS;
}

async function hasSavedData(): Promise<boolean> {
  try {
    return hasEnoughData(await collectBackupData(["collections", "chains"]));
  } catch (error) {
    // Unreadable data (e.g. mid-restore) must never produce a nudge.
    console.warn("[requestly] backup nudge: could not read saved data", error);
    return false;
  }
}

/**
 * Whether the backup reminder may show now (R39, R40): real saved data, no
 * export in 30 days, not snoozed, not session one, once per session. Both
 * timestamps are re-read here so another tab's export or dismissal counts.
 */
export async function shouldShowBackupNudge(
  now: number = Date.now(),
): Promise<boolean> {
  if (shownThisSession || isFirstSession(new Date(now))) return false;
  const lastExport = readTimestamp(LAST_BACKUP_EXPORT_KEY, now);
  if (isWithin(lastExport, BACKUP_NUDGE_INTERVAL_MS, now)) return false;
  const snoozedAt = readTimestamp(BACKUP_NUDGE_SNOOZED_AT_KEY, now);
  if (isWithin(snoozedAt, BACKUP_NUDGE_SNOOZE_MS, now)) return false;
  return hasSavedData();
}

/** Counts the nudge against this session's one-per-session allowance. */
export function markBackupNudgeShown(): void {
  shownThisSession = true;
}

/** Hides the nudge for 14 days (R40a). */
export function snoozeBackupNudge(now: number = Date.now()): void {
  safeStorage.set(BACKUP_NUDGE_SNOOZED_AT_KEY, String(now));
}

/** Called after a successful export; resets the 30-day clock. */
export function recordBackupExport(now: number = Date.now()): void {
  safeStorage.set(LAST_BACKUP_EXPORT_KEY, String(now));
}
