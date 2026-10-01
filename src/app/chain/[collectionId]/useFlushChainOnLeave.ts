"use client";

import { useEffect } from "react";
import { persistChain } from "@/stores/useChainStore";

/**
 * Forces any pending debounced chain write to flush before the tab is hidden,
 * closed, or the page unmounts (route change), so in-flight edits are never lost.
 */
export function useFlushChainOnLeave(): void {
  useEffect(() => {
    const flush = () => {
      void persistChain.flush();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flush();
    };
  }, []);
}
