"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { getDB } from "@/lib/idb";
import type { AppSettings } from "@/types";

type SettingsState = AppSettings & {
  hydrated: boolean;
};

type SettingsActions = {
  setSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
  pinRequest: (requestId: string) => void;
  unpinRequest: (requestId: string) => void;
  hydrate: () => Promise<void>;
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  proxyUrl: "",
  sslVerify: true,
  followRedirects: true,
  showHealthMonitor: true,
  showCodeGen: true,
  codeGenLang: "cURL",
  autoExpandExplainer: true,
  locale: "en",
  globalBaseUrl: "",
  globalHeaders: [],
  pinnedRequestIds: [],
  accentColor: { r: 52, g: 211, b: 153 },
};

async function persistSettings(settings: AppSettings) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.put("settings", settings, "app");
  } catch (error) {
    toast.error("Failed to save settings", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const useSettingsStore = create<SettingsState & SettingsActions>(
  (set, get) => ({
    ...DEFAULT_SETTINGS,
    hydrated: false,

    setSetting(key, value) {
      set({ [key]: value });
      const s = get() as SettingsState;
      persistSettings({
        theme: s.theme,
        proxyUrl: s.proxyUrl,
        sslVerify: s.sslVerify,
        followRedirects: s.followRedirects,
        showHealthMonitor: s.showHealthMonitor,
        showCodeGen: s.showCodeGen,
        codeGenLang: s.codeGenLang,
        autoExpandExplainer: s.autoExpandExplainer,
        locale: s.locale,
        globalBaseUrl: s.globalBaseUrl,
        globalHeaders: s.globalHeaders,
        pinnedRequestIds: s.pinnedRequestIds,
        accentColor: s.accentColor,
      });
    },

    pinRequest(requestId) {
      const s = get() as SettingsState;
      if (s.pinnedRequestIds.includes(requestId)) return;
      const updated = [...s.pinnedRequestIds, requestId];
      set({ pinnedRequestIds: updated });
      persistSettings({ ...s, pinnedRequestIds: updated });
    },

    unpinRequest(requestId) {
      const s = get() as SettingsState;
      const updated = s.pinnedRequestIds.filter((id) => id !== requestId);
      set({ pinnedRequestIds: updated });
      persistSettings({ ...s, pinnedRequestIds: updated });
    },

    async hydrate() {
      const db = getDB();
      if (!db) return;
      try {
        const instance = await db;
        const saved = await instance.get("settings", "app");
        if (saved) {
          set({ ...DEFAULT_SETTINGS, ...saved, hydrated: true });
        } else {
          set({ hydrated: true });
        }
      } catch (error) {
        toast.error("Failed to load settings", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        set({ hydrated: true });
      }
    },
  }),
);
