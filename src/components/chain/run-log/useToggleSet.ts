import { useCallback, useState } from "react";

/** A Set<string> of "on" keys with stable toggle/clear callbacks. */
export function useToggleSet() {
  const [keys, setKeys] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setKeys((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);
  const clear = useCallback(() => setKeys(new Set()), []);
  const has = useCallback((key: string) => keys.has(key), [keys]);

  return { has, toggle, clear };
}
