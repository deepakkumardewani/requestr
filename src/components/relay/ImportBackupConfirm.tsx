"use client";

import { FileUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { BackupPreview } from "@/components/settings/backup/BackupPreview";
import { Button } from "@/components/ui/button";
import { describeBackupError } from "@/lib/backup/errors";
import type { BackupEnvelope } from "@/lib/backup/schema";
import { validateBackup } from "@/lib/backup/validate";
import { RELAY_COARSE_TOUCH_CLASS } from "@/lib/relay/constants";
import {
  stageImportFile,
  unstageImportFile,
} from "@/lib/relay/tools/backupTools";
import type { ConfirmPreview } from "@/lib/relay/tools/registry";
import { ConfirmCard } from "./ConfirmCard";

type ImportBackupConfirmProps = {
  preview: ConfirmPreview;
  toolCallId: string;
  onApprove: () => void;
  onDecline: () => void;
};

type Picked =
  | { status: "none" }
  | { status: "ok"; fileName: string; envelope: BackupEnvelope }
  | { status: "error"; message: string };

/**
 * Picking is a user gesture, so the file is read here and handed to the tool
 * through `stageImportFile`; Relay only ever sees the resulting counts (TOOL-03).
 */
export function ImportBackupConfirm({
  preview,
  toolCallId,
  onApprove,
  onDecline,
}: ImportBackupConfirmProps) {
  const t = useTranslations("settings");
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked>({ status: "none" });

  async function pickFile(file: File) {
    const result = validateBackup(await file.text(), file.size);
    if (!result.ok) {
      const { key, values } = describeBackupError(result.error);
      unstageImportFile(toolCallId);
      setPicked({
        status: "error",
        message: t(key, {
          n: values.n ?? 0,
          section: values.section ? t(`backup.sections.${values.section}`) : "",
        }),
      });
      return;
    }
    stageImportFile(toolCallId, result.envelope);
    setPicked({
      status: "ok",
      fileName: file.name,
      envelope: result.envelope,
    });
  }

  function decline() {
    unstageImportFile(toolCallId);
    onDecline();
  }

  return (
    <ConfirmCard
      preview={preview}
      onApprove={onApprove}
      onDecline={decline}
      approveDisabled={picked.status !== "ok"}
      extra={
        <div className="space-y-2" data-testid="relay-import-backup">
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            data-testid="relay-import-backup-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void pickFile(file);
            }}
          />
          <Button
            type="button"
            size="xs"
            variant="outline"
            className={RELAY_COARSE_TOUCH_CLASS}
            data-testid="relay-import-backup-choose"
            onClick={() => inputRef.current?.click()}
          >
            <FileUpIcon aria-hidden />
            {t("backup.import.chooseFile")}
          </Button>
          {picked.status === "error" ? (
            <p
              role="alert"
              className="text-destructive"
              data-testid="relay-import-backup-error"
            >
              {picked.message}
            </p>
          ) : null}
          {picked.status === "ok" ? (
            <>
              <p className="break-all text-muted-foreground">
                {picked.fileName}
              </p>
              <BackupPreview envelope={picked.envelope} />
              <p data-testid="relay-import-backup-merge">
                <span className="font-medium">{t("backup.import.merge")}</span>
                {": "}
                {t("backup.import.mergeDescription")}
              </p>
            </>
          ) : null}
        </div>
      }
    />
  );
}
