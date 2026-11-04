"use client";

import { useTranslations } from "next-intl";
import { Kbd } from "@/components/ui/kbd";
import { formatShortcutByAction } from "@/lib/formatShortcut";

/** Registry action keys, in display order; labels and chords both come from the registry. */
const EMPTY_STATE_ACTIONS = [
  "newTab",
  "registryCloseTab",
  "registrySendRequest",
  "saveCurrent",
  "registryCommandPalette",
  "registryNewCollection",
] as const;

export function EmptyStateShortcuts() {
  const tShortcuts = useTranslations("shortcuts");

  return (
    <ul
      className="flex w-full max-w-xs flex-col gap-1.5"
      data-testid="empty-state-shortcuts"
    >
      {EMPTY_STATE_ACTIONS.map((actionKey) => (
        <li
          key={actionKey}
          className="flex items-center justify-between gap-4 text-xs text-muted-foreground"
        >
          <span className="truncate">{tShortcuts(actionKey)}</span>
          <Kbd>{formatShortcutByAction(actionKey)}</Kbd>
        </li>
      ))}
    </ul>
  );
}
