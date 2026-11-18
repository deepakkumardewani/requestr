/** @vitest-environment happy-dom */
import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useEmptyChainUndoShortcuts } from "./useEmptyChainUndoShortcuts";

const CHAIN_ID = "chain-1";

describe("useEmptyChainUndoShortcuts", () => {
  const undo = vi.fn();
  const redo = vi.fn();

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    undo.mockClear();
    redo.mockClear();
    vi.spyOn(useChainStore, "getState").mockReturnValue({
      undo,
      redo,
    } as unknown as ReturnType<typeof useChainStore.getState>);
  });

  it("undoes on Mod+Z and redoes on Mod+Shift+Z when active", () => {
    renderHook(() => useEmptyChainUndoShortcuts(CHAIN_ID, true));
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(undo).toHaveBeenCalledWith(CHAIN_ID);
    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });
    expect(redo).toHaveBeenCalledWith(CHAIN_ID);
  });

  it("ignores other keys and open dialogs", () => {
    renderHook(() => useEmptyChainUndoShortcuts(CHAIN_ID, true));
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.keyDown(window, { key: "z" });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    dialog.remove();
    expect(undo).not.toHaveBeenCalled();
  });

  it("leaves keys pressed inside the canvas to the canvas", () => {
    renderHook(() => useEmptyChainUndoShortcuts(CHAIN_ID, true));
    const canvas = document.createElement("div");
    canvas.setAttribute("role", "application");
    document.body.appendChild(canvas);
    fireEvent.keyDown(canvas, { key: "z", metaKey: true });
    canvas.remove();
    expect(undo).not.toHaveBeenCalled();
  });

  it("does nothing when inactive (canvas owns the keys)", () => {
    renderHook(() => useEmptyChainUndoShortcuts(CHAIN_ID, false));
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });
});
