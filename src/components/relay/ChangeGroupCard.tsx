"use client";

import { WorkflowIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ChangeGroup } from "@/lib/relay/changeGroups";
import { type ChangeLog, getRelayChangeLog } from "@/lib/relay/changeLog";
import { buildChangesSummary } from "@/lib/relay/changesSummary";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import {
  CHANGE_CARD_CLASS,
  CHANGE_NOTE_CLASS,
  CHANGE_ROW_CLASS,
  ChangeRowActions,
  useOpenTarget,
  useSubscribeToEntityLists,
} from "./ChangeCard";

const LABEL_COUNT_SEPARATOR = " · ";

/** Splits "<name part> · <count>" so the count can stay visible while the name truncates. */
function splitLabel(label: string) {
  const index = label.lastIndexOf(LABEL_COUNT_SEPARATOR);
  if (index < 0) return { head: label, count: "" };
  return {
    head: label.slice(0, index),
    count: label.slice(index),
  };
}

type ChangeGroupCardProps = {
  group: ChangeGroup;
  /** Defaults to the app-wide log; specs pass their own. */
  log?: ChangeLog;
};

/** One card for a run of edits to the same chain: "Built chain X · 4 nodes". */
export function ChangeGroupCard({ group, log }: ChangeGroupCardProps) {
  const t = useTranslations("relay.changes");
  const activeLog = log ?? getRelayChangeLog();
  const openTarget = useOpenTarget();
  useSubscribeToEntityLists();
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(0);

  const label = group.created
    ? t("groupBuilt", { name: group.chainName, count: group.nodeCount })
    : t("groupUpdated", {
        name: group.chainName,
        count: group.changes.length,
      });
  const { head, count } = splitLabel(label);
  const live = group.changes.filter((change) => change.status !== "undone");
  const open =
    group.deletedLater || live.length === 0
      ? null
      : buildChangesSummary(
          [live[live.length - 1]],
          createZustandStoreAccess(),
        ).rows.find((row) => row.open)?.open;

  /** Newest first, so each undo meets the state its own change left behind. */
  async function handleUndo() {
    setPending(true);
    let blockedCount = 0;
    for (const change of [...live].reverse()) {
      const result = await activeLog.undo(change.id);
      if (!result.ok) blockedCount += 1;
    }
    setPending(false);
    setBlocked(blockedCount);
  }

  return (
    <div
      data-testid="relay-change-group-card"
      data-status={group.undone ? "undone" : "applied"}
      role="group"
      aria-label={t("cardLabel", { summary: label })}
      className={`${CHANGE_CARD_CLASS} ${group.undone ? "text-muted-foreground" : ""}`}
    >
      <div className={CHANGE_ROW_CLASS}>
        <WorkflowIcon aria-hidden className="size-3.5 shrink-0" />
        <span
          className={`flex min-w-0 flex-1 ${group.undone ? "line-through" : ""}`}
          title={label}
        >
          <span className="truncate">{head}</span>
          <span
            data-testid="relay-change-group-count"
            className="shrink-0 whitespace-nowrap"
          >
            {count}
          </span>
        </span>
        <ChangeRowActions
          undone={group.undone}
          pending={pending}
          onUndo={() => void handleUndo()}
          open={open}
          onOpen={openTarget}
        />
      </div>
      {blocked > 0 ? (
        <p
          role="status"
          data-testid="relay-change-group-blocked"
          className={`${CHANGE_NOTE_CLASS} text-destructive`}
        >
          {t("partialUndo", { count: blocked })}
        </p>
      ) : null}
    </div>
  );
}
