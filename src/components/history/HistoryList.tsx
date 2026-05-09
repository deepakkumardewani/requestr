"use client";

import { Download } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { SampleRequestCards } from "@/components/common/SampleRequestCards";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { healthKey } from "@/lib/healthMonitor";
import {
  buildExportFilename,
  downloadFile,
  exportHistoryAsCSV,
  exportHistoryAsJSON,
} from "@/lib/historyExport";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import { HistoryItem } from "./HistoryItem";

type HistoryListProps = {
  compact?: boolean;
  /** When provided, overrides the internal filter input (e.g. main sidebar search bar). */
  filter?: string;
};

export function HistoryList({ compact = false, filter }: HistoryListProps) {
  const entries = useHistoryStore((s) => s.entries);
  const { historyFilter } = useUIStore();

  // External filter takes priority over the internal UIStore filter
  const activeFilter = filter ?? historyFilter ?? "";

  const filtered = activeFilter
    ? entries.filter((e) => {
        const term = activeFilter.toLowerCase();
        // Support both free-text search and normalised health key matching
        return (
          e.url.toLowerCase().includes(term) ||
          e.method.toLowerCase().includes(term) ||
          healthKey(e.method, e.url).toLowerCase().includes(term)
        );
      })
    : entries;

  const displayed = compact ? filtered.slice(0, 20) : filtered;

  function handleExportCSV() {
    const content = exportHistoryAsCSV(filtered);
    downloadFile(content, buildExportFilename("csv"), "text/csv;charset=utf-8");
  }

  function handleExportJSON() {
    const content = exportHistoryAsJSON(filtered);
    downloadFile(
      content,
      buildExportFilename("json"),
      "application/json;charset=utf-8",
    );
  }

  return (
    <div
      data-testid="history-list"
      className={`flex flex-col ${compact ? "" : "h-full"}`}
    >
      {displayed.length === 0 ? (
        activeFilter ? (
          <EmptyState
            title="No matches"
            description="Try a different search"
            className="py-4"
          />
        ) : (
          <div className="flex flex-col gap-4 px-3 py-6">
            <EmptyState
              title="No requests sent yet"
              description="Your history appears here as you work"
              className="py-0"
            />
            <SampleRequestCards />
          </div>
        )
      ) : (
        <>
          {/* Export button — only shown in full (non-compact) mode */}
          {!compact && (
            <div className="flex items-center justify-end border-b px-2 py-1">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1.5 text-[11px]"
                      data-testid="history-export-btn"
                    />
                  }
                >
                  <Download className="h-3 w-3" />
                  Export
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleExportCSV}
                    data-testid="history-export-csv"
                  >
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleExportJSON}
                    data-testid="history-export-json"
                  >
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <ScrollArea className="h-full">
            <div className="space-y-0.5 px-1 py-1">
              {displayed.map((entry) => (
                <HistoryItem key={entry.id} entry={entry} />
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
