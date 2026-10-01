"use client";

import { useEffect } from "react";
import { isEditableTarget } from "@/lib/isEditableTarget";
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
  // Chain-canvas bindings — only fire while `canvasFocused` is true and a handler is supplied.
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
  /** True when the canvas has a node selection — ⌘C only claims the key (skipping native copy) then. */
  hasSelection?: boolean;
  /** True when the chain clipboard is non-empty — ⌘V only claims the key (skipping native paste) then. */
  hasClipboard?: boolean;
};

type ChainShortcutContext = {
  handlers: ShortcutHandlers;
  hasSelection: boolean;
  hasClipboard: boolean;
  openShortcutsOverlay: () => void;
};

// Radix Dialog/Sheet/AlertDialog content; chain keys must not act behind a modal.
const OPEN_DIALOG_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

function hasOpenDialog(): boolean {
  return document.querySelector(OPEN_DIALOG_SELECTOR) !== null;
}

/**
 * Runs `handler` and claims the key. Returns false (key falls through to the
 * browser / other listeners) when there is no handler, so unbound keys are
 * never preventDefault-ed.
 */
function dispatchChainKey(
  e: KeyboardEvent,
  handler: (() => void) | undefined,
  preventDefault = true,
): boolean {
  if (!handler) return false;
  if (preventDefault) e.preventDefault();
  handler();
  return true;
}

function runModChainShortcut(
  e: KeyboardEvent,
  key: string,
  { handlers, hasSelection, hasClipboard }: ChainShortcutContext,
): boolean {
  switch (key) {
    case "enter":
      return dispatchChainKey(e, handlers.onRunChain);
    case ".":
      return dispatchChainKey(e, handlers.onStopChain);
    case "z":
      return dispatchChainKey(
        e,
        e.shiftKey ? handlers.onRedo : handlers.onUndo,
      );
    case "d":
      return dispatchChainKey(e, handlers.onDuplicateSelection);
    case "c":
      return dispatchChainKey(e, handlers.onCopySelection, hasSelection);
    case "v":
      return dispatchChainKey(e, handlers.onPasteSelection, hasClipboard);
    case "a":
      return dispatchChainKey(e, handlers.onSelectAll);
    case "k":
      return e.shiftKey && dispatchChainKey(e, handlers.onOpenBlockMenu);
    default:
      return false;
  }
}

function runPlainChainShortcut(
  e: KeyboardEvent,
  key: string,
  { handlers, openShortcutsOverlay }: ChainShortcutContext,
): boolean {
  switch (key) {
    case "delete":
    case "backspace":
      return dispatchChainKey(e, handlers.onDeleteSelection, false);
    case "/":
      return dispatchChainKey(e, handlers.onOpenBlockMenu);
    case "?":
      return dispatchChainKey(e, openShortcutsOverlay);
    case "l":
      return dispatchChainKey(e, handlers.onAutoLayoutChain, false);
    case "f":
      return dispatchChainKey(e, handlers.onFitViewChain, false);
    default:
      return false;
  }
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
  const {
    canvasFocused = false,
    hasSelection = false,
    hasClipboard = false,
  } = options;

  useEffect(() => {
    const chainContext: ChainShortcutContext = {
      handlers,
      hasSelection,
      hasClipboard,
      openShortcutsOverlay: () => setKeyboardShortcutsOpen(true),
    };

    function handleChainShortcut(e: KeyboardEvent, isMod: boolean): boolean {
      if (!canvasFocused || hasOpenDialog()) return false;
      const key = e.key.toLowerCase();
      // Held keys must not re-fire run/duplicate/paste; only undo/redo repeat by convention.
      if (e.repeat && !(isMod && key === "z")) return false;
      if (!isMod && e.altKey) return false;

      return isMod
        ? runModChainShortcut(e, key, chainContext)
        : runPlainChainShortcut(e, key, chainContext);
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
          // Only claim the key when someone handles it, so unbound Mod+Enter stays native.
          if (!handlers.onSend) break;
          e.preventDefault();
          handlers.onSend();
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
    hasClipboard,
  ]);
}
