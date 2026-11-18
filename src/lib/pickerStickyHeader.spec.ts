import { describe, expect, it } from "vitest";
import { pickerStickyHeader } from "@/lib/pickerStickyHeader";
import { EMPTY_MATCH } from "@/lib/pickerSearch";
import type { PickerHeaderRow, PickerRow } from "@/lib/pickerTree";

const header = (
  id: string,
  headerType: PickerHeaderRow["headerType"],
): PickerHeaderRow => ({
  kind: "header",
  id,
  headerType,
  label: id,
  depth: 0,
  expandable: true,
  expanded: true,
  count: { visible: 1, total: 1 },
});

const item = (id: string): PickerRow<unknown> => ({
  kind: "item",
  id,
  depth: 1,
  item: {},
  match: EMPTY_MATCH,
});

const rows: PickerRow<unknown>[] = [
  header("collection:a", "collection"),
  item("a1"),
  header("folder:f", "folder"),
  item("a2"),
  header("collection:b", "collection"),
  item("b1"),
];

describe("pickerStickyHeader", () => {
  it("pins the owning collection for a request row", () => {
    expect(pickerStickyHeader(1, rows)?.id).toBe("collection:a");
    expect(pickerStickyHeader(5, rows)?.id).toBe("collection:b");
  });

  it("looks through folder headers to the collection", () => {
    expect(pickerStickyHeader(3, rows)?.id).toBe("collection:a");
  });

  it("pins nothing when the first visible row is the collection header", () => {
    expect(pickerStickyHeader(0, rows)).toBeNull();
    expect(pickerStickyHeader(4, rows)).toBeNull();
  });

  it("pins nothing before any collection and for empty lists", () => {
    expect(pickerStickyHeader(0, [item("x"), ...rows])).toBeNull();
    expect(pickerStickyHeader(0, [])).toBeNull();
  });

  it("clamps an index past the end", () => {
    expect(pickerStickyHeader(99, rows)?.id).toBe("collection:b");
  });
});
