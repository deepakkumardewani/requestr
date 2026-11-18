import { useEffect } from "react";
import { isEditableTarget } from "@/lib/isEditableTarget";
import { useChainStore } from "@/stores/useChainStore";

const OPEN_DIALOG_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

/** The canvas wrapper (`role="application"`) handles undo/redo itself while focused. */
const CANVAS_SELECTOR = '[role="application"]';

/**
 * Keeps ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z bound while the chain has no nodes, even
 * when focus is outside the canvas (e.g. after "Clear all nodes" from the
 * header menu). Keys pressed inside the canvas are left to the canvas so they
 * are never handled twice.
 *
 * Deliberately a dedicated listener rather than a second `useKeyboardShortcuts`
 * call: that hook also owns the global bindings (⌘K, Ctrl+S, ...), which would
 * fire twice and cancel themselves out.
 */
export function useEmptyChainUndoShortcuts(chainId: string, active: boolean) {
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(e: KeyboardEvent) {
      const isUndoKey = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z";
      if (!isUndoKey || isEditableTarget(e.target)) return;
      if (document.querySelector(OPEN_DIALOG_SELECTOR)) return;
      if (e.target instanceof Element && e.target.closest(CANVAS_SELECTOR)) {
        return;
      }

      e.preventDefault();
      const store = useChainStore.getState();
      if (e.shiftKey) store.redo(chainId);
      else store.undo(chainId);
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [chainId, active]);
}
