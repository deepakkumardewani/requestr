"use client";

import { Download, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ExportBackupDialog } from "./backup/ExportBackupDialog";
import { ImportBackupDialog } from "./backup/ImportBackupDialog";

type BackupDialog = "export" | "import";

type BackupRowProps = {
  testId: string;
  label: string;
  description: string;
  isOpen: boolean;
  icon: typeof Download;
  onOpen: () => void;
};

function BackupRow({
  testId,
  label,
  description,
  isOpen,
  icon: Icon,
  onOpen,
}: BackupRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-sm">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        data-testid={testId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={onOpen}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </Button>
    </div>
  );
}

/** Settings "Data" section: entry points for the workspace backup dialogs. */
export function DataSection() {
  const t = useTranslations("settings");
  const [openDialog, setOpenDialog] = useState<BackupDialog | null>(null);
  const closeDialog = () => setOpenDialog(null);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold">{t("backup.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("backup.description")}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <BackupRow
          testId="backup-export-btn"
          label={t("backup.exportAction")}
          description={t("backup.export.description")}
          isOpen={openDialog === "export"}
          icon={Download}
          onOpen={() => setOpenDialog("export")}
        />
        <BackupRow
          testId="backup-import-btn"
          label={t("backup.importAction")}
          description={t("backup.import.description")}
          isOpen={openDialog === "import"}
          icon={Upload}
          onOpen={() => setOpenDialog("import")}
        />
      </div>

      <ExportBackupDialog
        open={openDialog === "export"}
        onClose={closeDialog}
      />
      <ImportBackupDialog
        open={openDialog === "import"}
        onClose={closeDialog}
      />
    </div>
  );
}
