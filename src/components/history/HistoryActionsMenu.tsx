"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearHistory } from "@/lib/history/clearHistory";
import {
  exportHistory,
  type HistoryExportFormat,
} from "@/lib/history/exportHistory";
import {
  buildExportFilename,
  downloadFile,
  exportHistoryAsCSV,
} from "@/lib/historyExport";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { ClearHistoryDialog } from "./ClearHistoryDialog";

// The popup defaults to the 28px anchor width, which wraps the labels; size it to its content instead.
const MENU_CONTENT_CLASS = "w-auto min-w-48";
const MENU_ITEM_CLASS = "whitespace-nowrap";
// Inset the dividers to the item edges instead of bleeding into the popup ring.
const SEPARATOR_CLASS = "mx-0";
// The submenu anchors to the trigger item (4px inside the popup edge), so 10 leaves a 6px visible gap.
const SUBMENU_SIDE_OFFSET = 10;

/** The "⋯" menu of the history panel: export (full history, never the search filter) and clear all. */
export function HistoryActionsMenu() {
  const t = useTranslations("common");
  const entries = useHistoryStore((s) => s.entries);
  const [clearOpen, setClearOpen] = useState(false);
  const [excludedCount, setExcludedCount] = useState(0);

  function handleExport(format: HistoryExportFormat) {
    setExcludedCount(exportHistory(format).excludedCount);
  }

  function handleExportCSV() {
    downloadFile(
      exportHistoryAsCSV(entries),
      buildExportFilename("csv"),
      "text/csv;charset=utf-8",
    );
    setExcludedCount(0);
  }

  function handleConfirmClear() {
    clearHistory();
    setClearOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      {excludedCount > 0 && (
        <p
          className="text-[11px] text-muted-foreground"
          data-testid="history-excluded-note"
        >
          {t("history.excludedNote", { count: excludedCount })}
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("history.menuLabel")}
              data-testid="history-actions-btn"
            />
          }
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={MENU_ITEM_CLASS}
              data-testid="history-export-trigger"
            >
              {t("history.exportHistory")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={SUBMENU_SIDE_OFFSET}>
              <DropdownMenuItem
                onClick={() => handleExport("json")}
                data-testid="history-export-json"
              >
                {t("history.exportJson")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("har")}
                data-testid="history-export-har"
              >
                {t("history.exportHar")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportCSV}
                data-testid="history-export-csv"
              >
                {t("history.exportCsv")}
              </DropdownMenuItem>
              <DropdownMenuSeparator
                className={SEPARATOR_CLASS}
                data-testid="history-export-separator"
              />
              <p
                className="max-w-56 px-1.5 py-1 text-[11px] text-muted-foreground"
                data-testid="history-export-note"
              >
                {t("history.notRedacted")}
              </p>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator className={SEPARATOR_CLASS} />
          <DropdownMenuItem
            variant="destructive"
            className={MENU_ITEM_CLASS}
            onClick={() => setClearOpen(true)}
            data-testid="history-clear-all"
          >
            <Trash2 />
            {t("history.clearAll")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ClearHistoryDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        count={entries.length}
        onConfirm={handleConfirmClear}
      />
    </div>
  );
}
