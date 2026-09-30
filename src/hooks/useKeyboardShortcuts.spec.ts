/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});
