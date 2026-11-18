"use client";

import { useEffect } from "react";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";

/**
 * Development-only provider that exposes window.__chainDev for chain fixture seeding.
 * AppProviders always wraps children in it; only the effect below is gated
 * on NODE_ENV === "development".
 */
export function ChainDevProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // Dynamic import to tree-shake in production
      import("@/lib/dev/chainFixturesWindow").then(({ exposeChainDevAPI }) => {
        // Read via getState() so this provider never subscribes to the stores;
        // the collections getter keeps the dev API from seeing a stale snapshot.
        exposeChainDevAPI({
          collectionsStore: {
            ...useCollectionsStore.getState(),
            get collections() {
              return useCollectionsStore.getState().collections;
            },
          },
          chainStore: useChainStore.getState(),
          environmentsStore: useEnvironmentsStore.getState(),
        });
      });
    }
  }, []);

  return <>{children}</>;
}
