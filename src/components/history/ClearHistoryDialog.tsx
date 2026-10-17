"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ClearHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
};

/** Confirms wiping the whole history; nothing is cleared unless the user confirms. */
export function ClearHistoryDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: ClearHistoryDialogProps) {
  const t = useTranslations("common");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" data-testid="clear-history-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("history.clearTitle")}</AlertDialogTitle>
          <AlertDialogDescription data-testid="clear-history-body">
            {t("history.clearBody", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel
            className="w-full sm:w-auto"
            data-testid="clear-history-cancel"
          >
            {t("history.clearCancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="w-full whitespace-nowrap bg-destructive px-4 text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
            onClick={onConfirm}
            data-testid="clear-history-confirm"
          >
            {t("history.clearConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
