"use client";

import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HttpMethod } from "@/types";
import {
  type PickerMethodFilter,
  usePickerActions,
  usePickerMethodFilters,
} from "./PickerContext";

export const METHOD_CHIPS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OTHER",
] as const satisfies readonly PickerMethodFilter[];

export type MethodChip = (typeof METHOD_CHIPS)[number];
export type MethodChipCounts = Record<MethodChip, number>;

const NAMED_METHODS: ReadonlySet<string> = new Set(METHOD_CHIPS);

/** HEAD/OPTIONS (and anything unexpected) share the OTHER chip. */
export function toMethodChip(method: HttpMethod): MethodChip {
  return NAMED_METHODS.has(method) ? (method as MethodChip) : "OTHER";
}

/** Counts matches per chip; callers pass methods already narrowed by the search query. */
export function countMethodChips(
  methods: readonly HttpMethod[],
): MethodChipCounts {
  const counts: MethodChipCounts = {
    GET: 0,
    POST: 0,
    PUT: 0,
    PATCH: 0,
    DELETE: 0,
    OTHER: 0,
  };
  for (const method of methods) counts[toMethodChip(method)] += 1;
  return counts;
}

type PickerFiltersProps = {
  counts: MethodChipCounts;
  /** False when there is nothing to expand (no collections or every one empty). */
  canExpand: boolean;
  allExpanded: boolean;
  onToggleExpandAll: () => void;
};

/** Method chips (multi-toggle, ANDed with search) plus the expand/collapse-all control. */
export function PickerFilters({
  counts,
  canExpand,
  allExpanded,
  onToggleExpandAll,
}: PickerFiltersProps) {
  const t = useTranslations("chain");
  const active = usePickerMethodFilters();
  const { toggleMethodFilter, clearMethodFilters } = usePickerActions();
  const ExpandIcon = allExpanded ? ChevronsDownUp : ChevronsUpDown;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-3 py-2">
      {METHOD_CHIPS.map((method) => {
        const pressed = active.has(method);
        return (
          <Button
            key={method}
            type="button"
            size="xs"
            variant={pressed ? "secondary" : "outline"}
            aria-pressed={pressed}
            // Stay visible at zero matches, but let an already-active chip be switched off.
            disabled={counts[method] === 0 && !pressed}
            data-testid={`picker-method-${method}`}
            onClick={() => toggleMethodFilter(method)}
            className={cn(
              "font-mono tabular-nums",
              pressed && "ring-1 ring-primary/40",
            )}
          >
            {method}
            <span className="text-muted-foreground">{counts[method]}</span>
          </Button>
        );
      })}
      {active.size > 0 && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          data-testid="picker-filter-clear"
          onClick={clearMethodFilters}
        >
          {t("apiPickerFilterClear")}
        </Button>
      )}
      <Button
        type="button"
        size="xs"
        variant="ghost"
        disabled={!canExpand}
        data-testid="picker-expand-toggle"
        onClick={onToggleExpandAll}
        className="ml-auto"
      >
        <ExpandIcon aria-hidden />
        {allExpanded ? t("apiPickerCollapseAll") : t("apiPickerExpandAll")}
      </Button>
    </div>
  );
}
