"use client";

import { useTranslations } from "next-intl";
import {
  getShortcutGroups,
  type ShortcutGroup,
} from "@/app/settings/constants";
import { ShortcutRow } from "@/components/common/ShortcutRow";
import { useRelayAvailable } from "@/hooks/useRelayAvailable";
import { isMac } from "@/lib/platform";

/**
 * Two columns from the `lg` breakpoint (1024px) up so every shortcut fits at
 * 1280x720 without scrolling; one column below it. Tailwind needs the literal
 * class, so the breakpoint is named here rather than built dynamically.
 */
const TWO_COLUMN_BREAKPOINT_CLASS = "lg:grid-cols-2";

/** Heading line each group adds on top of its rows when balancing columns. */
const GROUP_HEADER_WEIGHT = 1;

function groupWeight(group: ShortcutGroup): number {
  const notes = group.shortcuts.filter((s) => s.noteKey).length;
  return GROUP_HEADER_WEIGHT + group.shortcuts.length + notes;
}

/**
 * Splits the groups into a left and right run at the point that best balances
 * their height. The split is contiguous so the single-column order (below the
 * breakpoint) is the registry order.
 */
function splitIntoColumns(
  groups: readonly ShortcutGroup[],
): [readonly ShortcutGroup[], readonly ShortcutGroup[]] {
  const total = groups.reduce((sum, g) => sum + groupWeight(g), 0);
  let bestIndex = 0;
  let bestGap = total;
  let left = 0;
  groups.forEach((group, index) => {
    left += groupWeight(group);
    const gap = Math.abs(total - 2 * left);
    if (gap < bestGap) {
      bestGap = gap;
      bestIndex = index + 1;
    }
  });
  return [groups.slice(0, bestIndex), groups.slice(bestIndex)];
}

export function ShortcutsSection() {
  const onMac = isMac();
  // Relay rows follow the same gate as every other Relay surface (FR-23).
  const relayAvailable = useRelayAvailable();
  const t = useTranslations("settings");
  const tShortcuts = useTranslations("shortcuts");
  const columns = splitIntoColumns(getShortcutGroups(onMac, relayAvailable));

  return (
    <div className="max-w-5xl space-y-4">
      <h2 className="text-base font-semibold">{t("shortcuts.title")}</h2>

      <div
        className={`grid grid-cols-1 items-start gap-4 ${TWO_COLUMN_BREAKPOINT_CLASS}`}
        data-testid="shortcut-groups"
      >
        {columns.map((groups) => (
          <div key={groups[0]?.id ?? "empty"} className="space-y-4">
            {groups.map(({ id, labelKey, shortcuts }) => (
              <div
                key={id}
                className="rounded-lg border"
                data-testid="shortcut-group"
              >
                <div className="border-b bg-muted/40 px-4 py-1.5">
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
                      dense
                      shortcut={shortcut}
                      onMac={onMac}
                      label={tShortcuts(shortcut.actionKey)}
                      note={
                        shortcut.noteKey
                          ? tShortcuts(shortcut.noteKey)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
