"use client";

import { useEffect } from "react";

/**
 * Smooth scrolling is set on <html> for the landing's anchors; arriving here from a
 * deep scroll position would otherwise animate the jump back to the top.
 */
export function ScrollReset() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  }, []);
  return null;
}
