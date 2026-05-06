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

export type Shortcut = {
  action: string;
  key: string;
  shift?: boolean;
  /** Use Ctrl even on Mac — avoids conflicts with macOS Cmd shortcuts */
  ctrlOnly?: boolean;
};

export type ShortcutGroup = {
  label: string;
  shortcuts: readonly Shortcut[];
};

/**
 * Mirrors the actual bindings in useKeyboardShortcuts.ts.
 * ctrlOnly=true → always show "Ctrl" (hook uses isCtrlOnly guard).
 * ctrlOnly=false/undefined → show "⌘" on Mac (hook uses isMod).
 */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    label: "General",
    shortcuts: [
      { action: "Keyboard Shortcuts", key: "/" },
      { action: "Command Palette", key: "K" },
    ],
  },
  {
    label: "Request",
    shortcuts: [
      { action: "Send Request", key: "Enter" },
      { action: "Save Current", key: "S" },
    ],
  },
  {
    label: "Workspace",
    shortcuts: [
      { action: "New Request", key: "N", ctrlOnly: true },
      { action: "New Collection", key: "N", shift: true, ctrlOnly: true },
      { action: "Manage Environments", key: "E", ctrlOnly: true },
      { action: "Open Settings", key: ",", ctrlOnly: true },
      { action: "Import Collection", key: "I", ctrlOnly: true },
      { action: "Transform Playground", key: "T", shift: true, ctrlOnly: true },
      { action: "Compare JSON", key: "J", ctrlOnly: true },
    ],
  },
  {
    label: "Tabs",
    shortcuts: [
      { action: "Close Tab", key: "W", ctrlOnly: true },
      { action: "Close All Tabs", key: "W", shift: true, ctrlOnly: true },
      { action: "Previous Tab", key: "[", ctrlOnly: true },
      { action: "Next Tab", key: "]", ctrlOnly: true },
    ],
  },
] as const;

export const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;
