"use client";

import { Download, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { DESTRUCTIVE_BUTTON_CONTRAST_CLASS } from "@/app/settings/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { ExportBackupDialog } from "./backup/ExportBackupDialog";
import { ImportBackupDialog } from "./backup/ImportBackupDialog";
import { ClearHistoryDialog } from "./ClearHistoryDialog";

type DataDialog = "export" | "import" | "clearHistory";

type DataRowProps = {
  testId: string;
  label: string;
  /** Text on the button; differs from `label` when the row names a scope ("Request history"). */
  actionLabel: string;
  destructive?: boolean;
  description: string;
  isOpen: boolean;
  icon: typeof Download;
  onOpen: () => void;
};

function DataRow({
  testId,
  label,
  actionLabel,
  destructive = false,
  description,
  isOpen,
  icon: Icon,
  onOpen,
}: DataRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-sm">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Button
        variant={destructive ? "destructive" : "outline"}
        size="sm"
        className={destructive ? DESTRUCTIVE_BUTTON_CONTRAST_CLASS : undefined}
        data-testid={testId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={onOpen}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {actionLabel}
      </Button>
    </div>
  );
}

/** Settings "Data" section: entry points for the workspace backup dialogs. */
export function DataSection() {
  const t = useTranslations("settings");
  const [openDialog, setOpenDialog] = useState<DataDialog | null>(null);
  const et = useTranslations("errors");
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const closeDialog = () => setOpenDialog(null);

  function handleClearHistory() {
    clearHistory();
    closeDialog();
    toast.success(et("historyCleared"));
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold">{t("backup.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("backup.description")}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <DataRow
          testId="backup-export-btn"
          label={t("backup.exportAction")}
          actionLabel={t("backup.exportAction")}
          description={t("backup.export.description")}
          isOpen={openDialog === "export"}
          icon={Download}
          onOpen={() => setOpenDialog("export")}
        />
        <DataRow
          testId="backup-import-btn"
          label={t("backup.importAction")}
          actionLabel={t("backup.importAction")}
          description={t("backup.import.description")}
          isOpen={openDialog === "import"}
          icon={Upload}
          onOpen={() => setOpenDialog("import")}
        />
      </div>

      <div className="rounded-lg border p-4">
        <DataRow
          testId="clear-history-btn"
          label={t("clearHistory.label")}
          actionLabel={t("clearHistory.button")}
          destructive
          description={t("clearHistory.description")}
          isOpen={openDialog === "clearHistory"}
          icon={Trash2}
          onOpen={() => setOpenDialog("clearHistory")}
        />
      </div>

      <ClearHistoryDialog
        open={openDialog === "clearHistory"}
        onOpenChange={(open) => !open && closeDialog()}
        onConfirm={handleClearHistory}
      />
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
