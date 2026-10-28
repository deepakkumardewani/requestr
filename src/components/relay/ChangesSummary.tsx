"use client";

import {
  FileTextIcon,
  FolderIcon,
  LayersIcon,
  type LucideIcon,
  SquareArrowOutUpRightIcon,
  WorkflowIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  type ChangesSummary as ChangesSummaryModel,
  formatHeadline,
  type SummaryKind,
  type SummaryRow,
} from "@/lib/relay/changesSummary";
import { RELAY_COARSE_TOUCH_CLASS } from "@/lib/relay/constants";
import type { OpenTarget } from "@/lib/relay/openEntity";

const KIND_ICONS: Record<SummaryKind, LucideIcon> = {
  request: FileTextIcon,
  chain: WorkflowIcon,
  collection: FolderIcon,
  environment: LayersIcon,
  item: FileTextIcon,
};

type ChangesSummaryProps = {
  summary: ChangesSummaryModel;
  onOpen: (target: OpenTarget) => void;
  /** The turn-level action (Undo all), shown beside the headline. */
  action?: React.ReactNode;
};

function SummaryRowItem({
  row,
  onOpen,
}: {
  row: SummaryRow;
  onOpen: (target: OpenTarget) => void;
}) {
  const t = useTranslations("relay.changes");
  const reasonId = useId();
  const Icon = KIND_ICONS[row.kind];
  const open = row.open;
  const undone = open && !open.enabled && open.reason === "undone";
  return (
    <li
      data-testid="relay-changes-row"
      data-op={row.op}
      className="flex items-center gap-2 py-1"
    >
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span
        className={`min-w-0 flex-1 truncate ${undone ? "text-muted-foreground line-through" : ""}`}
        title={row.label}
      >
        {row.label}
      </span>
      {open && !open.enabled ? (
        <span
          id={reasonId}
          data-testid="relay-changes-reason"
          className="shrink-0 text-muted-foreground"
        >
          {t(`openDisabled.${open.reason}`)}
        </span>
      ) : null}
      {open ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className={RELAY_COARSE_TOUCH_CLASS}
          disabled={!open.enabled}
          aria-describedby={open.enabled ? undefined : reasonId}
          onClick={() => open.enabled && onOpen(open.target)}
        >
          <SquareArrowOutUpRightIcon aria-hidden />
          {t("open")}
        </Button>
      ) : null}
    </li>
  );
}

/** The compact "what this reply changed" list shown after the answer (CONV-05). */
export function ChangesSummary({
  summary,
  onOpen,
  action,
}: ChangesSummaryProps) {
  const t = useTranslations("relay.changes");
  if (summary.rows.length === 0) return null;
  return (
    <section
      data-testid="relay-changes-summary"
      aria-label={t("summaryLabel")}
      className="my-1.5 min-w-0 rounded-md border bg-card px-2 py-1.5 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <p
          data-testid="relay-changes-headline"
          className="min-w-0 flex-1 font-medium"
        >
          {formatHeadline(summary.groups, (key, values) => t(key, values))}
        </p>
        {action}
      </div>
      <ul className="mt-1 divide-y divide-border/60 border-t border-border/60">
        {summary.rows.map((row, index) => (
          <SummaryRowItem
            key={`${row.changeId}-${index}`}
            row={row}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}
