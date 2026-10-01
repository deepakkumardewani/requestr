import { Monitor, Moon, Sun } from "lucide-react";

export type SettingsSection =
  | "general"
  | "global"
  | "appearance"
  | "proxy"
  | "shortcuts"
  | "language";

export const SETTINGS_SECTIONS = [
  ["general", "General"],
  ["global", "Global"],
  ["appearance", "Appearance"],
  ["proxy", "Proxy & SSL"],
  ["shortcuts", "Shortcuts"],
  ["language", "Language"],
] as const;

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
        actionKey: "chainKeyboardShortcuts",
        handler: "openShortcutsOverlay",
        key: "?",
        noModifier: true,
      },
    ],
  },
] as const;

export const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;
