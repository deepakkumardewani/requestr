"use client";

import { useLocale, useTranslations } from "next-intl";
import { BACKUP_SELECTABLE_SECTIONS } from "@/lib/backup/constants";
import type { BackupEnvelope } from "@/lib/backup/schema";
import { countSections } from "@/lib/backup/sizeEstimate";

type BackupPreviewProps = {
  envelope: BackupEnvelope;
};

/** What a validated backup holds: counts per section, when it was made, and whether it has secrets. */
export function BackupPreview({ envelope }: BackupPreviewProps) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const counts = countSections(envelope.data);
  const exportedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(envelope.exportedAt));
  const sections = BACKUP_SELECTABLE_SECTIONS.filter((section) =>
    envelope.sections.includes(section),
  );

  return (
    <section
      className="space-y-3 rounded-lg border p-3"
      aria-label={t("backup.import.previewTitle")}
      data-testid="backup-preview"
    >
      <h3 className="text-sm font-medium">{t("backup.import.previewTitle")}</h3>
      <ul className="space-y-1 text-sm">
        {sections.map((section) => (
          <li
            key={section}
            className="flex items-center justify-between gap-2"
            data-testid={`backup-preview-${section}`}
          >
            <span>{t(`backup.sections.${section}`)}</span>
            <span className="text-xs text-muted-foreground">
              {t("backup.export.count", { count: counts[section] ?? 0 })}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {t("backup.import.exportedAt", { date: exportedAt })}
        {" · "}
        <span data-testid="backup-preview-secrets">
          {t(
            envelope.includesSecrets
              ? "backup.import.includesSecrets"
              : "backup.import.withoutSecrets",
          )}
        </span>
      </p>
    </section>
  );
}
