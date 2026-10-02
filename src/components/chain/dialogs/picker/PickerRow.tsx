"use client";

import { ChevronRight, Crosshair } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useCallback, useState } from "react";
import { MethodBadge } from "@/components/common/MethodBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import type { HighlightRange } from "@/lib/pickerSearch";
import type {
  PickerHeaderRow,
  PickerItemRow,
  PickerListItem,
  PickerRow as PickerRowModel,
} from "@/lib/pickerTree";
import { cn } from "@/lib/utils";
import {
  useIsPickerRowActive,
  useIsPickerRowSelected,
  usePickerActions,
  usePickerSelector,
} from "./PickerContext";

export const PICKER_ROW_HEIGHT = 36;
const DEPTH_INDENT_PX = 16;
const BASE_PADDING_PX = 8;

/** DOM id for `aria-activedescendant`; derived from the row id so it is stable across virtualization. */
export const getPickerRowDomId = (rowId: string) => `picker-row-dom-${rowId}`;

/** Header ids are `${headerType}:${entityId}`; the context's `expanded` set stores the bare entity id. */
const toEntityId = (header: PickerHeaderRow) =>
  header.id.slice(header.headerType.length + 1);

function Highlighted({
  text,
  ranges,
}: {
  text: string;
  ranges: readonly HighlightRange[];
}) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end]) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={`${start}-${end}`}
        className="rounded-sm bg-primary/20 text-inherit"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

const rowIndent = (depth: number) => ({
  paddingLeft: BASE_PADDING_PX + depth * DEPTH_INDENT_PX,
});

type HeaderProps = { row: PickerHeaderRow };

function PickerHeaderRowView({ row }: HeaderProps) {
  const { toggleExpanded } = usePickerActions();
  const active = useIsPickerRowActive(row.id);
  const entityId = toEntityId(row);

  return (
    <div
      id={getPickerRowDomId(row.id)}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.expandable ? row.expanded : undefined}
      data-testid={`picker-header-${row.id}`}
      title={row.breadcrumb}
      style={{ height: PICKER_ROW_HEIGHT, ...rowIndent(row.depth) }}
      onClick={row.expandable ? () => toggleExpanded(entityId) : undefined}
      className={cn(
        "flex min-w-0 items-center gap-2 pr-3 text-[13px] font-semibold transition-colors",
        row.expandable
          ? "cursor-pointer hover:bg-muted/60"
          : "text-muted-foreground",
        active && "bg-muted ring-2 ring-inset ring-ring/60",
      )}
    >
      <ChevronRight
        aria-hidden
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
          row.expanded && "rotate-90",
          !row.expandable && "opacity-0",
        )}
      />
      <span className="min-w-0 flex-1 truncate">{row.label}</span>
      <Badge variant="secondary" className="shrink-0 tabular-nums">
        {row.count.visible}/{row.count.total}
      </Badge>
    </div>
  );
}

type ItemProps = {
  row: PickerItemRow<PickerListItem>;
  inChain: boolean;
  /** Closes the dialog, then selects and centers the node for this request. */
  onShowOnCanvas: (requestId: string) => void;
};

function PickerItemRowView({ row, inChain, onShowOnCanvas }: ItemProps) {
  const t = useTranslations("chain");
  const { toggleSelected } = usePickerActions();
  const selected = useIsPickerRowSelected(row.id);
  const active = useIsPickerRowActive(row.id);
  // A boolean slice: rows only re-render when the selection crosses the cap, not on every toggle.
  const capReached = usePickerSelector(
    (state) => state.selectedIds.size >= PICKER_SELECTION_CAP,
  );
  const [announcement, setAnnouncement] = useState("");
  const { item, match } = row;
  const capBlocked = capReached && !selected;

  const handleActivate = useCallback(() => {
    if (inChain) {
      setAnnouncement(t("apiPickerAlreadyInChain"));
      return;
    }
    toggleSelected(row.id);
  }, [inChain, row.id, t, toggleSelected]);

  const disabledReason = inChain
    ? t("apiPickerAlreadyInChain")
    : capBlocked
      ? t("apiPickerSelectionCap", { max: PICKER_SELECTION_CAP })
      : undefined;

  return (
    <div
      id={getPickerRowDomId(row.id)}
      role="option"
      aria-selected={selected}
      aria-disabled={inChain || capBlocked || undefined}
      data-testid={`picker-row-${row.id}`}
      data-selected={selected || undefined}
      title={disabledReason}
      style={{ height: PICKER_ROW_HEIGHT, ...rowIndent(row.depth) }}
      onClick={handleActivate}
      className={cn(
        "group flex min-w-0 items-center gap-2 pr-3 text-[13px] transition-colors",
        inChain
          ? "cursor-default opacity-70"
          : "cursor-pointer hover:bg-muted/60",
        selected && "bg-primary/10",
        active && "bg-muted ring-2 ring-inset ring-ring/60",
        selected && active && "bg-primary/15",
      )}
    >
      {/* Visual only: the option row owns every click so one gesture never toggles twice (D2). */}
      <Checkbox
        checked={selected}
        disabled={inChain || capBlocked}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none"
      />
      <MethodBadge method={item.method} />
      <span className="min-w-0 shrink truncate font-medium text-foreground/90">
        <Highlighted text={item.name} ranges={match.nameRanges} />
      </span>
      <span
        title={item.url}
        className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
      >
        <Highlighted text={item.url} ranges={match.urlRanges} />
      </span>
      {inChain && (
        <span className="flex shrink-0 items-center gap-1.5">
          <Badge variant="outline">{t("apiPickerInChain")}</Badge>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            data-testid={`picker-show-on-canvas-${row.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onShowOnCanvas(row.id);
            }}
          >
            <Crosshair aria-hidden />
            {t("apiPickerShowOnCanvas")}
          </Button>
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

type PickerRowProps = {
  row: PickerRowModel<PickerListItem>;
  /** Only meaningful for item rows. */
  inChain?: boolean;
  onShowOnCanvas?: (requestId: string) => void;
};

const noop = () => {};

/** Memoized so only rows whose own props or context slice changed re-render; keep callbacks stable. */
export const PickerRow = memo(function PickerRow({
  row,
  inChain = false,
  onShowOnCanvas = noop,
}: PickerRowProps) {
  return row.kind === "header" ? (
    <PickerHeaderRowView row={row} />
  ) : (
    <PickerItemRowView
      row={row}
      inChain={inChain}
      onShowOnCanvas={onShowOnCanvas}
    />
  );
});
