"use client";

import { ArchiveRestore } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ImportBackupDialog } from "@/components/settings/backup/ImportBackupDialog";
import { Button } from "@/components/ui/button";

/** Import page entry to the same restore flow Settings offers. */
export function RestoreBackupCard() {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);

  return (
    <section
      className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 rounded-lg border p-4"
      aria-label={t("backup.importCard.title")}
      data-testid="restore-backup-card"
    >
      <div className="flex items-start gap-3">
        <ArchiveRestore
          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div>
          <h2 className="text-sm font-medium">
            {t("backup.importCard.title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("backup.importCard.description")}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start sm:self-auto"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="restore-backup-btn"
        onClick={() => setOpen(true)}
      >
        {t("backup.importCard.action")}
      </Button>
      <ImportBackupDialog open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
