"use client";

import { create } from "zustand";
import type { SettingsSection } from "@/app/settings/constants";

/**
 * A section of Settings someone asked for. Next fires no `hashchange` when a
 * link only changes the hash, so a Settings page that is already open learns
 * of the request here instead.
 */
type SettingsSectionState = {
  requested: SettingsSection | null;
};

type SettingsSectionActions = {
  request: (section: SettingsSection) => void;
  /** The page calls this once it has switched, so the same section can be asked for again. */
  clear: () => void;
};

export const useSettingsSectionStore = create<
  SettingsSectionState & SettingsSectionActions
>((set) => ({
  requested: null,
  request: (section) => set({ requested: section }),
  clear: () => set({ requested: null }),
}));
