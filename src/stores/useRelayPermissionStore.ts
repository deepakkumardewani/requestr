"use client";

import { create } from "zustand";
import { RELAY_STORAGE_KEYS } from "@/lib/relay/constants";
import {
  isRelayPermissionMode,
  RELAY_DEFAULT_PERMISSION_MODE,
  type RelayPermissionMode,
} from "@/lib/relay/permission";
import { trackRelayEvent } from "@/lib/relay/telemetry";

type RelayPermissionState = {
  mode: RelayPermissionMode;
};

type RelayPermissionActions = {
  setMode: (mode: RelayPermissionMode) => void;
  hydrate: () => void;
};

/** A storage failure or unknown value falls back to the safe default, with context logged. */
function readMode(): RelayPermissionMode {
  if (typeof localStorage === "undefined") return RELAY_DEFAULT_PERMISSION_MODE;
  try {
    const stored = localStorage.getItem(RELAY_STORAGE_KEYS.permission);
    if (stored === null) return RELAY_DEFAULT_PERMISSION_MODE;
    if (isRelayPermissionMode(stored)) return stored;
    console.warn("[relay] unknown permission mode in storage", {
      key: RELAY_STORAGE_KEYS.permission,
      stored,
    });
  } catch (error) {
    console.warn("[relay] reading permission mode failed", {
      key: RELAY_STORAGE_KEYS.permission,
      error,
    });
  }
  return RELAY_DEFAULT_PERMISSION_MODE;
}

function writeMode(mode: RelayPermissionMode): void {
  try {
    localStorage.setItem(RELAY_STORAGE_KEYS.permission, mode);
  } catch (error) {
    console.warn("[relay] writing permission mode failed", {
      key: RELAY_STORAGE_KEYS.permission,
      error,
    });
  }
}

let followingOtherTabs = false;

/**
 * A mode changed in another tab applies here at once, so tightening it in one
 * tab can never be outrun by a tool call in another (HH-M24). Registered once,
 * after mount; storage events only fire for writes from other tabs.
 */
function followModeAcrossTabs(
  apply: (mode: RelayPermissionMode) => void,
): void {
  if (followingOtherTabs || typeof window === "undefined") return;
  followingOtherTabs = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== RELAY_STORAGE_KEYS.permission) {
      return;
    }
    apply(readMode());
  });
}

/** Global approval mode, not per thread. */
export const useRelayPermissionStore = create<
  RelayPermissionState & RelayPermissionActions
>((set, get) => ({
  // Read after mount via `hydrate`, so the first client render matches the server HTML.
  mode: RELAY_DEFAULT_PERMISSION_MODE,

  setMode(mode) {
    const from = get().mode;
    if (!isRelayPermissionMode(mode) || mode === from) return;
    writeMode(mode);
    set({ mode });
    trackRelayEvent("relay_permission_mode_changed", { from, to: mode });
  },

  hydrate() {
    set({ mode: readMode() });
    followModeAcrossTabs((mode) => set({ mode }));
  },
}));
