import type { Shortcut } from "@/app/settings/constants";
import { findShortcut } from "@/app/settings/constants";
import { isMac } from "@/lib/platform";
import { getShortcutKeyParts } from "@/lib/shortcutFormat";

const KEY_SEPARATOR = "+";

/** Action key of the Ctrl+T "new tab" registry entry. */
export const NEW_TAB_ACTION = "newTab";

/**
 * One label for a registry entry, e.g. "Ctrl+T". `ctrlOnly` entries say "Ctrl"
 * on every platform (mac included); the rest use the platform modifier.
 */
export function formatShortcut(entry: Shortcut): string {
  return getShortcutKeyParts(entry, isMac()).join(KEY_SEPARATOR);
}

/** The label for a registry binding looked up by its `actionKey`. */
export function formatShortcutByAction(actionKey: string): string {
  return formatShortcut(findShortcut(actionKey, isMac()));
}
