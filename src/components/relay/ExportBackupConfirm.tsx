"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BACKUP_SELECTABLE_SECTIONS } from "@/lib/backup/constants";
import { prepareBackup } from "@/lib/backup/exporter";
import type { SectionCounts } from "@/lib/backup/sizeEstimate";
import { backupOptionsFor } from "@/lib/relay/tools/backupTools";
import type { ConfirmPreview } from "@/lib/relay/tools/registry";
import type { RelayToolInput } from "@/lib/relay/tools/schemas";
import { ConfirmCard } from "./ConfirmCard";

type ExportBackupConfirmProps = {
  preview: ConfirmPreview;
  input: RelayToolInput<"export_backup">;
  onApprove: () => void;
  onDecline: () => void;
};

/** Counts of what the backup would hold, read without downloading anything. */
function useBackupCounts(input: RelayToolInput<"export_backup">) {
  const [counts, setCounts] = useState<SectionCounts | null>(null);
  // The parent re-parses the input on every render, so the effect keys on its text, not its identity.
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    let cancelled = false;
    const options = backupOptionsFor(JSON.parse(inputKey));
    prepareBackup(options)
      .then((prepared) => {
        if (!cancelled) setCounts(prepared.estimate.counts);
      })
      .catch((error: unknown) => {
        console.warn("[relay] counting a backup failed", { error });
      });
    return () => {
      cancelled = true;
    };
  }, [inputKey]);
  return counts;
}

/** Sections and counts always; the secrets warning only when secrets are on (BAK-02). */
export function ExportBackupConfirm({
  preview,
  input,
  onApprove,
  onDecline,
}: ExportBackupConfirmProps) {
  const t = useTranslations("settings");
  const counts = useBackupCounts(input);
  const sections = BACKUP_SELECTABLE_SECTIONS.filter((section) =>
    input.sections.includes(section),
  );
  return (
    <ConfirmCard
      preview={preview}
      onApprove={onApprove}
      onDecline={onDecline}
      extra={
        <div className="space-y-1.5" data-testid="relay-export-backup">
          <ul className="space-y-0.5">
            {sections.map((section) => (
              <li
                key={section}
                className="flex items-center justify-between gap-2"
                data-testid={`relay-export-backup-${section}`}
              >
                <span>{t(`backup.sections.${section}`)}</span>
                <span className="text-muted-foreground">
                  {counts
                    ? t("backup.export.count", { count: counts[section] ?? 0 })
                    : ""}
                </span>
              </li>
            ))}
          </ul>
          {input.includeSecrets === true ? (
            <p
              role="alert"
              data-testid="relay-export-backup-secrets"
              className="flex items-start gap-1.5 font-medium text-amber-700 dark:text-amber-400"
            >
              <TriangleAlertIcon
                aria-hidden
                className="mt-0.5 size-3.5 shrink-0"
              />
              {t("backup.export.secretsWarning")}
            </p>
          ) : null}
        </div>
      }
    />
  );
}
