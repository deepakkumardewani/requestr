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
