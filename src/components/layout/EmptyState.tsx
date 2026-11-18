"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyStateShortcuts } from "@/components/layout/EmptyStateShortcuts";
import { Button } from "@/components/ui/button";
import { formatShortcutByAction, NEW_TAB_ACTION } from "@/lib/formatShortcut";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";

export function EmptyState() {
  const t = useTranslations();
  const openTab = useTabsStore((s) => s.openTab);
  const setKeyboardShortcutsOpen = useUIStore(
    (s) => s.setKeyboardShortcutsOpen,
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">
            {t("common.emptyStateTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("common.emptyStateHint", {
              shortcut: formatShortcutByAction(NEW_TAB_ACTION),
            })}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => openTab()}
          data-testid="new-tab-btn"
          className="mt-2"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("common.newRequest")}
        </Button>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setKeyboardShortcutsOpen(true)}
          className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("common.keyboardShortcuts")}
        </button>
        <EmptyStateShortcuts />
      </div>
    </div>
  );
}
