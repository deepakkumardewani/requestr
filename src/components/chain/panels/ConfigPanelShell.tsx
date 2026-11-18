import { type LucideIcon, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const DEFAULT_WIDTH_CLASS = "w-[400px]";

type ConfigPanelShellProps = {
  open: boolean;
  title: string;
  icon: LucideIcon;
  iconClassName?: string;
  /** Tailwind width class; panels with wide editors pass "w-[440px]". */
  widthClass?: string;
  /** Disables Save while the draft is invalid. */
  canSave?: boolean;
  /** data-testid for the Save button (e.g. "loop-config-save-btn"). */
  saveButtonTestId?: string;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  children: ReactNode;
};

/** Side sheet with the Save / Cancel / Delete footer shared by the block config panels. */
export function ConfigPanelShell({
  open,
  title,
  icon: Icon,
  iconClassName,
  widthClass = DEFAULT_WIDTH_CLASS,
  canSave = true,
  saveButtonTestId,
  onSave,
  onDelete,
  onClose,
  children,
}: ConfigPanelShellProps) {
  const t = useTranslations("chain");

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent
        side="right"
        className={cn(widthClass, "flex flex-col gap-0 p-0")}
      >
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Icon className={cn("h-4 w-4", iconClassName)} />
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {children}
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!canSave}
            data-testid={saveButtonTestId}
            onClick={() => {
              onSave();
              onClose();
            }}
          >
            {t("configPanelSaveButton")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onClose}
          >
            {t("configPanelCancelButton")}
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {t("configPanelDeleteNodeButton")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
