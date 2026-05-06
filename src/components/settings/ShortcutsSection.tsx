"use client";

import { useTranslations } from "next-intl";
import { SHORTCUT_GROUPS, type Shortcut } from "@/app/settings/constants";
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

export function ShortcutsSection() {
  const onMac = isMac();
  const t = useTranslations("settings");

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-base font-semibold">{t("shortcuts.title")}</h2>

      <div className="space-y-4">
        {SHORTCUT_GROUPS.map(({ label, shortcuts }) => (
          <div
            key={label}
            className="rounded-lg border"
            data-testid="shortcut-group"
          >
            <div className="border-b bg-muted/40 px-4 py-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                data-testid="shortcut-group-label"
              >
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
        ))}
      </div>
    </div>
  );
}
