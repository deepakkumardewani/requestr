"use client";

import { Trash2 } from "lucide-react";
import { MethodBadge } from "@/components/common/MethodBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getRelativeTime, truncateUrl } from "@/lib/utils";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HistoryEntry } from "@/types";

type HistoryItemProps = {
  entry: HistoryEntry;
};

export function HistoryItem({ entry }: HistoryItemProps) {
  const { tabs, openTab, setActiveTab } = useTabsStore();
  const deleteEntry = useHistoryStore((s) => s.deleteEntry);

  function handleClick() {
    const existing = tabs.find(
      (t) =>
        t.type === "http" && t.url === entry.url && t.method === entry.method,
    );
    if (existing) {
      setActiveTab(existing.tabId);
      return;
    }
    openTab({
      type: "http",
      name: entry.request.name || truncateUrl(entry.url, 30),
      method: entry.method,
      url: entry.url,
      params: entry.request.params,
      headers: entry.request.headers,
      auth: entry.request.auth,
      body: entry.request.body,
      preScript: entry.request.preScript,
      postScript: entry.request.postScript,
      isDirty: false,
    });
  }

  return (
    <div className="group flex items-center rounded transition-colors hover:bg-muted">
      <button
        type="button"
        onClick={handleClick}
        data-testid="history-item"
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left"
      >
        <MethodBadge method={entry.method} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs" data-testid="history-item-url">
            {entry.url}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {getRelativeTime(entry.timestamp)}
          </p>
        </div>
        <StatusBadge
          status={entry.status}
          className="shrink-0 text-[10px]"
          data-testid="history-item-status"
        />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          deleteEntry(entry.id);
        }}
        data-testid="history-item-delete"
        className="mr-1 shrink-0 rounded-sm p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 transition-[color,background-color,opacity] duration-200"
        title="Delete history entry"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
