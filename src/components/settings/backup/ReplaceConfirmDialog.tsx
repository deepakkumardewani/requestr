"use client";

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
import {
  BACKUP_SELECTABLE_SECTIONS,
  type BackupSection,
} from "@/lib/backup/constants";
import type { SectionCounts } from "@/lib/backup/sizeEstimate";

type ReplaceConfirmDialogProps = {
  /** Records that Replace will delete per section; null keeps the dialog closed. */
  counts: SectionCounts | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Replace is destructive, so it always stops here and states exactly what goes. */
export function ReplaceConfirmDialog({
  counts,
  busy,
  onConfirm,
  onCancel,
}: ReplaceConfirmDialogProps) {
  const t = useTranslations("settings");
  const sections: BackupSection[] = counts
    ? BACKUP_SELECTABLE_SECTIONS.filter((section) => section in counts)
    : [];

  return (
    <Dialog open={counts !== null} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        data-testid="backup-replace-confirm"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{t("backup.replaceConfirm.title")}</DialogTitle>
          <DialogDescription>
            {t("backup.replaceConfirm.description")}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 text-sm" data-testid="backup-replace-counts">
          {sections.map((section) => (
            <li key={section} data-testid={`backup-replace-count-${section}`}>
              {t("backup.replaceConfirm.deleteCount", {
                section: t(`backup.sections.${section}`),
                count: counts?.[section] ?? 0,
              })}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t("backup.replaceConfirm.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy}
            data-testid="backup-replace-confirm-btn"
          >
            {t("backup.replaceConfirm.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
