import { useMemo, useRef } from "react";

/**
 * Returns a per-id memoization cache: `getOrBuild` reuses the previous node object
 * for an id as long as its own dependency values are unchanged (`Object.is` per slot),
 * so an unrelated run-state change never produces a new object for other nodes.
 */
export function useNodeCache<T>() {
  const cache = useRef(new Map<string, { deps: unknown[]; node: T }>());
  return useMemo(
    () =>
      function getOrBuild(id: string, deps: unknown[], build: () => T): T {
        const cached = cache.current.get(id);
        if (
          cached &&
          cached.deps.length === deps.length &&
          cached.deps.every((d, i) => Object.is(d, deps[i]))
        ) {
          return cached.node;
        }
        const node = build();
        cache.current.set(id, { deps, node });
        return node;
      },
    [],
  );
}
