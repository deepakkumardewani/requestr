import type {
  Shortcut,
  ShortcutAlias,
  ShortcutGroup,
} from "@/app/settings/constants";

export const CMD_SYMBOL = "⌘";
export const CTRL_LABEL = "Ctrl";
/** README/docs are platform-neutral: show both modifiers. */
export const CMD_OR_CTRL_LABEL = `${CMD_SYMBOL}/${CTRL_LABEL}`;
const SHIFT_LABEL = "Shift";

type KeyChord = ShortcutAlias;

function modifierLabel(chord: KeyChord, cmdLabel: string): string {
  return chord.ctrlOnly ? CTRL_LABEL : cmdLabel;
}

function chordParts(chord: KeyChord, cmdLabel: string): string[] {
  if (chord.noModifier) return [chord.key];
  return [
    modifierLabel(chord, cmdLabel),
    ...(chord.shift ? [SHIFT_LABEL] : []),
    chord.key,
  ];
}

/** Key caps for the primary binding, using ⌘ on Mac and Ctrl elsewhere. */
export function getShortcutKeyParts(shortcut: Shortcut, onMac: boolean) {
  return chordParts(shortcut, onMac ? CMD_SYMBOL : CTRL_LABEL);
}

/** Key caps for one alias of a shortcut (same platform rules as the primary). */
export function getAliasKeyParts(alias: ShortcutAlias, onMac: boolean) {
  return chordParts(alias, onMac ? CMD_SYMBOL : CTRL_LABEL);
}

function markdownChord(chord: KeyChord): string {
  return chordParts(chord, CMD_OR_CTRL_LABEL)
    .map((part) => `\`${part}\``)
    .join(" ");
}

/** README cell for a shortcut: primary chord, then aliases separated by " / ". */
export function formatShortcutMarkdown(shortcut: Shortcut): string {
  return [shortcut, ...(shortcut.aliases ?? [])].map(markdownChord).join(" / ");
}

/** The README shortcut table, generated from the registry and English messages so docs cannot drift. */
export function buildShortcutsMarkdownTable(
  groups: readonly ShortcutGroup[],
  messages: Readonly<Record<string, string>>,
): string {
  const rows = groups.flatMap((group) =>
    group.shortcuts.map(
      (s) =>
        `| ${messages[group.labelKey]} | ${messages[s.actionKey]} | ${formatShortcutMarkdown(s)} |`,
    ),
  );
  return ["| Group | Action | Shortcut |", "| --- | --- | --- |", ...rows].join(
    "\n",
  );
}
