"use client";

import { Undo2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { type ChangeLog, getRelayChangeLog } from "@/lib/relay/changeLog";

/** A bar is only useful when there is more than one change to take back. */
export const TURN_BAR_MIN_CHANGES = 2;

type TurnChangeBarProps = {
  turnId: string;
  changeIds: readonly string[];
  /** True once the reply has finished, so the announcement is made once per turn. */
  settled: boolean;
  log?: ChangeLog;
};

type PartialUndo = { blocked: number } | null;

export function TurnChangeBar({
  turnId,
  changeIds,
  settled,
  log,
}: TurnChangeBarProps) {
  const t = useTranslations("relay.changes");
  const activeLog = log ?? getRelayChangeLog();
  const [pending, setPending] = useState(false);
  const [partial, setPartial] = useState<PartialUndo>(null);
  // The joined string is a stable snapshot, so the store read never loops.
  const remainingKey = useSyncExternalStore(
    activeLog.subscribe,
    () =>
      changeIds
        .filter((id) => activeLog.getView(id)?.status !== "undone")
        .join(" "),
    () => changeIds.join(" "),
  );
  const remaining = remainingKey ? remainingKey.split(" ").length : 0;

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
    <div data-testid="relay-turn-changes" className="my-1.5 text-xs">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {remaining >= TURN_BAR_MIN_CHANGES ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => void handleUndoAll()}
        >
          <Undo2Icon aria-hidden />
          {pending ? t("undoingAll") : t("undoAll", { count: remaining })}
        </Button>
      ) : null}
      {partial ? (
        <p
          role="status"
          data-testid="relay-turn-blocked"
          className="mt-1 text-destructive"
        >
          {t("partialUndo", { count: partial.blocked })}
        </p>
      ) : null}
    </div>
  );
}
