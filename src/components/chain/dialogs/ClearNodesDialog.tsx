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

type ClearNodesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ClearNodesDialog({
  open,
  onOpenChange,
  onConfirm,
}: ClearNodesDialogProps) {
  const t = useTranslations("chain");
  const tCommon = useTranslations("common");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" data-testid="clear-nodes-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("clearNodesTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("clearNodesDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel className="w-full sm:w-auto">
            {tCommon("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="w-full whitespace-nowrap px-4 sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {t("clearNodesConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
