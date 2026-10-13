"use client";

import { type RefObject, useEffect, useRef } from "react";
import { useRelayStore } from "@/stores/useRelayStore";

const ESCAPE_KEY = "Escape";

/** Overlays that own Esc while they are open; Relay must not close behind them. */
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

type UseRelayFocusOptions = {
  dockRef: RefObject<HTMLElement | null>;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  /**
   * First Esc hands focus back, a second Esc closes. Off for the sheet
   * layout, whose dialog primitive already owns Esc and focus return.
   */
  twoStepEscape: boolean;
};

/**
 * Focus contract for the Relay dock (FR-4): remember what had focus when the
 * user opened it, move focus to the composer, and give focus back on close.
 */
export function useRelayFocus({
  dockRef,
  composerRef,
  twoStepEscape,
}: UseRelayFocusOptions) {
  const focusRequest = useRelayStore((s) => s.focusRequest);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const escapeArmedRef = useRef(false);

  // The dock mounts lazily on the first open, after the toggle already ran, so
  // the store subscription below cannot see that first transition. Never
  // overwrite with null: under StrictMode this effect re-runs after the
  // composer took focus, and that must not erase what we captured.
  useEffect(() => {
    const { open, focusRequest: requested } = useRelayStore.getState();
    if (!open || requested === 0) return;
    previousFocusRef.current =
      focusedElementOutside(dockRef.current) ?? previousFocusRef.current;
  }, [dockRef]);

  // Runs after the commit so the dock is already interactive. A restored
  // `open` from storage never bumps focusRequest, so it never steals focus.
  useEffect(() => {
    if (focusRequest > 0) composerRef.current?.focus();
  }, [focusRequest, composerRef]);

  useEffect(() => {
    // Subscribers run synchronously inside the store update, before React
    // re-renders, so focus has not moved yet when we read it.
    return useRelayStore.subscribe((state, prev) => {
      const opened = !prev.open && state.open;
      if (opened && state.focusRequest !== prev.focusRequest) {
        previousFocusRef.current = focusedElementOutside(dockRef.current);
        escapeArmedRef.current = false;
      }
      if (prev.open && !state.open) {
        if (isFocusInDockOrNowhere(dockRef.current)) {
          returnFocus(previousFocusRef.current);
        }
        previousFocusRef.current = null;
        escapeArmedRef.current = false;
      }
    });
  }, [dockRef]);

  useEffect(() => {
    if (!twoStepEscape) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== ESCAPE_KEY || event.defaultPrevented) return;
      if (!useRelayStore.getState().open) return;
      if (document.querySelector(OVERLAY_SELECTOR)) return;

      const dock = dockRef.current;
      if (dock?.contains(document.activeElement)) {
        const composer = composerRef.current;
        const draftInProgress =
          !!composer &&
          document.activeElement === composer &&
          composer.value !== "";
        if (draftInProgress) return;
        returnFocus(previousFocusRef.current);
        escapeArmedRef.current = true;
        return;
      }

      if (escapeArmedRef.current) {
        useRelayStore.getState().setOpen(false);
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (dockRef.current?.contains(event.target as Node)) {
        escapeArmedRef.current = false;
      }
    }

    // Capture phase: the toggle's tooltip opens when focus returns to it and
    // would otherwise swallow the second Esc before it reaches a bubble listener.
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("focusin", handleFocusIn);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("focusin", handleFocusIn);
    };
  }, [twoStepEscape, dockRef, composerRef]);
}

function focusedElementOutside(dock: HTMLElement | null): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  return dock?.contains(active) ? null : active;
}

function isFocusInDockOrNowhere(dock: HTMLElement | null): boolean {
  const active = document.activeElement;
  return !active || active === document.body || !!dock?.contains(active);
}

/** Focuses `target`, or drops focus entirely when there is nothing to return to. */
function returnFocus(target: HTMLElement | null) {
  if (target?.isConnected) {
    target.focus();
    return;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}
