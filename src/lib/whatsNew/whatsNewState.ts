import { safeStorage } from "@/lib/analytics/dedupe";
import { collectBackupData } from "@/lib/backup/exporter";
import { ONBOARDING_COMPLETE_KEY } from "@/lib/tour/startTour";

export const LAST_SEEN_VERSION_KEY = "rq_whats_new_last_seen";

/** Set from package.json at build time (next.config.ts). */
export const NEXT_PUBLIC_APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ?? "";

export function readLastSeenVersion(): string | null {
  return safeStorage.get(LAST_SEEN_VERSION_KEY);
}

export function recordSeenVersion(version: string): void {
  safeStorage.set(LAST_SEEN_VERSION_KEY, version);
}

async function hasSavedData(): Promise<boolean> {
  try {
    const data = await collectBackupData(["collections", "chains"]);
    return [data.requests, data.collections, data.chains].some(
      (records) => (records?.length ?? 0) > 0,
    );
  } catch (error) {
    // Unreadable data must not turn a new user into a returning one.
    console.warn("[requestly] whats-new: could not read saved data", error);
    return false;
  }
}

/**
 * Whether this browser has used the app before (R36): a stored version, a
 * finished onboarding, or saved data. Genuinely new users never see What's New.
 */
export async function isReturningUser(): Promise<boolean> {
  if (readLastSeenVersion() !== null) return true;
  if (safeStorage.get(ONBOARDING_COMPLETE_KEY) !== null) return true;
  return hasSavedData();
}
