"use client";

import { useEffect } from "react";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";

/**
 * Development-only provider that exposes window.__chainDev for chain fixture seeding.
 * Wrapped conditionally in the app — only renders in NODE_ENV !== 'production'.
 */
export function ChainDevProvider({ children }: { children: React.ReactNode }) {
  const collectionsStore = useCollectionsStore();
  const chainStore = useChainStore();
  const environmentsStore = useEnvironmentsStore();

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // Dynamic import to tree-shake in production
      import("@/lib/dev/chainFixturesWindow").then(({ exposeChainDevAPI }) => {
        exposeChainDevAPI({
          collectionsStore,
          chainStore,
          environmentsStore,
        });
      });
    }
  }, [collectionsStore, chainStore, environmentsStore]);

  return <>{children}</>;
}
