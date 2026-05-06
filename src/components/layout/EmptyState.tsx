"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { modKey } from "@/lib/platform";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";

type Shortcut = {
  keys: string[];
  labelKey:
    | "newTab"
    | "closeTab"
    | "sendRequest"
    | "saveRequest"
    | "commandPalette"
    | "keyboardShortcuts"
    | "newCollection";
};

function getShortcuts(): Shortcut[] {
  const mod = modKey();
  return [
    { keys: ["Ctrl", "T"], labelKey: "newTab" },
    { keys: ["Ctrl", "W"], labelKey: "closeTab" },
    { keys: [mod, "↵"], labelKey: "sendRequest" },
    { keys: [mod, "S"], labelKey: "saveRequest" },
    { keys: [mod, "K"], labelKey: "commandPalette" },
    { keys: [mod, "/"], labelKey: "keyboardShortcuts" },
    { keys: ["Ctrl", "N"], labelKey: "newCollection" },
  ];
}

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {label}
    </kbd>
  );
}

export function EmptyState() {
  const t = useTranslations();
  const tShortcuts = useTranslations("shortcuts");
  const openTab = useTabsStore((s) => s.openTab);
  const setKeyboardShortcutsOpen = useUIStore(
    (s) => s.setKeyboardShortcutsOpen,
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {t("common.noTabsOpen")}
        </p>
        <Button size="sm" onClick={() => openTab()} data-testid="new-tab-btn">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("common.newRequest")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setKeyboardShortcutsOpen(true)}
          className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
        >
          {t("common.keyboardShortcuts")}
        </button>
        <div className="flex flex-col gap-1.5">
          {getShortcuts().map((s) => (
            <div
              key={s.labelKey}
              className="flex items-center justify-between gap-8"
            >
              <span className="text-xs text-muted-foreground">
                {tShortcuts(s.labelKey)}
              </span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <KeyBadge key={k} label={k} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
