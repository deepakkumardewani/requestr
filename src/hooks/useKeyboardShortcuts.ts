"use client";

import { useEffect } from "react";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";

type ShortcutHandlers = {
  onSend?: () => void;
  onSave?: () => void;
  onCloseTab?: () => void;
  onCloseAllTabs?: () => void;
  onNewRequest?: () => void;
  onNewCollection?: () => void;
  onManageEnvironments?: () => void;
  onOpenSettings?: () => void;
  onImportCollection?: () => void;
  onTransformPlayground?: () => void;
  onCompareJson?: () => void;
  // Chain-canvas bindings — only fire while `canvasFocused` is true.
  onRunChain?: () => void;
  onStopChain?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDeleteSelection?: () => void;
  onDuplicateSelection?: () => void;
  onCopySelection?: () => void;
  onPasteSelection?: () => void;
  onSelectAll?: () => void;
  onOpenBlockMenu?: () => void;
  onAutoLayoutChain?: () => void;
  onFitViewChain?: () => void;
};

type ShortcutOptions = {
  /** True while the chain canvas route holds focus-within. Gates every chain binding. */
  canvasFocused?: boolean;
  /** True when the canvas has a node/edge selection — required for ⌘D / ⌘A to preventDefault. */
  hasSelection?: boolean;
};

/** True while focus sits in an input, textarea, or contenteditable element. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/**
 * Attaches global keyboard shortcuts to window.
 * Call from the component that owns the send/save handlers.
 *
 * Shortcuts (all use Ctrl, not Cmd, to avoid macOS browser conflicts):
 *   Ctrl+Enter       → Send request
 *   Ctrl+S           → Save request
 *   Ctrl+N           → New request
 *   Ctrl+Shift+N     → New collection
 *   Ctrl+T           → New request (alias)
 *   Ctrl+W           → Close active tab
 *   Ctrl+Shift+W     → Close all tabs
 *   Ctrl+[           → Previous tab
 *   Ctrl+]           → Next tab
 *   Ctrl+K / Cmd+K   → Toggle command palette
 *   Ctrl+E           → Manage environments
 *   Ctrl+,           → Open settings
 *   Ctrl+I           → Import collection
 *   Ctrl+Shift+T     → Transform playground
 *   Ctrl+J           → Compare JSON
 *
 * Chain canvas bindings (only fire while `canvasFocused` is true):
 *   ⌘/Ctrl+Enter     → Run chain
 *   ⌘/Ctrl+.         → Stop chain
 *   ⌘/Ctrl+Z         → Undo
 *   ⌘/Ctrl+Shift+Z   → Redo
 *   Delete/Backspace → Delete selection
 *   ⌘/Ctrl+D         → Duplicate selection
 *   ⌘/Ctrl+C         → Copy selection
 *   ⌘/Ctrl+V         → Paste
 *   ⌘/Ctrl+A         → Select all
 *   ⌘/Ctrl+Shift+K   → Open block menu
 *   /                → Open block menu (canvas-focused only)
 *   ?                → Open the shortcuts overlay (canvas-focused only)
 *   L                → Auto-layout
 *   F                → Fit view
 *
 * ⌘/Ctrl+K always toggles the command palette; it is never rebound to the
 * block menu. Non-modifier chain bindings (`/`, `?`, `L`, `F`) never fire
 * outside the chain canvas, and none fire while focus is in an editable
 * element.
 */
export function useKeyboardShortcuts(
  handlers: ShortcutHandlers = {},
  options: ShortcutOptions = {},
) {
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const setKeyboardShortcutsOpen = useUIStore(
    (s) => s.setKeyboardShortcutsOpen,
  );
  const { openTab, closeTab, activeTabId, tabs, setActiveTab } = useTabsStore();
  const { canvasFocused = false, hasSelection = false } = options;

  useEffect(() => {
    function handleChainShortcut(e: KeyboardEvent, isMod: boolean): boolean {
      if (!canvasFocused) return false;

      const key = e.key.toLowerCase();

      if (isMod && key === "enter") {
        e.preventDefault();
        handlers.onRunChain?.();
        return true;
      }
      if (isMod && key === ".") {
        e.preventDefault();
        handlers.onStopChain?.();
        return true;
      }
      if (isMod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handlers.onRedo?.();
        } else {
          handlers.onUndo?.();
        }
        return true;
      }
      if (!isMod && (key === "delete" || key === "backspace")) {
        handlers.onDeleteSelection?.();
        return true;
      }
      if (isMod && key === "d") {
        if (hasSelection) e.preventDefault();
        handlers.onDuplicateSelection?.();
        return true;
      }
      if (isMod && key === "c") {
        e.preventDefault();
        handlers.onCopySelection?.();
        return true;
      }
      if (isMod && key === "v") {
        e.preventDefault();
        handlers.onPasteSelection?.();
        return true;
      }
      if (isMod && key === "a") {
        if (hasSelection) e.preventDefault();
        handlers.onSelectAll?.();
        return true;
      }
      if (isMod && e.shiftKey && key === "k") {
        e.preventDefault();
        handlers.onOpenBlockMenu?.();
        return true;
      }
      if (!isMod && key === "/") {
        e.preventDefault();
        handlers.onOpenBlockMenu?.();
        return true;
      }
      if (!isMod && key === "?") {
        e.preventDefault();
        setKeyboardShortcutsOpen(true);
        return true;
      }
      if (!isMod && key === "l") {
        handlers.onAutoLayoutChain?.();
        return true;
      }
      if (!isMod && key === "f") {
        handlers.onFitViewChain?.();
        return true;
      }
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      const isMod = e.metaKey || e.ctrlKey;

      if (handleChainShortcut(e, isMod)) return;

      if (!isMod) return;

      // Ctrl-only shortcuts avoid conflicts with macOS browser Cmd shortcuts
      const isCtrlOnly = e.ctrlKey && !e.metaKey;

      switch (e.key.toLowerCase()) {
        case "enter":
          e.preventDefault();
          handlers.onSend?.();
          break;

        case "s":
          e.preventDefault();
          handlers.onSave?.();
          break;

        case "t":
          if (!isCtrlOnly) break;
          e.preventDefault();
          if (e.shiftKey) {
            handlers.onTransformPlayground?.();
          } else {
            handlers.onNewRequest ? handlers.onNewRequest() : openTab();
          }
          break;

        case "n":
          if (!isCtrlOnly) break;
          e.preventDefault();
          if (e.shiftKey) {
            handlers.onNewCollection?.();
          } else {
            handlers.onNewRequest ? handlers.onNewRequest() : openTab();
          }
          break;

        case "k":
          e.preventDefault();
          toggleCommandPalette();
          break;

        case "w":
          if (!isCtrlOnly) break;
          e.preventDefault();
          if (e.shiftKey) {
            handlers.onCloseAllTabs?.();
          } else if (handlers.onCloseTab) {
            handlers.onCloseTab();
          } else if (activeTabId) {
            closeTab(activeTabId);
          }
          break;

        case "[": {
          if (!isCtrlOnly) break;
          e.preventDefault();
          const idx = tabs.findIndex((t) => t.tabId === activeTabId);
          if (idx > 0) setActiveTab(tabs[idx - 1].tabId);
          break;
        }

        case "]": {
          if (!isCtrlOnly) break;
          e.preventDefault();
          const idx = tabs.findIndex((t) => t.tabId === activeTabId);
          if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].tabId);
          break;
        }

        case "e":
          if (!isCtrlOnly) break;
          e.preventDefault();
          handlers.onManageEnvironments?.();
          break;

        case ",":
          if (!isCtrlOnly) break;
          e.preventDefault();
          handlers.onOpenSettings?.();
          break;

        case "i":
          if (!isCtrlOnly) break;
          e.preventDefault();
          handlers.onImportCollection?.();
          break;

        case "j":
          if (!isCtrlOnly) break;
          e.preventDefault();
          handlers.onCompareJson?.();
          break;

        case "/":
          e.preventDefault();
          setKeyboardShortcutsOpen(true);
          break;
      }
    }

    // capture: true gives us priority over browser-level shortcuts (e.g. Cmd+W)
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    handlers,
    toggleCommandPalette,
    setKeyboardShortcutsOpen,
    openTab,
    closeTab,
    activeTabId,
    tabs,
    setActiveTab,
    canvasFocused,
    hasSelection,
  ]);
}
