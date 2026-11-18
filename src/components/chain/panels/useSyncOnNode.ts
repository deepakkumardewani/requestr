import { useEffect, useRef } from "react";

/**
 * Re-seeds a config panel's local draft state whenever the edited block changes.
 * `reset` is read through a ref so callers can pass an inline closure without
 * re-running the effect on every render (which would clobber in-progress edits).
 */
export function useSyncOnNode<TNode>(
  node: TNode | null,
  reset: (node: TNode) => void,
): void {
  const resetRef = useRef(reset);
  useEffect(() => {
    resetRef.current = reset;
  });

  useEffect(() => {
    if (node) resetRef.current(node);
  }, [node]);
}
