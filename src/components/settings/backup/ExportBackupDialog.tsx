"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BACKUP_SIZE_WARN_BYTES } from "@/lib/backup/constants";
import { BackupSectionPicker } from "./BackupSectionPicker";
import {
  type ExportMode,
  formatBytes,
  useBackupExport,
} from "./useBackupExport";

type ExportBackupDialogProps = {
  open: boolean;
  onClose: () => void;
};

const MODES: ExportMode[] = ["everything", "choose"];

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ExportMode;
  onChange: (mode: ExportMode) => void;
}) {
  const t = useTranslations("settings");
  return (
    <div
      role="radiogroup"
      aria-label={t("backup.export.title")}
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
    >
      {MODES.map((value) => (
        <Button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          variant={mode === value ? "default" : "ghost"}
          size="sm"
          data-testid={`backup-mode-${value}`}
          onClick={() => onChange(value)}
        >
          {t(
            value === "everything"
              ? "backup.export.everything"
              : "backup.export.choose",
          )}
        </Button>
      ))}
    </div>
  );
}

function SecretsToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useTranslations("settings");
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="backup-include-secrets" className="text-sm">
          {t("backup.export.includeSecrets")}
        </Label>
        <Switch
          id="backup-include-secrets"
          checked={checked}
          onCheckedChange={onChange}
          data-testid="backup-secrets-toggle"
        />
      </div>
      <p
        className="flex items-start gap-2 text-xs text-muted-foreground"
        data-testid="backup-secrets-warning"
      >
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
          aria-hidden
        />
        <span>
          {t("backup.export.secretsWarning")}
          {checked && ` ${t("backup.export.secretsResponsesNote")}`}
        </span>
      </p>
    </div>
  );
}

function ExportBody({ onClose }: { onClose: () => void }) {
  const t = useTranslations("settings");
  const ct = useTranslations("common");
  const state = useBackupExport();
  const { prepared } = state;
  const bytes = prepared?.estimate.bytes ?? 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("backup.export.title")}</DialogTitle>
        <DialogDescription>{t("backup.export.description")}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto">
        <ModeToggle mode={state.mode} onChange={state.setMode} />
        {state.mode === "choose" && (
          <BackupSectionPicker
            sections={state.sections}
            counts={prepared?.estimate.counts ?? {}}
            items={state.items}
            selected={state.selected}
            onToggleSection={state.toggleSection}
            onToggleItem={state.toggleItem}
          />
        )}
        {state.mode === "everything" && (
          <p className="text-xs text-muted-foreground">
            {t("backup.export.relayThreadsNote")}
          </p>
        )}
        <SecretsToggle
          checked={state.includeSecrets}
          onChange={state.setIncludeSecrets}
        />
        <div
          className="space-y-1 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {prepared && (
            <p data-testid="backup-estimated-size">
              {t("backup.export.estimatedSize", { size: formatBytes(bytes) })}
            </p>
          )}
          {prepared && prepared.danglingCount > 0 && (
            <p data-testid="backup-dangling">
              {t("backup.export.danglingReferences", {
                count: prepared.danglingCount,
              })}
            </p>
          )}
          {bytes > BACKUP_SIZE_WARN_BYTES && (
            <p>{t("backup.largeBackupWarning")}</p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {ct("cancel")}
        </Button>
        <Button
          disabled={!state.canDownload}
          onClick={state.download}
          data-testid="backup-download-btn"
        >
          {t("backup.export.download")}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Export dialog: Everything or Choose, secrets off by default, then download. */
export function ExportBackupDialog({ open, onClose }: ExportBackupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-md"
        data-testid="backup-export-dialog"
      >
        {/* Mounted only while open, so every opening starts from the defaults. */}
        <ExportBody onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
