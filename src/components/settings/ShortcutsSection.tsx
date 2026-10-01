"use client";

import { useTranslations } from "next-intl";
import { SHORTCUT_GROUPS } from "@/app/settings/constants";
import { ShortcutRow } from "@/components/common/ShortcutRow";
import { isMac } from "@/lib/platform";

export function ShortcutsSection() {
  const onMac = isMac();
  const t = useTranslations("settings");
  const tShortcuts = useTranslations("shortcuts");

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-base font-semibold">{t("shortcuts.title")}</h2>

      <div className="space-y-4">
        {SHORTCUT_GROUPS.map(({ id, labelKey, shortcuts }) => (
          <div
            key={id}
            className="rounded-lg border"
            data-testid="shortcut-group"
          >
            <div className="border-b bg-muted/40 px-4 py-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                data-testid="shortcut-group-label"
              >
                {tShortcuts(labelKey)}
              </span>
            </div>
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
        ))}
      </div>
    </div>
  );
}
