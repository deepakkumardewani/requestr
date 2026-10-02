"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { groupHistoryByDay } from "@/lib/pickerHistory";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { usePickerMethodFilters, usePickerQuery } from "./PickerContext";
import { countMethodChips, PickerFilters, toMethodChip } from "./PickerFilters";
import { PickerNoResults, PickerSearchBar } from "./PickerSearchBar";
import { PickerTree } from "./PickerTree";

type HistoryListProps = {
  /** History entry ids (and request ids) already on the canvas. */
  inChainIds: ReadonlySet<string>;
  onAddIds: (ids: string[]) => void;
  onShowOnCanvas: (id: string) => void;
};

const NOOP = () => {};

/** History tab: day-grouped rows that reuse the Collections tab's tree, selection and footer. */
export function HistoryList({
  inChainIds,
  onAddIds,
  onShowOnCanvas,
}: HistoryListProps) {
  const t = useTranslations("chain");
  const entries = useHistoryStore((s) => s.entries);
  const query = usePickerQuery();
  const methodFilters = usePickerMethodFilters();

  const labels = useMemo(
    () => ({
      today: t("apiPickerDayToday"),
      yesterday: t("apiPickerDayYesterday"),
      formatDate: (timestamp: number) =>
        new Date(timestamp).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    }),
    [t],
  );
  // Chip counts follow the search only, like the Collections tab.
  const searchRows = useMemo(
    () => groupHistoryByDay(entries, { labels, filter: query }),
    [entries, labels, query],
  );
  const rows = useMemo(
    () =>
      methodFilters.size === 0
        ? searchRows
        : groupHistoryByDay(entries, {
            labels,
            filter: query,
            matchesMethod: (method) => methodFilters.has(toMethodChip(method)),
          }),
    [entries, labels, query, methodFilters, searchRows],
  );
  const chipMethods = useMemo(
    () =>
      searchRows.flatMap((row) =>
        row.kind === "item" ? [row.item.method] : [],
      ),
    [searchRows],
  );
  const resultCount = rows.filter((row) => row.kind === "item").length;

  return (
    <>
      <div className="shrink-0">
        <PickerSearchBar resultCount={resultCount} />
        <PickerFilters
          counts={countMethodChips(chipMethods)}
          canExpand={false}
          allExpanded={false}
          onToggleExpandAll={NOOP}
        />
      </div>
      {entries.length === 0 ? (
        <div
          data-testid="picker-history-empty"
          className="flex h-[240px] flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
            <Clock className="h-6 w-6 opacity-50" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("apiPickerNoHistory")}</p>
            <p className="text-xs opacity-70">{t("apiPickerNoHistoryHint")}</p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <PickerNoResults />
      ) : (
        <PickerTree
          rows={rows}
          inChainIds={inChainIds}
          onAddIds={onAddIds}
          onShowOnCanvas={onShowOnCanvas}
        />
      )}
    </>
  );
}
