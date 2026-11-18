import { useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";

/** Loads persisted chain preferences (run-log dock, concurrency) after mount to avoid SSR hydration mismatches. */
export function useHydrateChainPreferences(): void {
  const hydrate = useUIStore((s) => s.hydrateChainPreferences);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
}
