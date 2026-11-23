"use client";

import { DatabaseBackup, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ExportBackupDialog } from "@/components/settings/backup/ExportBackupDialog";
import { Button } from "@/components/ui/button";
import { isTrackingActive, track } from "@/lib/analytics/adapter";
import {
  markBackupNudgeShown,
  shouldShowBackupNudge,
  snoozeBackupNudge,
} from "@/lib/backup/backupNudgeState";
import { useAutoPromptGate } from "@/lib/prompts/useAutoPromptGate";
import { usePromptStore } from "@/stores/usePromptStore";

type NudgeEvent =
  | "backup_nudge_shown"
  | "backup_nudge_accepted"
  | "backup_nudge_dismissed";

function emit(event: NudgeEvent): void {
  if (isTrackingActive()) track(event, {});
}

/**
 * Quiet reminder to export a backup (R40). Holds the `backup-nudge` prompt slot
 * while visible, so it never shows beside another prompt; its action opens the
 * export dialog, which is hosted here so the nudge can unmount independently.
 */
export function BackupNudge() {
  const t = useTranslations("common.backupNudge");
  const gateOpen = useAutoPromptGate();
  const active = usePromptStore((s) => s.active === "backup-nudge");
  const [exportOpen, setExportOpen] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (!gateOpen) return;
    let cancelled = false;
    void shouldShowBackupNudge().then((eligible) => {
      if (cancelled || !eligible || requested.current) return;
      requested.current = true;
      usePromptStore.getState().request("backup-nudge", { auto: true });
    });
    return () => {
      cancelled = true;
      // A granted nudge stays until the user answers it; only an unanswered request is withdrawn.
      if (
        requested.current &&
        usePromptStore.getState().active !== "backup-nudge"
      ) {
        requested.current = false;
        usePromptStore.getState().release("backup-nudge");
      }
    };
  }, [gateOpen]);

  useEffect(
    () => () => {
      if (requested.current) usePromptStore.getState().release("backup-nudge");
    },
    [],
  );

  useEffect(() => {
    if (!active) return;
    markBackupNudgeShown();
    emit("backup_nudge_shown");
  }, [active]);

  const handleAccept = () => {
    emit("backup_nudge_accepted");
    usePromptStore.getState().release("backup-nudge");
    setExportOpen(true);
  };

  const handleDismiss = () => {
    snoozeBackupNudge();
    emit("backup_nudge_dismissed");
    usePromptStore.getState().release("backup-nudge");
  };

  return (
    <>
      {active && (
        <section
          aria-label={t("title")}
          data-testid="backup-nudge"
          className="fixed bottom-4 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-md"
        >
          <DatabaseBackup
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t("title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("description")}
              </p>
            </div>
            <Button
              size="sm"
              className="focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
              data-testid="backup-nudge-action"
              onClick={handleAccept}
            >
              {t("action")}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
            aria-label={t("dismiss")}
            data-testid="backup-nudge-dismiss"
            onClick={handleDismiss}
          >
            <X />
          </Button>
        </section>
      )}
      {exportOpen && (
        <ExportBackupDialog open onClose={() => setExportOpen(false)} />
      )}
    </>
  );
}
