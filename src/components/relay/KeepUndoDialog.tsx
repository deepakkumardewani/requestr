"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getRelayChangeLog } from "@/lib/relay/changeLog";
import {
  type KeepUndoRequest,
  useRelayTurnStore,
} from "@/stores/useRelayTurnStore";

/** Undoes newest first, as a turn's "Undo all" does; returns the changes that could not be undone. */
async function undoAll(changeIds: readonly string[]): Promise<string[]> {
  const log = getRelayChangeLog();
  const blocked: string[] = [];
  for (const id of [...changeIds].reverse()) {
    const result = await log.undo(id);
    if (!result.ok) blocked.push(id);
  }
  return blocked;
}

function KeepUndoBody({ request }: { request: KeepUndoRequest }) {
  const t = useTranslations("relay.keepUndo");
  const [pending, setPending] = useState(false);

  async function handleUndo() {
    setPending(true);
    // A change the user edited since cannot be undone safely, so it stays and counts as kept.
    const blocked = await undoAll(request.changeIds);
    setPending(false);
    request.resolve(blocked);
  }

  return (
    <AlertDialogContent data-testid="relay-keep-undo">
      <AlertDialogHeader>
        <AlertDialogTitle>{t("title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("description", { count: request.changeIds.length })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel
          disabled={pending}
          data-testid="relay-keep-undo-cancel"
        >
          {t("cancel")}
        </AlertDialogCancel>
        <AlertDialogAction
          variant="outline"
          disabled={pending}
          data-testid="relay-keep-undo-undo"
          onClick={() => void handleUndo()}
        >
          {t("undo")}
        </AlertDialogAction>
        <AlertDialogAction
          disabled={pending}
          data-testid="relay-keep-undo-keep"
          onClick={() => request.resolve(request.changeIds)}
        >
          {t("keep")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

/**
 * Asks what happens to a turn's applied changes before Regenerate or Edit &
 * resend discards the turn (HH-M23). Dismissing it cancels the action.
 */
export function KeepUndoDialog() {
  const request = useRelayTurnStore((s) => s.keepUndoRequest);

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) request?.resolve(null);
      }}
    >
      {request ? <KeepUndoBody request={request} /> : null}
    </AlertDialog>
  );
}
