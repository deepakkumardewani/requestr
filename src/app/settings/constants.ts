import { Monitor, Moon, Sun } from "lucide-react";
import {
  RELAY_NEW_CHAT_SHORTCUTS,
  RELAY_SHORTCUTS,
  type RelayShortcutChord,
} from "@/lib/relay/constants";
import { isRelayEnabled } from "@/lib/relay/flag";

export type SettingsSection =
  | "general"
  | "global"
  | "appearance"
  | "proxy"
  | "shortcuts"
  | "language"
  | "relay";

export const SETTINGS_SECTIONS = [
  ["general", "General"],
  ["global", "Global"],
  ["appearance", "Appearance"],
  ["proxy", "Proxy & SSL"],
  ["shortcuts", "Shortcuts"],
  ["language", "Language"],
] as const;

const RELAY_SECTION = ["relay", "Relay"] as const;

/** `SETTINGS_SECTIONS` plus Relay, which disappears with the feature flag (FR-80). */
export function getSettingsSections(): readonly (
  | (typeof SETTINGS_SECTIONS)[number]
  | typeof RELAY_SECTION
)[] {
  return isRelayEnabled()
    ? [...SETTINGS_SECTIONS, RELAY_SECTION]
    : SETTINGS_SECTIONS;
}

/** Chain-canvas handler a binding invokes: a `ShortcutHandlers` prop, or the overlay opener the hook owns. */
export type ChainShortcutHandler =
  | "onRunChain"
  | "onStopChain"
  | "onUndo"
  | "onRedo"
  | "onDeleteSelection"
  | "onDuplicateSelection"
  | "onCopySelection"
  | "onPasteSelection"
  | "onSelectAll"
  | "onOpenBlockMenu"
  | "onAutoLayoutChain"
  | "onFitViewChain"
  | "onFindNode"
  | "openShortcutsOverlay";

export type ShortcutGroupId =
  | "general"
  | "request"
  | "workspace"
  | "tabs"
  | "chain";

export type Shortcut = {
  /** Key into messages/*\/shortcuts.json; also the stable identity of the binding. */
  actionKey: string;
  key: string;
  shift?: boolean;
  /** Use Ctrl even on Mac — avoids conflicts with macOS Cmd shortcuts */
  ctrlOnly?: boolean;
  /** True for bindings with no ⌘/Ctrl modifier (e.g. Delete, L, F, ?). */
  noModifier?: boolean;
  /** Chain bindings only: the handler the hook must invoke (asserted by the registry parity test). */
  handler?: ChainShortcutHandler;
  /** Key into messages/*\/shortcuts.json for a caveat shown beside the row in Settings. */
  noteKey?: string;
  /** Extra keys bound to the same action (e.g. Backspace for Delete). */
  aliases?: readonly ShortcutAlias[];
};

export type ShortcutAlias = Pick<
  Shortcut,
  "key" | "shift" | "ctrlOnly" | "noModifier"
>;

export type ShortcutGroup = {
  /** Stable identity; display text lives in messages via `labelKey`. */
  id: ShortcutGroupId;
  /** Key into messages/*\/shortcuts.json used to localize `label` for display. */
  labelKey: string;
  shortcuts: readonly Shortcut[];
};

/**
 * Mirrors the actual bindings in useKeyboardShortcuts.ts.
 * ctrlOnly=true → always show "Ctrl" (hook uses isCtrlOnly guard).
 * ctrlOnly=false/undefined → show "⌘" on Mac (hook uses isMod).
 */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    id: "general",
    labelKey: "groupGeneral",
    shortcuts: [
      { actionKey: "registryKeyboardShortcuts", key: "/" },
      { actionKey: "registryCommandPalette", key: "K" },
    ],
  },
  {
    id: "request",
    labelKey: "groupRequest",
    shortcuts: [
      { actionKey: "registrySendRequest", key: "Enter" },
      { actionKey: "saveCurrent", key: "S" },
    ],
  },
  {
    id: "workspace",
    labelKey: "groupWorkspace",
    shortcuts: [
      {
        actionKey: "newRequest",
        key: "N",
        ctrlOnly: true,
      },
      {
        actionKey: "registryNewCollection",
        key: "N",
        shift: true,
        ctrlOnly: true,
      },
      {
        actionKey: "manageEnvironments",
        key: "E",
        ctrlOnly: true,
      },
      {
        actionKey: "openSettings",
        key: ",",
        ctrlOnly: true,
      },
      {
        actionKey: "importCollection",
        key: "I",
        ctrlOnly: true,
      },
      {
        actionKey: "transformPlayground",
        key: "T",
        shift: true,
        ctrlOnly: true,
      },
      {
        actionKey: "compareJson",
        key: "J",
        ctrlOnly: true,
      },
    ],
  },
  {
    id: "tabs",
    labelKey: "groupTabs",
    shortcuts: [
      { actionKey: "registryCloseTab", key: "W", ctrlOnly: true },
      {
        actionKey: "closeAllTabs",
        key: "W",
        shift: true,
        ctrlOnly: true,
      },
      {
        actionKey: "previousTab",
        key: "[",
        ctrlOnly: true,
      },
      { actionKey: "nextTab", key: "]", ctrlOnly: true },
    ],
  },
  {
    id: "chain",
    labelKey: "groupChainCanvas",
    shortcuts: [
      {
        actionKey: "chainRun",
        handler: "onRunChain",
        key: "Enter",
      },
      {
        actionKey: "chainStop",
        handler: "onStopChain",
        key: ".",
      },
      { actionKey: "chainUndo", handler: "onUndo", key: "Z" },
      {
        actionKey: "chainRedo",
        handler: "onRedo",
        key: "Z",
        shift: true,
      },
      {
        actionKey: "chainDeleteSelection",
        handler: "onDeleteSelection",
        key: "Delete",
        noModifier: true,
        aliases: [{ key: "Backspace", noModifier: true }],
      },
      {
        actionKey: "chainDuplicateSelection",
        handler: "onDuplicateSelection",
        key: "D",
      },
      {
        actionKey: "chainCopySelection",
        handler: "onCopySelection",
        key: "C",
      },
      {
        actionKey: "chainPasteSelection",
        handler: "onPasteSelection",
        key: "V",
      },
      {
        actionKey: "chainSelectAll",
        handler: "onSelectAll",
        key: "A",
      },
      {
        actionKey: "chainOpenBlockMenu",
        handler: "onOpenBlockMenu",
        key: "K",
        shift: true,
        aliases: [{ key: "/", noModifier: true }],
      },
      {
        actionKey: "chainAutoLayout",
        handler: "onAutoLayoutChain",
        key: "L",
        noModifier: true,
      },
      {
        actionKey: "chainFitView",
        handler: "onFitViewChain",
        key: "F",
        noModifier: true,
      },
      {
        actionKey: "chainFindNode",
        handler: "onFindNode",
        key: "F",
      },
      {
        actionKey: "chainKeyboardShortcuts",
        handler: "openShortcutsOverlay",
        key: "?",
        noModifier: true,
      },
    ],
  },
] as const;

const RELAY_SHORTCUT_ACTION_KEY = "relayToggle";
const RELAY_NEW_CHAT_ACTION_KEY = "relayNewChat";
const RELAY_NEW_CHAT_NOTE_KEY = "relayNewChatNote";

/** A Relay chord as the registry's key-cap shape, so every surface renders it identically. */
export function toShortcutAlias(chord: RelayShortcutChord): ShortcutAlias {
  return {
    key: chord.key.toUpperCase(),
    shift: chord.shift,
    ctrlOnly: chord.ctrl,
  };
}

function toShortcut(
  chord: RelayShortcutChord,
  extra: Pick<Shortcut, "actionKey" | "noteKey">,
): Shortcut {
  return { ...extra, ...toShortcutAlias(chord) };
}

/** The Relay bindings as the platform actually uses them (Cmd+I / Ctrl+Shift+L, Cmd/Ctrl+Shift+O). */
function getRelayShortcuts(onMac: boolean): Shortcut[] {
  const platformKey = onMac ? "mac" : "other";
  return [
    toShortcut(RELAY_SHORTCUTS[platformKey], {
      actionKey: RELAY_SHORTCUT_ACTION_KEY,
    }),
    toShortcut(RELAY_NEW_CHAT_SHORTCUTS[platformKey], {
      actionKey: RELAY_NEW_CHAT_ACTION_KEY,
      noteKey: RELAY_NEW_CHAT_NOTE_KEY,
    }),
  ];
}

/**
 * `SHORTCUT_GROUPS` plus the Relay rows. Relay is kept out of the static
 * registry because its chord differs per platform and it disappears with the
 * feature flag, while the registry doubles as the platform-neutral README table.
 */
export function getShortcutGroups(onMac: boolean): readonly ShortcutGroup[] {
  if (!isRelayEnabled()) return SHORTCUT_GROUPS;
  return SHORTCUT_GROUPS.map((group) =>
    group.id === "general"
      ? {
          ...group,
          shortcuts: [...group.shortcuts, ...getRelayShortcuts(onMac)],
        }
      : group,
  );
}

export const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;
