import { safeStorage } from "@/lib/analytics/dedupe";

/**
 * Dedicated key. Never `rq_anon_id`: that one is sent as the rate-limit header
 * and must stay unlinkable to analytics (R14).
 */
export const ANALYTICS_ID_STORAGE_KEY = "rq_analytics_id";

/** Random per-browser id, created lazily and never derived from user data. */
export function getAnalyticsId(): string {
  const existing = safeStorage.get(ANALYTICS_ID_STORAGE_KEY);
  if (existing) return existing;
  const id = globalThis.crypto.randomUUID();
  safeStorage.set(ANALYTICS_ID_STORAGE_KEY, id);
  return id;
}

/** Called on opt-out; the next `getAnalyticsId` mints a fresh id. */
export function clearAnalyticsId(): void {
  safeStorage.remove(ANALYTICS_ID_STORAGE_KEY);
}
