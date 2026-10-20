"use client";

import { create } from "zustand";
import { type ContextChip, chipKey } from "@/lib/relay/chips";
import { RELAY_RECENTS_CAP, RELAY_STORAGE_KEYS } from "@/lib/relay/constants";

/** Names and ids only: request bodies and values never reach storage (RP-215). */
export type RelayRecentItem = Pick<ContextChip, "kind" | "id"> & {
  name: string;
};

type RelayRecentState = {
  /** Most recently attached first, at most `RELAY_RECENTS_CAP`. */
  items: readonly RelayRecentItem[];
};

type RelayRecentActions = {
  recordRecent: (chip: ContextChip) => void;
  clear: () => void;
};

const isRecentItem = (value: unknown): value is RelayRecentItem => {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.kind === "string" &&
    typeof item.id === "string" &&
    typeof item.name === "string"
  );
};

/** A storage failure or corrupt payload degrades to "no recents", never an error in the dock. */
function readRecents(): RelayRecentItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const stored = localStorage.getItem(RELAY_STORAGE_KEYS.recent);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter(isRecentItem).slice(0, RELAY_RECENTS_CAP)
      : [];
  } catch (error) {
    console.warn("[relay] reading recents failed", {
      key: RELAY_STORAGE_KEYS.recent,
      error,
    });
    return [];
  }
}

function writeRecents(items: readonly RelayRecentItem[]): void {
  try {
    localStorage.setItem(RELAY_STORAGE_KEYS.recent, JSON.stringify(items));
  } catch (error) {
    console.warn("[relay] writing recents failed", {
      key: RELAY_STORAGE_KEYS.recent,
      error,
    });
  }
}

export const useRelayRecentStore = create<
  RelayRecentState & RelayRecentActions
>((set) => ({
  items: readRecents(),

  recordRecent(chip) {
    const entry: RelayRecentItem = {
      kind: chip.kind,
      id: chip.id,
      name: chip.label,
    };
    set((state) => {
      const items = [
        entry,
        ...state.items.filter((item) => chipKey(item) !== chipKey(entry)),
      ].slice(0, RELAY_RECENTS_CAP);
      writeRecents(items);
      return { items };
    });
  },

  clear() {
    writeRecents([]);
    set({ items: [] });
  },
}));
