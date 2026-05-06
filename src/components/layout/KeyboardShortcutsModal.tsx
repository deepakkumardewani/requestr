"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SHORTCUT_GROUPS, type Shortcut } from "@/app/settings/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { isMac } from "@/lib/platform";

const CMD = "⌘";
const CTRL = "Ctrl";

function getModifierKeys(shortcut: Shortcut, onMac: boolean): string[] {
  const mod = shortcut.ctrlOnly ? CTRL : onMac ? CMD : CTRL;
  return [mod, ...(shortcut.shift ? ["Shift"] : []), shortcut.key];
}

function ShortcutRow({
  shortcut,
  onMac,
}: {
  shortcut: Shortcut;
  onMac: boolean;
}) {
  const parts = getModifierKeys(shortcut, onMac);
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm">{shortcut.action}</span>
      <div className="flex items-center gap-0.5">
        {parts.map((part) => (
          <Kbd key={part}>{part}</Kbd>
        ))}
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KeyboardShortcutsModal({ open, onOpenChange }: Props) {
  const tCommon = useTranslations("common");
  const tTooltips = useTranslations("tooltips");
  const [query, setQuery] = useState("");
  const onMac = isMac();
  const normalized = query.toLowerCase();

  const filteredGroups = SHORTCUT_GROUPS.map((group) => ({
    ...group,
    shortcuts: group.shortcuts.filter((s) =>
      s.action.toLowerCase().includes(normalized),
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
              No shortcuts match &ldquo;{query}&rdquo;
            </p>
          ) : (
            filteredGroups.map(({ label, shortcuts }) => (
              <div key={label} className="rounded-lg border">
                <div className="border-b bg-muted/40 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </span>
                </div>
                <div className="divide-y">
                  {shortcuts.map((shortcut) => (
                    <ShortcutRow
                      key={shortcut.action}
                      shortcut={shortcut}
                      onMac={onMac}
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
