"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ClearHistoryDialog({ open, onOpenChange, onConfirm }: Props) {
  const t = useTranslations("settings");
  const ct = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("clearHistory.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("clearHistory.description")}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {ct("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            data-testid="confirm-clear-history-btn"
          >
            {t("clearHistory.title")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
