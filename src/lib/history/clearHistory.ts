import { useHistoryStore } from "@/stores/useHistoryStore";

/** Clears all history and returns how many entries were removed. Callers confirm first. */
export function clearHistory(): { count: number } {
  const { entries, clearHistory: clearStore } = useHistoryStore.getState();
  const count = entries.length;
  clearStore();
  return { count };
}
