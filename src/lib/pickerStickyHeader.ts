import type { PickerHeaderRow, PickerRow } from "@/lib/pickerTree";

/**
 * The collection header to pin over the list for the row at `firstVisibleIndex`.
 * Returns `null` when that row is itself the collection header (it is already on screen) or when no
 * collection precedes it (e.g. a "Recent" group or day headers), so nothing is pinned redundantly.
 */
export function pickerStickyHeader(
  firstVisibleIndex: number,
  rows: ReadonlyArray<PickerRow<unknown>>,
): PickerHeaderRow | null {
  const start = Math.min(firstVisibleIndex, rows.length - 1);
  for (let i = start; i >= 0; i--) {
    const row = rows[i];
    if (row.kind !== "header" || row.headerType !== "collection") continue;
    return i === firstVisibleIndex ? null : row;
  }
  return null;
}
