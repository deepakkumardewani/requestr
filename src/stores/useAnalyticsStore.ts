"use client";

import { create } from "zustand";
import { setEnabled as setAdapterEnabled } from "@/lib/analytics/adapter";
import { safeStorage } from "@/lib/analytics/dedupe";

/** Part of the backup allow-list: the opt-out choice travels with the workspace (R40a). */
export const ANALYTICS_ENABLED_STORAGE_KEY = "rq_analytics_enabled";

const OPTED_OUT_VALUE = "false";

type AnalyticsState = {
  /** The Settings toggle. Defaults on; DNT/GPC and environment gates are resolved separately by `resolveConsent`. */
  enabled: boolean;
};

type AnalyticsActions = {
  /** Persists the choice and applies it to the adapter in the same session. */
  setEnabled: (enabled: boolean) => void;
  /** Pushes the persisted choice into the adapter; call once before `initAnalytics`. */
  syncConsent: () => void;
};

function readEnabled(): boolean {
  return safeStorage.get(ANALYTICS_ENABLED_STORAGE_KEY) !== OPTED_OUT_VALUE;
}

function persistEnabled(enabled: boolean): void {
  if (enabled) {
    safeStorage.remove(ANALYTICS_ENABLED_STORAGE_KEY);
    return;
  }
  safeStorage.set(ANALYTICS_ENABLED_STORAGE_KEY, OPTED_OUT_VALUE);
}

export const useAnalyticsStore = create<AnalyticsState & AnalyticsActions>(
  (set, get) => ({
    enabled: readEnabled(),

    // Turning off drops the queue and `rq_analytics_id`; turning on lets the next event mint a fresh id.
    setEnabled(enabled) {
      persistEnabled(enabled);
      set({ enabled });
      setAdapterEnabled(enabled);
    },

    syncConsent() {
      setAdapterEnabled(get().enabled);
    },
  }),
);
