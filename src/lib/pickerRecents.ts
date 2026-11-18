import type { HistoryEntry, RequestModel } from "@/types";

export const PICKER_RECENT_MAX = 5;

/**
 * Ids of the most recently run saved requests (D15). History entries only link to a saved request
 * through `request.requestId`; entries without a link, or whose request was since deleted, are skipped.
 */
export function selectRecentRequestIds(
  history: readonly HistoryEntry[],
  requests: readonly Pick<RequestModel, "id">[],
  max: number = PICKER_RECENT_MAX,
): string[] {
  if (max <= 0 || history.length === 0 || requests.length === 0) return [];
  const existing = new Set(requests.map((request) => request.id));
  const recent = new Set<string>();
  const newestFirst = [...history].sort((a, b) => b.timestamp - a.timestamp);
  for (const { request } of newestFirst) {
    if (recent.size >= max) break;
    if (request.requestId && existing.has(request.requestId))
      recent.add(request.requestId);
  }
  return [...recent];
}
