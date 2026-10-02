import { scoreItem } from "@/lib/pickerSearch";
import {
  createDayHeaderRow,
  type PickerListItem,
  type PickerRow,
} from "@/lib/pickerTree";
import type { HistoryEntry, HttpMethod } from "@/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NAME_SEGMENT_COUNT = 2;

/** A history entry in the shared picker row model; `id` of the row is `entry.id`. */
export type HistoryPickerItem = PickerListItem & { entry: HistoryEntry };

export type HistoryDayLabels = {
  today: string;
  yesterday: string;
  /** Header for any older day. */
  formatDate: (timestamp: number) => string;
};

export type GroupHistoryOptions = {
  labels: HistoryDayLabels;
  /** Injectable clock so day boundaries are testable. */
  now?: number;
  filter?: string;
  /** Narrows by method chip; return `true` to keep. */
  matchesMethod?: (method: HttpMethod) => boolean;
};

/** Last two path segments ("users/42"), then the host, then the raw url when it cannot be parsed. */
export function historyItemName(url: string): string {
  try {
    const { pathname, host } = new URL(url);
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length > 0)
      return segments.slice(-NAME_SEGMENT_COUNT).join("/");
    return host || url;
  } catch {
    return url;
  }
}

/** One entry per method + URL, keeping the most recent run; result is newest first. */
export function dedupeHistory(
  entries: readonly HistoryEntry[],
): HistoryEntry[] {
  const newestFirst = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const seen = new Set<string>();
  return newestFirst.filter((entry) => {
    const key = `${entry.method} ${entry.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const startOfDay = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

function dayLabel(timestamp: number, now: number, labels: HistoryDayLabels) {
  // Rounded so a 23/25-hour DST day still counts as one day.
  const daysAgo = Math.round(
    (startOfDay(now) - startOfDay(timestamp)) / MS_PER_DAY,
  );
  if (daysAgo <= 0) return labels.today;
  if (daysAgo === 1) return labels.yesterday;
  return labels.formatDate(timestamp);
}

/**
 * Dedupes, searches and groups history under day headers, as the same rows the collections tree
 * produces so virtualization, keyboard nav and selection need no history-specific code.
 */
export function groupHistoryByDay(
  entries: readonly HistoryEntry[],
  { labels, now = Date.now(), filter = "", matchesMethod }: GroupHistoryOptions,
): PickerRow<HistoryPickerItem>[] {
  const groups = new Map<string, PickerRow<HistoryPickerItem>[]>();
  for (const entry of dedupeHistory(entries)) {
    if (matchesMethod && !matchesMethod(entry.method)) continue;
    const item: HistoryPickerItem = {
      name: historyItemName(entry.url),
      method: entry.method,
      url: entry.url,
      entry,
    };
    const match = scoreItem(filter, item);
    if (!match) continue;
    const label = dayLabel(entry.timestamp, now, labels);
    const group = groups.get(label) ?? [];
    group.push({ kind: "item", id: entry.id, depth: 1, item, match });
    groups.set(label, group);
  }
  return [...groups].flatMap(([label, items]) => [
    createDayHeaderRow(label, items.length),
    ...items,
  ]);
}
