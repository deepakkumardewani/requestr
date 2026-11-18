"use client";

import { Undo2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { type ChangeGroup, groupChanges } from "@/lib/relay/changeGroups";
import {
  type ChangeLog,
  type ChangeView,
  getRelayChangeLog,
} from "@/lib/relay/changeLog";
import {
  buildChangesSummary,
  type ChangesSummary as ChangesSummaryModel,
} from "@/lib/relay/changesSummary";
import type { StoreAccess } from "@/lib/relay/storeAccess";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { useOpenTarget, useSubscribeToEntityLists } from "./ChangeCard";
import { ChangesSummary } from "./ChangesSummary";

type TurnChangeBarProps = {
  turnId: string;
  changeIds: readonly string[];
  /** True once the reply has finished, so the announcement is made once per turn. */
  settled: boolean;
  log?: ChangeLog;
};

/** Fewer distinct changes than this are already visible as cards, so no summary is shown. */
const MIN_CHANGES_FOR_SUMMARY = 2;

type GroupLabel = (group: ChangeGroup) => string;

/** One row per item: a chain group is a single row, counted as one chain, with the Open of its newest live edit. */
function summarizeItems(
  views: readonly ChangeView[],
  store: StoreAccess,
  groupLabel: GroupLabel,
): ChangesSummaryModel {
  const items = groupChanges(views);
  const representatives = items.map((item) =>
    item.kind === "single"
      ? item.change
      : {
          ...item.changes[0],
          status: item.undone ? ("undone" as const) : ("applied" as const),
        },
  );
  const rows = items.flatMap((item) => {
    if (item.kind === "single")
      return buildChangesSummary([item.change], store).rows;
    const live = item.changes.filter((change) => change.status !== "undone");
    const newest = live.at(-1);
    const open =
      item.deletedLater || !newest
        ? null
        : (buildChangesSummary([newest], store).rows[0]?.open ?? null);
    const [row] = buildChangesSummary([item.changes[0]], store).rows;
    return [{ ...row, label: groupLabel(item), undone: item.undone, open }];
  });
  return { rows, groups: buildChangesSummary(representatives, store).groups };
}

type PartialUndo = { blocked: number } | null;

const KEY_SEPARATOR = " ";

/**
 * The summary after the answer: what the reply changed, Open per row and one
 * "Undo all" while anything is still undoable.
 */
export function TurnChangeBar({
  turnId,
  changeIds,
  settled,
  log,
}: TurnChangeBarProps) {
  const t = useTranslations("relay.changes");
  const activeLog = log ?? getRelayChangeLog();
  const openTarget = useOpenTarget();
  useSubscribeToEntityLists();
  const [pending, setPending] = useState(false);
  const [partial, setPartial] = useState<PartialUndo>(null);
  // Re-renders when a change's status moves; the joined string is a stable snapshot, so the store read never loops.
  useSyncExternalStore(
    activeLog.subscribe,
    () =>
      changeIds
        .map((id) => `${id}:${activeLog.getView(id)?.status ?? "unloaded"}`)
        .join(KEY_SEPARATOR),
    () => changeIds.join(KEY_SEPARATOR),
  );
  // A restored thread has no cached changes; fetch them once.
  useEffect(() => {
    for (const id of changeIds) {
      if (!activeLog.getView(id)) void activeLog.load(id);
    }
  }, [activeLog, changeIds]);

  const views = changeIds.flatMap((id) => activeLog.getView(id) ?? []);
  const undoable = views.filter((view) => view.status !== "undone").length;
  // Cheap and pure, so it is re-derived every render: the subscriptions above
  // (statuses via stateKey, entity lists via the hook) are what trigger one.
  const store = createZustandStoreAccess();
  const distinctChanges = buildChangesSummary(views, store).rows.length;
  const summary = summarizeItems(views, store, (group) =>
    group.created
      ? t("groupBuilt", { name: group.chainName, count: group.nodeCount })
      : t("groupUpdated", {
          name: group.chainName,
          count: group.changes.length,
        }),
  );

  async function handleUndoAll() {
    setPending(true);
    const result = await activeLog.undoTurn(turnId);
    setPending(false);
    setPartial(
      result.blocked.length > 0 ? { blocked: result.blocked.length } : null,
    );
  }

  if (distinctChanges < MIN_CHANGES_FOR_SUMMARY) return null;
  const announcement = settled ? t("applied", { count: distinctChanges }) : "";

  return (
    <div data-testid="relay-turn-changes">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ChangesSummary
        summary={summary}
        onOpen={openTarget}
        action={
          undoable > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={pending}
              onClick={() => void handleUndoAll()}
            >
              <Undo2Icon aria-hidden />
              {pending ? t("undoingAll") : t("undoAllShort")}
            </Button>
          ) : null
        }
      />
      {partial ? (
        <p
          role="status"
          data-testid="relay-turn-blocked"
          className="mt-1 text-xs text-destructive"
        >
          {t("partialUndo", { count: partial.blocked })}
        </p>
      ) : null}
    </div>
  );
}
