"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useRelativeNow } from "@/hooks/useRelativeNow";

const RelativeNowContext = createContext<number | undefined>(undefined);

/**
 * Owns the single ticking `now` for a subtree (one interval, paused while the
 * tab is hidden). Leaf `RelativeTime` elements read it from context, so
 * memoized parents such as `RunCard` never re-render on a tick.
 */
export function RelativeNowProvider({ children }: { children: ReactNode }) {
  const now = useRelativeNow();
  return (
    <RelativeNowContext.Provider value={now}>
      {children}
    </RelativeNowContext.Provider>
  );
}

/** The provider's `now`; throws when used outside one so a stray consumer
 * can never silently start its own timer. */
export function useRelativeNowValue(): number {
  const now = useContext(RelativeNowContext);
  if (now === undefined) {
    throw new Error(
      "RelativeTime needs a `now` prop or a <RelativeNowProvider> ancestor.",
    );
  }
  return now;
}
