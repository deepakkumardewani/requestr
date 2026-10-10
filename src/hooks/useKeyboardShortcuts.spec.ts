/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ChainShortcutHandler,
  SHORTCUT_GROUPS,
  type Shortcut,
  type ShortcutAlias,
} from "@/app/settings/constants";
import { getDB } from "@/lib/idb";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useUIStore.setState({
    commandPaletteOpen: false,
    keyboardShortcutsOpen: false,
  });
}

function fireKey(opts: KeyboardEventInit) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ...opts,
      }),
    );
  });
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.mocked(getDB).mockReturnValue(null);
    resetStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("invokes onSend on Ctrl+Enter", () => {
    const shortcuts = { onSend: vi.fn() };
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireKey({ ctrlKey: true, key: "Enter" });
    expect(shortcuts.onSend).toHaveBeenCalledTimes(1);
  });

  it("invokes onSend on Cmd+Enter", () => {
    const shortcuts = { onSend: vi.fn() };
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireKey({ metaKey: true, key: "Enter" });
    expect(shortcuts.onSend).toHaveBeenCalledTimes(1);
  });

  it("invokes onSave on Ctrl+S", () => {
    const shortcuts = { onSave: vi.fn() };
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireKey({ ctrlKey: true, key: "s" });
    expect(shortcuts.onSave).toHaveBeenCalledTimes(1);
  });

  it("prefers onCloseTab over store closeTab on Ctrl+W", () => {
    useTabsStore.getState().openTab({ name: "a" });
    useTabsStore.getState().openTab({ name: "b" });
    const tabs = useTabsStore.getState().tabs;
    const onCloseTab = vi.fn();
    const shortcuts = { onCloseTab };
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireKey({ ctrlKey: true, key: "w" });
    expect(onCloseTab).toHaveBeenCalledTimes(1);
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

  it("closes active tab via store when onCloseTab is omitted", () => {
    useTabsStore.getState().openTab({ name: "a" });
    useTabsStore.getState().openTab({ name: "b" });
    renderHook(() => useKeyboardShortcuts({}));
    const initialLen = useTabsStore.getState().tabs.length;
    fireKey({ ctrlKey: true, key: "w" });
    expect(useTabsStore.getState().tabs.length).toBe(initialLen - 1);
  });

  it("invokes onCloseAllTabs on Ctrl+Shift+W", () => {
    const onCloseAllTabs = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onCloseAllTabs }));
    fireKey({ ctrlKey: true, shiftKey: true, key: "w" });
    expect(onCloseAllTabs).toHaveBeenCalledTimes(1);
  });

  it("calls onNewRequest when provided on Ctrl+N", () => {
    const onNewRequest = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNewRequest }));
    fireKey({ ctrlKey: true, key: "n" });
    expect(onNewRequest).toHaveBeenCalledTimes(1);
  });

  it("falls back to openTab when Ctrl+N and no onNewRequest", () => {
    renderHook(() => useKeyboardShortcuts({}));
    fireKey({ ctrlKey: true, key: "n" });
    expect(useTabsStore.getState().tabs.length).toBe(1);
  });

  it("invokes onNewCollection on Ctrl+Shift+N", () => {
    const onNewCollection = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNewCollection }));
    fireKey({ ctrlKey: true, shiftKey: true, key: "n" });
    expect(onNewCollection).toHaveBeenCalledTimes(1);
  });

  it("invokes onTransformPlayground on Ctrl+Shift+T", () => {
    const onTransformPlayground = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onTransformPlayground }));
    fireKey({ ctrlKey: true, shiftKey: true, key: "t" });
    expect(onTransformPlayground).toHaveBeenCalledTimes(1);
  });

  it("uses Ctrl+T as new-request alias when onNewRequest missing", () => {
    renderHook(() => useKeyboardShortcuts({}));
    fireKey({ ctrlKey: true, key: "t" });
    expect(useTabsStore.getState().tabs.length).toBe(1);
  });

  it("does not handle Cmd+T as shortcut (Ctrl-only)", () => {
    const onNewRequest = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNewRequest }));
    fireKey({ metaKey: true, key: "t" });
    expect(onNewRequest).not.toHaveBeenCalled();
  });

  it("toggles command palette on Ctrl+K", () => {
    renderHook(() => useKeyboardShortcuts({}));
    fireKey({ ctrlKey: true, key: "k" });
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it("toggles command palette on Cmd+K", () => {
    renderHook(() => useKeyboardShortcuts({}));
    fireKey({ metaKey: true, key: "k" });
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it("activates previous tab on Ctrl+[", () => {
    useTabsStore.getState().openTab({ name: "1" });
    useTabsStore.getState().openTab({ name: "2" });
    const [first, second] = useTabsStore.getState().tabs;
    useTabsStore.getState().setActiveTab(second.tabId);
    renderHook(() => useKeyboardShortcuts({}));
    fireKey({ ctrlKey: true, key: "[" });
    expect(useTabsStore.getState().activeTabId).toBe(first.tabId);
  });

  it("activates next tab on Ctrl+]", () => {
    useTabsStore.getState().openTab({ name: "1" });
    useTabsStore.getState().openTab({ name: "2" });
    const [first, second] = useTabsStore.getState().tabs;
    useTabsStore.getState().setActiveTab(first.tabId);
    renderHook(() => useKeyboardShortcuts({}));
    fireKey({ ctrlKey: true, key: "]" });
    expect(useTabsStore.getState().activeTabId).toBe(second.tabId);
  });

  it("invokes environment and settings handlers", () => {
    const onManageEnvironments = vi.fn();
    const onOpenSettings = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ onManageEnvironments, onOpenSettings }),
    );
    fireKey({ ctrlKey: true, key: "e" });
    fireKey({ ctrlKey: true, key: "," });
    expect(onManageEnvironments).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("invokes import and JSON compare handlers", () => {
    const onImportCollection = vi.fn();
    const onCompareJson = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ onImportCollection, onCompareJson }),
    );
    fireKey({ ctrlKey: true, key: "i" });
    fireKey({ ctrlKey: true, key: "j" });
    expect(onImportCollection).toHaveBeenCalledTimes(1);
    expect(onCompareJson).toHaveBeenCalledTimes(1);
  });

  it("opens keyboard shortcuts modal on Ctrl+/", () => {
    renderHook(() => useKeyboardShortcuts({}));
    fireKey({ ctrlKey: true, key: "/" });
    expect(useUIStore.getState().keyboardShortcutsOpen).toBe(true);
  });

  it("ignores plain keys without modifier", () => {
    const onSend = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSend }));
    fireKey({ key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not fire any shortcut while focus is in an input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const onSend = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSend }));
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: "Enter",
        }),
      );
    });
    expect(onSend).not.toHaveBeenCalled();
    input.remove();
  });

  it("does not fire chain bindings when the canvas is unfocused", () => {
    const onUndo = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ onUndo }, { canvasFocused: false }),
    );
    fireKey({ metaKey: true, key: "z" });
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("fires chain bindings only while the canvas is focused", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ onUndo, onRedo }, { canvasFocused: true }),
    );
    fireKey({ metaKey: true, key: "z" });
    fireKey({ metaKey: true, shiftKey: true, key: "z" });
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("fires run/stop chain bindings on Cmd+Enter and Cmd+.", () => {
    const onRunChain = vi.fn();
    const onStopChain = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts(
        { onRunChain, onStopChain },
        { canvasFocused: true },
      ),
    );
    fireKey({ metaKey: true, key: "Enter" });
    fireKey({ metaKey: true, key: "." });
    expect(onRunChain).toHaveBeenCalledTimes(1);
    expect(onStopChain).toHaveBeenCalledTimes(1);
  });

  it("fires delete selection on plain Delete/Backspace while canvas is focused", () => {
    const onDeleteSelection = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ onDeleteSelection }, { canvasFocused: true }),
    );
    fireKey({ key: "Delete" });
    fireKey({ key: "Backspace" });
    expect(onDeleteSelection).toHaveBeenCalledTimes(2);
  });

  it("fires duplicate/copy/paste/select-all chain bindings while canvas is focused", () => {
    const handlers = {
      onDuplicateSelection: vi.fn(),
      onCopySelection: vi.fn(),
      onPasteSelection: vi.fn(),
      onSelectAll: vi.fn(),
    };
    renderHook(() =>
      useKeyboardShortcuts(handlers, {
        canvasFocused: true,
        hasSelection: true,
      }),
    );
    fireKey({ metaKey: true, key: "d" });
    fireKey({ metaKey: true, key: "c" });
    fireKey({ metaKey: true, key: "v" });
    fireKey({ metaKey: true, key: "a" });
    expect(handlers.onDuplicateSelection).toHaveBeenCalledTimes(1);
    expect(handlers.onCopySelection).toHaveBeenCalledTimes(1);
    expect(handlers.onPasteSelection).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it("opens the block menu on Cmd+Shift+K and on / while canvas is focused", () => {
    const onOpenBlockMenu = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ onOpenBlockMenu }, { canvasFocused: true }),
    );
    fireKey({ metaKey: true, shiftKey: true, key: "k" });
    fireKey({ key: "/" });
    expect(onOpenBlockMenu).toHaveBeenCalledTimes(2);
  });

  it("does not open the block menu on / when the canvas is unfocused", () => {
    const onOpenBlockMenu = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ onOpenBlockMenu }, { canvasFocused: false }),
    );
    fireKey({ key: "/" });
    expect(onOpenBlockMenu).not.toHaveBeenCalled();
  });

  it("still toggles the command palette on Cmd+K while the canvas is focused", () => {
    const onOpenBlockMenu = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ onOpenBlockMenu }, { canvasFocused: true }),
    );
    fireKey({ metaKey: true, key: "k" });
    expect(onOpenBlockMenu).not.toHaveBeenCalled();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it("opens the shortcuts overlay on ? only while the canvas is focused", () => {
    renderHook(() => useKeyboardShortcuts({}, { canvasFocused: true }));
    fireKey({ key: "?" });
    expect(useUIStore.getState().keyboardShortcutsOpen).toBe(true);
  });

  it("ignores ? when the canvas is unfocused", () => {
    renderHook(() => useKeyboardShortcuts({}, { canvasFocused: false }));
    fireKey({ key: "?" });
    expect(useUIStore.getState().keyboardShortcutsOpen).toBe(false);
  });

  it("fires auto-layout on L and fit-view on F only while canvas is focused", () => {
    const onAutoLayoutChain = vi.fn();
    const onFitViewChain = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts(
        { onAutoLayoutChain, onFitViewChain },
        { canvasFocused: true },
      ),
    );
    fireKey({ key: "l" });
    fireKey({ key: "f" });
    expect(onAutoLayoutChain).toHaveBeenCalledTimes(1);
    expect(onFitViewChain).toHaveBeenCalledTimes(1);
  });

  describe("registry parity (SHORTCUT_GROUPS chain group)", () => {
    const chainGroup = SHORTCUT_GROUPS.find((g) => g.id === "chain");
    type Chord = ShortcutAlias & { handler: ChainShortcutHandler; name: string };

    // Every registered chord (primary + aliases) becomes a real key event.
    const chords: Chord[] = (chainGroup?.shortcuts ?? []).flatMap(
      (s: Shortcut) =>
        [s, ...(s.aliases ?? [])].map((chord) => ({
          ...chord,
          handler: s.handler as ChainShortcutHandler,
          name: `${s.actionKey} (${chord.key})`,
        })),
    );

    function eventFor(chord: Chord): KeyboardEventInit {
      return {
        key: chord.key,
        metaKey: !chord.noModifier,
        shiftKey: Boolean(chord.shift) || chord.key === "?",
      };
    }

    it("registers a handler for every chain shortcut", () => {
      expect(chords.length).toBeGreaterThan(0);
      for (const c of chords) expect(c.handler, c.name).toBeTruthy();
    });

    it.each(chords)(
      "$name invokes $handler exactly once when the canvas is focused",
      (chord) => {
        const fn = vi.fn();
        const isOverlay = chord.handler === "openShortcutsOverlay";
        renderHook(() =>
          useKeyboardShortcuts(isOverlay ? {} : { [chord.handler]: fn }, {
            canvasFocused: true,
            hasSelection: true,
            hasClipboard: true,
          }),
        );
        fireKey(eventFor(chord));

        if (isOverlay) {
          expect(useUIStore.getState().keyboardShortcutsOpen).toBe(true);
          return;
        }
        expect(fn).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe("chain bindings", () => {
    type Binding = {
      name: string;
      handler: string;
      event: KeyboardEventInit;
    };
    const BINDINGS: Binding[] = [
      { name: "Run", handler: "onRunChain", event: { metaKey: true, key: "Enter" } },
      { name: "Stop", handler: "onStopChain", event: { metaKey: true, key: "." } },
      { name: "Undo", handler: "onUndo", event: { metaKey: true, key: "z" } },
      { name: "Redo", handler: "onRedo", event: { metaKey: true, shiftKey: true, key: "z" } },
      { name: "Delete", handler: "onDeleteSelection", event: { key: "Delete" } },
      { name: "Duplicate", handler: "onDuplicateSelection", event: { metaKey: true, key: "d" } },
      { name: "Copy", handler: "onCopySelection", event: { metaKey: true, key: "c" } },
      { name: "Paste", handler: "onPasteSelection", event: { metaKey: true, key: "v" } },
      { name: "Select all", handler: "onSelectAll", event: { metaKey: true, key: "a" } },
      { name: "Block menu (mod)", handler: "onOpenBlockMenu", event: { metaKey: true, shiftKey: true, key: "k" } },
      { name: "Block menu (/)", handler: "onOpenBlockMenu", event: { key: "/" } },
      { name: "Auto-layout", handler: "onAutoLayoutChain", event: { key: "l" } },
      { name: "Fit view", handler: "onFitViewChain", event: { key: "f" } },
      { name: "Find node", handler: "onFindNode", event: { metaKey: true, key: "f" } },
    ];

    it.each(BINDINGS)("$name calls $handler when the canvas is focused", ({ handler, event }) => {
      const fn = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({ [handler]: fn }, { canvasFocused: true, hasSelection: true, hasClipboard: true }),
      );
      fireKey(event);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it.each(BINDINGS)("$name is ignored when the canvas is not focused", ({ handler, event }) => {
      const fn = vi.fn();
      renderHook(() => useKeyboardShortcuts({ [handler]: fn }, { canvasFocused: false }));
      fireKey(event);
      expect(fn).not.toHaveBeenCalled();
    });

    // Mod+Enter and Mod+Shift+K fall through to the global send / command-palette bindings, which do claim the key.
    const CLAIMED_GLOBALLY = new Set(["Run", "Block menu (mod)"]);
    it.each(BINDINGS.filter((b) => !CLAIMED_GLOBALLY.has(b.name)))("$name does not preventDefault when its handler is missing", ({ event }) => {
      renderHook(() => useKeyboardShortcuts({}, { canvasFocused: true, hasSelection: true, hasClipboard: true }));
      const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...event });
      act(() => {
        window.dispatchEvent(e);
      });
      expect(e.defaultPrevented).toBe(false);
    });

    it("Cmd+Enter falls through to the global onSend when no run handler is supplied", () => {
      const onSend = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSend }, { canvasFocused: true }));
      fireKey({ metaKey: true, key: "Enter" });
      expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("ignores single-key bindings with Alt held or when auto-repeating", () => {
      const onAutoLayoutChain = vi.fn();
      const onDeleteSelection = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onAutoLayoutChain, onDeleteSelection }, { canvasFocused: true }));
      fireKey({ key: "l", altKey: true });
      fireKey({ key: "l", repeat: true });
      fireKey({ key: "Delete", repeat: true });
      expect(onAutoLayoutChain).not.toHaveBeenCalled();
      expect(onDeleteSelection).not.toHaveBeenCalled();
    });

    it("ignores auto-repeating modifier chords except undo/redo", () => {
      const handlers = {
        onDuplicateSelection: vi.fn(),
        onPasteSelection: vi.fn(),
        onRunChain: vi.fn(),
        onUndo: vi.fn(),
      };
      renderHook(() => useKeyboardShortcuts(handlers, { canvasFocused: true, hasClipboard: true }));
      fireKey({ ctrlKey: true, key: "d", repeat: true });
      fireKey({ ctrlKey: true, key: "v", repeat: true });
      fireKey({ ctrlKey: true, key: "Enter", repeat: true });
      fireKey({ ctrlKey: true, key: "z", repeat: true });
      expect(handlers.onDuplicateSelection).not.toHaveBeenCalled();
      expect(handlers.onPasteSelection).not.toHaveBeenCalled();
      expect(handlers.onRunChain).not.toHaveBeenCalled();
      expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["select", () => document.createElement("select")],
      ["role=textbox", () => {
        const el = document.createElement("div");
        el.setAttribute("role", "textbox");
        return el;
      }],
    ])("does not fire chain bindings while focus is in a %s", (_label, make) => {
      const onFitViewChain = vi.fn();
      const el = make();
      document.body.appendChild(el);
      renderHook(() => useKeyboardShortcuts({ onFitViewChain }, { canvasFocused: true }));
      act(() => {
        el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "f" }));
      });
      expect(onFitViewChain).not.toHaveBeenCalled();
      el.remove();
    });

    it("ignores chain bindings while a Radix dialog is open", () => {
      const onFitViewChain = vi.fn();
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("data-state", "open");
      document.body.appendChild(dialog);
      renderHook(() => useKeyboardShortcuts({ onFitViewChain }, { canvasFocused: true }));
      fireKey({ key: "f" });
      expect(onFitViewChain).not.toHaveBeenCalled();
      dialog.remove();
    });

    it("leaves native copy alone when nothing on the canvas is selected", () => {
      const onCopySelection = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCopySelection }, { canvasFocused: true, hasSelection: false }));
      const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, metaKey: true, key: "c" });
      act(() => {
        window.dispatchEvent(e);
      });
      expect(e.defaultPrevented).toBe(false);
    });

    it("pastes onto an empty selection when the clipboard is non-empty, and leaves native paste alone otherwise", () => {
      const onPasteSelection = vi.fn();
      const { rerender } = renderHook(
        ({ hasClipboard }) => useKeyboardShortcuts({ onPasteSelection }, { canvasFocused: true, hasSelection: false, hasClipboard }),
        { initialProps: { hasClipboard: true } },
      );
      const prevented = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, metaKey: true, key: "v" });
      act(() => {
        window.dispatchEvent(prevented);
      });
      expect(prevented.defaultPrevented).toBe(true);

      rerender({ hasClipboard: false });
      const native = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, metaKey: true, key: "v" });
      act(() => {
        window.dispatchEvent(native);
      });
      expect(native.defaultPrevented).toBe(false);
    });
  });

  describe("two-hook conflict (chain layer vs global layer)", () => {
    const CHAIN_ROUTE = { canvasFocused: true };

    it("two-hook conflict: Cmd+Shift+K opens the block menu once and does not toggle the command palette", () => {
      const onOpenBlockMenu = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onOpenBlockMenu }, CHAIN_ROUTE));
      fireKey({ metaKey: true, shiftKey: true, key: "k" });
      expect(onOpenBlockMenu).toHaveBeenCalledTimes(1);
      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    });

    it("two-hook conflict: Cmd+Enter runs the chain once and does not also fire global onSend", () => {
      const onRunChain = vi.fn();
      const onSend = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({ onRunChain, onSend }, CHAIN_ROUTE),
      );
      fireKey({ metaKey: true, key: "Enter" });
      expect(onRunChain).toHaveBeenCalledTimes(1);
      expect(onSend).not.toHaveBeenCalled();
    });

    it("two-hook conflict: global-only Cmd+K still toggles the command palette on the chain route", () => {
      renderHook(() => useKeyboardShortcuts({ onOpenBlockMenu: vi.fn() }, CHAIN_ROUTE));
      fireKey({ metaKey: true, key: "k" });
      expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    });

    it("two-hook conflict: global-only Ctrl+S and Ctrl+/ still fire on the chain route", () => {
      const onSave = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSave }, CHAIN_ROUTE));
      fireKey({ ctrlKey: true, key: "s" });
      fireKey({ ctrlKey: true, key: "/" });
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(useUIStore.getState().keyboardShortcutsOpen).toBe(true);
    });
  });

  describe("tab navigation boundaries", () => {
    function openTabs(count: number) {
      for (let i = 0; i < count; i += 1) {
        useTabsStore.getState().openTab({ name: `tab-${i}` });
      }
      return useTabsStore.getState().tabs;
    }

    it("keeps the first tab active on Ctrl+[ instead of wrapping to the last", () => {
      const [first] = openTabs(3);
      useTabsStore.getState().setActiveTab(first.tabId);
      renderHook(() => useKeyboardShortcuts({}));
      fireKey({ ctrlKey: true, key: "[" });
      expect(useTabsStore.getState().activeTabId).toBe(first.tabId);
    });

    it("keeps the last tab active on Ctrl+] instead of wrapping to the first", () => {
      const tabs = openTabs(3);
      const last = tabs[tabs.length - 1];
      useTabsStore.getState().setActiveTab(last.tabId);
      renderHook(() => useKeyboardShortcuts({}));
      fireKey({ ctrlKey: true, key: "]" });
      expect(useTabsStore.getState().activeTabId).toBe(last.tabId);
    });

    it("does nothing on Ctrl+[ and Ctrl+] when there are no tabs", () => {
      renderHook(() => useKeyboardShortcuts({}));
      fireKey({ ctrlKey: true, key: "[" });
      fireKey({ ctrlKey: true, key: "]" });
      expect(useTabsStore.getState().tabs).toHaveLength(0);
      expect(useTabsStore.getState().activeTabId).toBeNull();
    });

    it("keeps a single tab active on Ctrl+[ and Ctrl+]", () => {
      const [only] = openTabs(1);
      renderHook(() => useKeyboardShortcuts({}));
      fireKey({ ctrlKey: true, key: "[" });
      fireKey({ ctrlKey: true, key: "]" });
      expect(useTabsStore.getState().activeTabId).toBe(only.tabId);
    });

    it("does not switch tabs on Cmd+[ or Cmd+] (Ctrl-only)", () => {
      const [first, second] = openTabs(2);
      useTabsStore.getState().setActiveTab(second.tabId);
      renderHook(() => useKeyboardShortcuts({}));
      fireKey({ metaKey: true, key: "[" });
      expect(useTabsStore.getState().activeTabId).toBe(second.tabId);
      useTabsStore.getState().setActiveTab(first.tabId);
      fireKey({ metaKey: true, key: "]" });
      expect(useTabsStore.getState().activeTabId).toBe(first.tabId);
    });

    it("opens a new tab on Ctrl+T when no tabs exist and activates it", () => {
      renderHook(() => useKeyboardShortcuts({}));
      fireKey({ ctrlKey: true, key: "t" });
      const { tabs, activeTabId } = useTabsStore.getState();
      expect(tabs).toHaveLength(1);
      expect(activeTabId).toBe(tabs[0].tabId);
    });

    it("calls onNewRequest instead of opening a tab on Ctrl+T", () => {
      const onNewRequest = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onNewRequest }));
      fireKey({ ctrlKey: true, key: "t" });
      expect(onNewRequest).toHaveBeenCalledTimes(1);
      expect(useTabsStore.getState().tabs).toHaveLength(0);
    });
  });

  describe("save shortcut on macOS", () => {
    it("invokes onSave once on Cmd+S", () => {
      const onSave = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSave }));
      fireKey({ metaKey: true, key: "s" });
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("prevents the browser save-page dialog on Cmd+S", () => {
      renderHook(() => useKeyboardShortcuts({ onSave: vi.fn() }));
      const e = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        metaKey: true,
        key: "s",
      });
      act(() => {
        window.dispatchEvent(e);
      });
      expect(e.defaultPrevented).toBe(true);
    });

    it("does not invoke onSave on a plain S keypress", () => {
      const onSave = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSave }));
      fireKey({ key: "s" });
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
