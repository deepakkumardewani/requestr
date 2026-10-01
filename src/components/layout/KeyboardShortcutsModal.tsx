"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SHORTCUT_GROUPS } from "@/app/settings/constants";
import { ShortcutRow } from "@/components/common/ShortcutRow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isMac } from "@/lib/platform";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KeyboardShortcutsModal({ open, onOpenChange }: Props) {
  const tCommon = useTranslations("common");
  const tTooltips = useTranslations("tooltips");
  const tShortcuts = useTranslations("shortcuts");
  const tChain = useTranslations("chain");
  const [query, setQuery] = useState("");
  const onMac = isMac();
  const normalized = query.toLowerCase();

  const filteredGroups = SHORTCUT_GROUPS.map((group) => ({
    ...group,
    shortcuts: group.shortcuts.filter((s) =>
      tShortcuts(s.actionKey).toLowerCase().includes(normalized),
    ),
  })).filter((group) => group.shortcuts.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle>{tCommon("keyboardShortcuts")}</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={tTooltips("searchShortcuts")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {filteredGroups.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              {tShortcuts("noMatch", { query })}
            </p>
          ) : (
            filteredGroups.map(({ id, labelKey, shortcuts }) => (
              <div key={id} className="rounded-lg border">
                <div className="border-b bg-muted/40 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {tShortcuts(labelKey)}
                  </span>
                </div>
                {id === "chain" && (
                  <p className="px-4 py-2 text-xs text-muted-foreground border-b">
                    {tChain("handleSemanticsExplainer")}
                  </p>
                )}
                <div className="divide-y">
                  {shortcuts.map((shortcut) => (
                    <ShortcutRow
                      key={shortcut.actionKey}
                      shortcut={shortcut}
                      onMac={onMac}
                      label={tShortcuts(shortcut.actionKey)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
