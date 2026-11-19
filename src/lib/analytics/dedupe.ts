/**
 * Browser storage with an in-memory fallback, plus once-only helpers that stop
 * one-shot events (e.g. `first_request_sent`) and runaway loops from flooding.
 * Storage failures (private mode, quota, disabled) degrade to memory and never throw.
 */

const ONCE_KEY_PREFIX = "rq_analytics_once:";

const memory = new Map<string, string>();
let storageFailureLogged = false;

function logStorageFailure(error: unknown): void {
  if (storageFailureLogged) return;
  storageFailureLogged = true;
  console.warn("[requestly] analytics: localStorage unavailable", error);
}

export const safeStorage = {
  get(key: string): string | null {
    try {
      const value = globalThis.localStorage?.getItem(key);
      if (value != null) return value;
    } catch (error) {
      logStorageFailure(error);
    }
    return memory.get(key) ?? null;
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch (error) {
      logStorageFailure(error);
    }
  },
  remove(key: string): void {
    memory.delete(key);
    try {
      globalThis.localStorage?.removeItem(key);
    } catch (error) {
      logStorageFailure(error);
    }
  },
};

/** One-shot-ever per browser: true the first time `key` is seen, false afterwards. */
export function shouldSendOnce(key: string): boolean {
  const storageKey = ONCE_KEY_PREFIX + key;
  if (safeStorage.get(storageKey) !== null) return false;
  safeStorage.set(storageKey, "1");
  return true;
}

/** Once per page session: true the first time `key` is seen since the module loaded. */
const sessionSeen = new Set<string>();
export function shouldSendOncePerSession(key: string): boolean {
  if (sessionSeen.has(key)) return false;
  sessionSeen.add(key);
  return true;
}

/** Allows at most `max` calls per session for `key`; the counter lives in memory only. */
const sessionCounts = new Map<string, number>();
export function withinSessionCap(key: string, max: number): boolean {
  const count = sessionCounts.get(key) ?? 0;
  if (count >= max) return false;
  sessionCounts.set(key, count + 1);
  return true;
}

/** Test seam: clears in-memory state (storage is cleared by the caller). */
export function resetDedupeState(): void {
  memory.clear();
  sessionSeen.clear();
  sessionCounts.clear();
  storageFailureLogged = false;
}
