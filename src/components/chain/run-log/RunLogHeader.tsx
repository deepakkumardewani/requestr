"use client";

import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/stores/useUIStore";

type RunLogHeaderProps = {
  runCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClearAll: () => void;
};

export function RunLogHeader({
  runCount,
  collapsed,
  onToggleCollapsed,
  onClearAll,
}: RunLogHeaderProps) {
  const t = useTranslations("chain");
  const autoOpen = useUIStore((s) => s.chainRunLogAutoOpen);
  const setAutoOpen = useUIStore((s) => s.setChainRunLogAutoOpen);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  return (
    <div
      data-testid="run-log-header"
      className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-3"
    >
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-xs font-semibold text-foreground">
          {t("runLogTitle")}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("runLogRunCount", { count: runCount })}
        </span>
      </button>

      <div className="flex items-center gap-1">
        {!collapsed && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("runLogOptions")}
                  />
                }
              >
                <MoreHorizontal className="size-3.5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuCheckboxItem
                  checked={autoOpen}
                  onCheckedChange={(checked) => setAutoOpen(Boolean(checked))}
                >
                  {t("runLogAutoOpenLabel")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmClearOpen(true)}
                >
                  {t("runLogClearAll")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ConfirmDeleteDialog
              open={confirmClearOpen}
              onOpenChange={setConfirmClearOpen}
              title={t("runLogClearAllConfirmTitle")}
              description={t("runLogClearAllConfirmDescription")}
              confirmLabel={t("runLogClearAll")}
              onConfirm={() => {
                setConfirmClearOpen(false);
                onClearAll();
              }}
            />
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={collapsed ? t("runLogExpand") : t("runLogCollapse")}
          onClick={onToggleCollapsed}
        >
          {collapsed ? (
            <ChevronUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}
