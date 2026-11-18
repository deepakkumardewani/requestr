/**
 * Slices a chain's linearized execution order around one node — used by
 * "Run up to" (ancestors, inclusive) and "Run from here" (descendants, inclusive).
 *
 * `order` is the topologically-sorted node id list produced by `buildExecutionOrder`
 * (see `chainRunner.ts`) — branch semantics are already baked into that ordering,
 * so slicing by index is sufficient and avoids re-deriving the DAG here.
 */
export type SliceDirection = "upTo" | "fromHere";

/**
 * Returns the subset of `order` for the given direction relative to `nodeId`,
 * or `null` if `nodeId` is not present in `order`.
 */
export function sliceChain(
  order: string[],
  nodeId: string,
  direction: SliceDirection,
): Set<string> | null {
  const idx = order.indexOf(nodeId);
  if (idx === -1) return null;

  return direction === "upTo"
    ? new Set(order.slice(0, idx + 1))
    : new Set(order.slice(idx));
}
