"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";

/** A collection or folder to bring into view; a fresh object per request so asking twice scrolls twice. */
type RevealRequest = { id: string };

type SidebarRevealState = {
  revealed: RevealRequest | null;
};

type SidebarRevealActions = {
  reveal: (id: string) => void;
  clear: () => void;
};

/**
 * Transient: which sidebar row Relay's Open just pointed at. The row subscribes
 * to select itself and scroll into view, even when its parents mounted late.
 */
export const useSidebarRevealStore = create<
  SidebarRevealState & SidebarRevealActions
>((set) => ({
  revealed: null,
  reveal: (id) => set({ revealed: { id } }),
  clear: () => set({ revealed: null }),
}));

/** Safety bound so a row that never settles cannot keep the frame loop alive. */
const MAX_SETTLE_FRAMES = 90;
/** Still frames required before giving up: an accordion can idle a few frames before it starts animating. */
export const STABLE_FRAMES_TO_STOP = 8;

/**
 * Scrolls the element into view, then keeps following it frame by frame while
 * ancestors animate open (their height changes move the row after it mounts).
 * Re-scrolls whenever the row moved, and stops once it has held still for several frames.
 */
function scrollWhileSettling(element: HTMLElement) {
  let frame = 0;
  let stableFrames = 0;
  let rafId = 0;
  let lastTop = element.getBoundingClientRect().top;
  element.scrollIntoView?.({ block: "nearest" });

  const follow = () => {
    const top = element.getBoundingClientRect().top;
    frame += 1;
    if (top !== lastTop) {
      lastTop = top;
      stableFrames = 0;
      element.scrollIntoView?.({ block: "nearest" });
    } else {
      stableFrames += 1;
      if (stableFrames >= STABLE_FRAMES_TO_STOP) return;
    }
    if (frame < MAX_SETTLE_FRAMES) rafId = requestAnimationFrame(follow);
  };
  rafId = requestAnimationFrame(follow);
  return () => cancelAnimationFrame(rafId);
}

/** For a tree row: whether it is the revealed one, plus the ref to scroll into view. */
export function useRevealedRow<T extends HTMLElement>(id: string) {
  const ref = useRef<T>(null);
  const revealed = useSidebarRevealStore((state) => state.revealed);
  const selected = revealed?.id === id;
  useEffect(() => {
    if (!selected || !ref.current) return;
    return scrollWhileSettling(ref.current);
  }, [selected, revealed]);
  return { ref, selected };
}
