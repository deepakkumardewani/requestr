import { healthKey } from "@/lib/healthMonitor";
import type { HistoryEntry } from "@/types";

/** Compact mode keeps this many groups (with their day headers). */
export const COMPACT_GROUP_LIMIT = 20;

const TODAY_LABEL = "Today";
const YESTERDAY_LABEL = "Yesterday";
const DATE_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
};

export type HistoryHeaderRow = {
  kind: "header";
  id: string;
  label: string;
};

export type HistoryGroupSummaryRow = {
  kind: "group";
  id: string;
  method: HistoryEntry["method"];
  url: string;
  /** Number of runs that survive the active filter. */
  count: number;
  latest: HistoryEntry;
};

export type HistoryRunRow = {
  kind: "run";
  id: string;
  /** Null for a lone run that is not part of a group (N = 1). */
  groupId: string | null;
  entry: HistoryEntry;
};

export type HistoryRow =
  | HistoryHeaderRow
  | HistoryGroupSummaryRow
  | HistoryRunRow;

type GroupOptions = { now: number; filter: string };

/** Same predicate the list always used: url, method or normalised health key. */
export function matchesHistoryFilter(
  entry: HistoryEntry,
  filter: string,
): boolean {
  if (!filter) return true;
  const term = filter.toLowerCase();
  return (
    entry.url.toLowerCase().includes(term) ||
    entry.method.toLowerCase().includes(term) ||
    healthKey(entry.method, entry.url).toLowerCase().includes(term)
  );
}

/** Local-timezone calendar day, e.g. "2026-10-3"; immune to DST-length days. */
function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(timestamp: number, now: number): string {
  const key = dayKey(timestamp);
  if (key === dayKey(now)) return TODAY_LABEL;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKey(yesterday.getTime())) return YESTERDAY_LABEL;

  return new Date(timestamp).toLocaleDateString(undefined, DATE_LABEL_OPTIONS);
}

function buildDayRows(
  dayEntries: HistoryEntry[],
  key: string,
  label: string,
): HistoryRow[] {
  const rows: HistoryRow[] = [{ kind: "header", id: `header:${key}`, label }];
  const byRequest = new Map<string, HistoryEntry[]>();
  for (const entry of dayEntries) {
    const requestKey = `${entry.method} ${entry.url}`;
    const runs = byRequest.get(requestKey);
    if (runs) runs.push(entry);
    else byRequest.set(requestKey, [entry]);
  }

  // Map preserves first-seen order, and entries are newest-first, so groups
  // are ordered by their latest run.
  for (const [requestKey, runs] of byRequest) {
    const [latest] = runs;
    if (runs.length === 1) {
      rows.push({
        kind: "run",
        id: `run:${latest.id}`,
        groupId: null,
        entry: latest,
      });
      continue;
    }
    const groupId = `group:${key}:${requestKey}`;
    rows.push({
      kind: "group",
      id: groupId,
      method: latest.method,
      url: latest.url,
      count: runs.length,
      latest,
    });
    for (const entry of runs) {
      rows.push({ kind: "run", id: `run:${entry.id}`, groupId, entry });
    }
  }
  return rows;
}

/**
 * Filters runs first, then groups identical method + url within each local
 * day. Output keeps every group's runs; `toVisibleRows` hides collapsed ones.
 */
export function groupHistoryByDay(
  entries: HistoryEntry[],
  { now, filter }: GroupOptions,
): HistoryRow[] {
  const sorted = entries
    .filter((entry) => matchesHistoryFilter(entry, filter))
    .sort((a, b) => b.timestamp - a.timestamp);

  const rows: HistoryRow[] = [];
  let index = 0;
  while (index < sorted.length) {
    const key = dayKey(sorted[index].timestamp);
    const dayEntries: HistoryEntry[] = [];
    while (index < sorted.length && dayKey(sorted[index].timestamp) === key) {
      dayEntries.push(sorted[index]);
      index += 1;
    }
    rows.push(
      ...buildDayRows(dayEntries, key, dayLabel(dayEntries[0].timestamp, now)),
    );
  }
  return rows;
}

/** Keeps the first `limit` groups (a lone run counts as one) and their headers. */
export function limitGroups(rows: HistoryRow[], limit: number): HistoryRow[] {
  const kept: HistoryRow[] = [];
  let pendingHeader: HistoryHeaderRow | null = null;
  let groupCount = 0;

  for (const row of rows) {
    if (row.kind === "header") {
      pendingHeader = row;
      continue;
    }
    const startsGroup = row.kind === "group" || row.groupId === null;
    if (startsGroup) {
      if (groupCount >= limit) break;
      groupCount += 1;
      if (pendingHeader) {
        kept.push(pendingHeader);
        pendingHeader = null;
      }
    }
    kept.push(row);
  }
  return kept;
}

/** Flat model for the virtualizer: drops runs of groups that are not expanded. */
export function toVisibleRows(
  rows: HistoryRow[],
  expandedIds: ReadonlySet<string>,
): HistoryRow[] {
  return rows.filter(
    (row) =>
      row.kind !== "run" ||
      row.groupId === null ||
      expandedIds.has(row.groupId),
  );
}
