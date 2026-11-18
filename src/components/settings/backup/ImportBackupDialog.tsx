"use client";

import { AlertTriangle, FileUp } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type BackupError,
  describeBackupError,
  IMPORT_PAGE_PATH,
} from "@/lib/backup/errors";
import type { RestoreMode, RestoreSummary } from "@/lib/backup/importer";
import { cn } from "@/lib/utils";
import { BackupPreview } from "./BackupPreview";
import { ReplaceConfirmDialog } from "./ReplaceConfirmDialog";
import { useBackupImport } from "./useBackupImport";

type ImportBackupDialogProps = {
  open: boolean;
  onClose: () => void;
};

const MODES: RestoreMode[] = ["merge", "replace"];

function FileDropZone({ onFile }: { onFile: (file: File) => void }) {
  const t = useTranslations("settings");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border",
      )}
      data-testid="backup-drop-zone"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">
        {t("backup.import.dropHint")}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        {t("backup.import.chooseFile")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="backup-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function ErrorNotice({ error }: { error: BackupError }) {
  const t = useTranslations("settings");
  const { key, values } = describeBackupError(error);
  const params = {
    n: values.n ?? 0,
    section: values.section ? t(`backup.sections.${values.section}`) : "",
  };

  return (
    <div
      role="alert"
      className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
      data-testid="backup-import-error"
    >
      <p>{t(key, params)}</p>
      {error.code === "foreignFile" && (
        <Link
          href={IMPORT_PAGE_PATH}
          className="font-medium underline underline-offset-4"
          data-testid="backup-import-link"
        >
          {t("backup.errors.importLink")}
        </Link>
      )}
    </div>
  );
}

function ModeChoice({
  mode,
  onChange,
}: {
  mode: RestoreMode;
  onChange: (mode: RestoreMode) => void;
}) {
  const t = useTranslations("settings");
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {t("backup.import.modeLabel")}
      </legend>
      {MODES.map((value) => (
        <label
          key={value}
          className={cn(
            "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm",
            mode === value && "border-primary bg-primary/5",
          )}
        >
          <input
            type="radio"
            name="backup-restore-mode"
            value={value}
            checked={mode === value}
            onChange={() => onChange(value)}
            className="mt-1"
            data-testid={`backup-mode-${value}`}
          />
          <span>
            <span className="block font-medium">
              {t(`backup.import.${value}`)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t(`backup.import.${value}Description`)}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function RestoreSummaryView({ summary }: { summary: RestoreSummary }) {
  const t = useTranslations("settings");
  return (
    <div
      className="space-y-1 text-sm"
      data-testid="backup-summary"
      aria-live="polite"
    >
      <p>{t("backup.summary.added", { count: summary.added })}</p>
      {summary.skipped > 0 && (
        <p>{t("backup.summary.skipped", { count: summary.skipped })}</p>
      )}
      {summary.kept > 0 && (
        <p>{t("backup.summary.kept", { count: summary.kept })}</p>
      )}
      {summary.danglingCount > 0 && (
        <p data-testid="backup-summary-dangling">
          {t("backup.summary.danglingReferences", {
            count: summary.danglingCount,
          })}
        </p>
      )}
      <p className="text-muted-foreground">{t("backup.summary.reloading")}</p>
    </div>
  );
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const t = useTranslations("settings");
  const ct = useTranslations("common");
  const state = useBackupImport();
  const { envelope } = state;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {state.step === "done"
            ? t("backup.summary.title")
            : t("backup.import.title")}
        </DialogTitle>
        <DialogDescription>{t("backup.import.description")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {state.step === "pick" && (
          <>
            <FileDropZone onFile={state.pickFile} />
            {state.error && <ErrorNotice error={state.error} />}
          </>
        )}
        {state.step === "preview" && envelope && (
          <>
            <p className="truncate text-xs text-muted-foreground">
              {state.fileName}
            </p>
            {state.warnings.includes("largeFile") && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {t("backup.largeBackupWarning")}
              </p>
            )}
            <BackupPreview envelope={envelope} />
            <ModeChoice mode={state.mode} onChange={state.setMode} />
            {state.restoreFailed && (
              <p role="alert" className="text-sm text-destructive">
                {t("backup.import.restoreFailed")}
              </p>
            )}
          </>
        )}
        {state.step === "done" && state.summary && (
          <RestoreSummaryView summary={state.summary} />
        )}
      </div>
      {state.step !== "done" && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ct("cancel")}
          </Button>
          {state.step === "preview" && (
            <Button
              disabled={state.busy}
              onClick={state.restore}
              data-testid="backup-restore-btn"
            >
              {t("backup.import.restore")}
            </Button>
          )}
        </DialogFooter>
      )}
      <ReplaceConfirmDialog
        counts={state.confirmCounts}
        busy={state.busy}
        onConfirm={state.confirmReplace}
        onCancel={state.cancelReplace}
      />
    </>
  );
}

/** Import dialog: choose file, validate, preview, choose mode (Merge by default), restore. */
export function ImportBackupDialog({ open, onClose }: ImportBackupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="backup-import-dialog">
        {/* Mounted only while open, so every opening starts from the file picker. */}
        <ImportBody onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
