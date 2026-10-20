/**
 * Context chip identity, kept free of imports so the always-loaded store can
 * use it without pulling tool code into the main bundle (NFR-2).
 */

/** What a context chip points at (FR-13). Mirrors the dock's chip type. */
export type ContextChipKind =
  | "tab"
  | "request"
  | "chain"
  | "collection"
  | "environment";

export type ContextChip = {
  kind: ContextChipKind;
  id: string;
  label: string;
};

export const chipKey = (chip: Pick<ContextChip, "kind" | "id">): string =>
  `${chip.kind}:${chip.id}`;

/** Tab mention when that request is already attached as a pill (same target, different chipKey). */
export const isRedundantTabAttach = (
  chip: ContextChip,
  attached: readonly ContextChip[],
  tabRequestId: string | null | undefined,
): boolean => {
  if (chip.kind !== "tab" || !tabRequestId) return false;
  return attached.some(
    (item) => item.kind === "request" && item.id === tabRequestId,
  );
};

/** Request mention when an attached tab chip already points at this request. */
export const isRedundantRequestAttach = (
  chip: ContextChip,
  requestIdsFromAttachedTabs: ReadonlySet<string>,
): boolean => {
  if (chip.kind !== "request") return false;
  return requestIdsFromAttachedTabs.has(chip.id);
};
