"use client";

import { Undo2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { type ChangeLog, getRelayChangeLog } from "@/lib/relay/changeLog";
import { buildChangesSummary } from "@/lib/relay/changesSummary";
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
  const summary = buildChangesSummary(views, createZustandStoreAccess());

  async function handleUndoAll() {
    setPending(true);
    const result = await activeLog.undoTurn(turnId);
    setPending(false);
    setPartial(
      result.blocked.length > 0 ? { blocked: result.blocked.length } : null,
    );
  }

  const announcement =
    settled && changeIds.length > 0
      ? changeIds.length === 1
        ? t("appliedOne")
        : t("applied", { count: changeIds.length })
      : "";

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
