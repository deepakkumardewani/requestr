import { describe, expect, it } from "vitest";
import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import {
  PICKER_PAGE_SIZE,
  pickerNavReducer,
  type PickerNavKey,
  type PickerNavKeyName,
  type PickerNavState,
} from "@/lib/pickerNav";
import { PICKER_MAX_DEPTH, type PickerRow } from "@/lib/pickerTree";

const header = (
  id: string,
  depth: number,
  over: { expandable?: boolean; expanded?: boolean } = {},
): PickerRow<unknown> => ({
  kind: "header",
  id,
  headerType: id.startsWith("folder") ? "folder" : "collection",
  label: id,
  depth,
  expandable: over.expandable ?? true,
  expanded: over.expanded ?? true,
  count: { visible: 1, total: 1 },
});
const item = (id: string, depth: number): PickerRow<unknown> => ({
  kind: "item",
  id,
  depth,
  item: {},
  match: { score: 0, nameRanges: [], urlRanges: [] },
});

const make = (rows: PickerRow<unknown>[], over: Partial<PickerNavState> = {}): PickerNavState => ({
  rows,
  activeId: null,
  expanded: new Set(),
  selectedIds: new Set(),
  inChainIds: new Set(),
  anchorId: null,
  ...over,
});
const press = (state: PickerNavState, key: PickerNavKeyName, mods: Omit<PickerNavKey, "key"> = {}) =>
  pickerNavReducer(state, { key, ...mods });

// c1 > [f1 > [a, b], c], c2 (collapsed)
const tree = [
  header("collection:c1", 0),
  header("folder:f1", 1),
  item("a", 2),
  item("b", 2),
  item("c", 1),
  header("collection:c2", 0, { expanded: false }),
];

describe("pickerNavReducer movement", () => {
  it("does nothing without rows", () => {
    const state = make([]);
    expect(press(state, "ArrowDown")).toEqual({ state, effect: null });
  });

  it("ArrowDown/Up start from the ends when nothing is active and clamp", () => {
    expect(press(make(tree), "ArrowDown").state.activeId).toBe("collection:c1");
    expect(press(make(tree), "ArrowUp").state.activeId).toBe("collection:c2");
    expect(press(make(tree, { activeId: "collection:c2" }), "ArrowDown").state.activeId).toBe("collection:c2");
    expect(press(make(tree, { activeId: "collection:c1" }), "ArrowUp").state.activeId).toBe("collection:c1");
    expect(press(make(tree, { activeId: "a" }), "ArrowDown").state.activeId).toBe("b");
    expect(press(make(tree, { activeId: "b" }), "ArrowUp").state.activeId).toBe("a");
  });

  it("Home and End jump to the ends", () => {
    expect(press(make(tree, { activeId: "b" }), "Home").state.activeId).toBe("collection:c1");
    expect(press(make(tree, { activeId: "b" }), "End").state.activeId).toBe("collection:c2");
  });

  it("PageDown/PageUp move by the page size and clamp", () => {
    const rows = Array.from({ length: 20 }, (_, i) => item(`r${i}`, 0));
    expect(press(make(rows, { activeId: "r1" }), "PageDown").state.activeId).toBe(`r${1 + PICKER_PAGE_SIZE}`);
    expect(press(make(rows, { activeId: "r18" }), "PageDown").state.activeId).toBe("r19");
    expect(press(make(rows, { activeId: "r12" }), "PageUp").state.activeId).toBe(`r${12 - PICKER_PAGE_SIZE}`);
    expect(press(make(rows, { activeId: "r2" }), "PageUp").state.activeId).toBe("r0");
    expect(press(make(rows), "PageUp").state.activeId).toBe("r19");
  });

  it("plain movement clears the range anchor", () => {
    expect(press(make(tree, { activeId: "a", anchorId: "b" }), "ArrowDown").state.anchorId).toBeNull();
  });

  it("keeps in-chain rows focusable", () => {
    const state = make(tree, { activeId: "a", inChainIds: new Set(["b"]) });
    expect(press(state, "ArrowDown").state.activeId).toBe("b");
  });

  it("ignores unknown activation keys without an active row", () => {
    const state = make(tree);
    expect(press(state, "Enter").state).toBe(state);
    expect(press(state, "ArrowLeft").state).toBe(state);
    expect(press(state, "ArrowRight").state).toBe(state);
  });
});

describe("pickerNavReducer Left/Right", () => {
  it("Left collapses an expanded header", () => {
    const { state } = press(make(tree, { activeId: "folder:f1", expanded: new Set(["f1", "c1"]) }), "ArrowLeft");
    expect([...state.expanded]).toEqual(["c1"]);
    expect(state.activeId).toBe("folder:f1");
  });

  it("Left on a collapsed header moves to its parent header", () => {
    const rows = [header("collection:c1", 0), header("folder:f1", 1, { expanded: false })];
    expect(press(make(rows, { activeId: "folder:f1" }), "ArrowLeft").state.activeId).toBe("collection:c1");
  });

  it("Left on a request moves to the owning header, skipping sibling subfolders", () => {
    expect(press(make(tree, { activeId: "c" }), "ArrowLeft").state.activeId).toBe("collection:c1");
    expect(press(make(tree, { activeId: "a" }), "ArrowLeft").state.activeId).toBe("folder:f1");
  });

  it("Left on a root header or non-expandable header stays put", () => {
    const rows = [header("collection:c1", 0, { expanded: false }), header("day:Today", 0, { expandable: false })];
    expect(press(make(rows, { activeId: "collection:c1" }), "ArrowLeft").state.activeId).toBe("collection:c1");
    expect(press(make(rows, { activeId: "day:Today" }), "ArrowLeft").state.activeId).toBe("day:Today");
  });

  it("Left treats equal depth as parent at the clamped max depth", () => {
    const rows = [header("folder:deep", PICKER_MAX_DEPTH), item("x", PICKER_MAX_DEPTH)];
    expect(press(make(rows, { activeId: "x" }), "ArrowLeft").state.activeId).toBe("folder:deep");
  });

  it("Right expands a collapsed header", () => {
    const { state } = press(make(tree, { activeId: "collection:c2" }), "ArrowRight");
    expect([...state.expanded]).toEqual(["c2"]);
  });

  it("Right on an expanded header moves to its first child", () => {
    expect(press(make(tree, { activeId: "collection:c1" }), "ArrowRight").state.activeId).toBe("folder:f1");
  });

  it("Right on an expanded header with no following row, a request, or a non-expandable header is a no-op", () => {
    const last = [header("collection:c1", 0)];
    expect(press(make(last, { activeId: "collection:c1" }), "ArrowRight").state.activeId).toBe("collection:c1");
    expect(press(make(tree, { activeId: "a" }), "ArrowRight").state.activeId).toBe("a");
    const day = [header("day:Today", 0, { expandable: false })];
    expect(press(make(day, { activeId: "day:Today" }), "ArrowRight").state.activeId).toBe("day:Today");
  });
});

describe("pickerNavReducer Enter/Space", () => {
  it("toggles headers with Enter and Space", () => {
    const open = press(make(tree, { activeId: "collection:c2" }), "Enter").state;
    expect(open.expanded.has("c2")).toBe(true);
    const closed = press(make(tree, { activeId: "collection:c1", expanded: new Set(["c1"]) }), " ").state;
    expect(closed.expanded.has("c1")).toBe(false);
  });

  it("does nothing on a non-expandable header", () => {
    const rows = [header("day:Today", 0, { expandable: false })];
    const state = make(rows, { activeId: "day:Today" });
    expect(press(state, "Enter")).toEqual({ state, effect: null });
  });

  it("Enter on a request adds it in single mode", () => {
    expect(press(make(tree, { activeId: "a" }), "Enter").effect).toEqual({ type: "add", ids: ["a"] });
  });

  it("Enter toggles when a selection exists, Space always toggles", () => {
    const withSel = make(tree, { activeId: "a", selectedIds: new Set(["b"]) });
    expect([...press(withSel, "Enter").state.selectedIds]).toEqual(["b", "a"]);
    expect([...press(make(tree, { activeId: "a" }), " ").state.selectedIds]).toEqual(["a"]);
    const selected = make(tree, { activeId: "a", selectedIds: new Set(["a", "b"]) });
    expect([...press(selected, " ").state.selectedIds]).toEqual(["b"]);
  });

  it("never selects or adds in-chain rows and reports them", () => {
    const state = make(tree, { activeId: "a", inChainIds: new Set(["a"]) });
    expect(press(state, "Enter")).toEqual({ state, effect: { type: "in-chain", id: "a" } });
    expect(press(state, " ").effect).toEqual({ type: "in-chain", id: "a" });
  });

  it("rejects toggling past the cap", () => {
    const full = new Set(Array.from({ length: PICKER_SELECTION_CAP }, (_, i) => `s${i}`));
    const result = press(make(tree, { activeId: "a", selectedIds: full }), " ");
    expect(result.state.selectedIds.size).toBe(PICKER_SELECTION_CAP);
    expect(result.effect).toEqual({ type: "cap-reached" });
  });
});

describe("pickerNavReducer Shift range", () => {
  it("selects anchor..active across headers, keeping the anchor", () => {
    let result = press(make(tree, { activeId: "a" }), "ArrowDown", { shiftKey: true });
    expect([...result.state.selectedIds]).toEqual(["a", "b"]);
    expect(result.state.anchorId).toBe("a");
    result = press(result.state, "ArrowDown", { shiftKey: true });
    expect([...result.state.selectedIds]).toEqual(["a", "b", "c"]);
  });

  it("works upward and skips in-chain rows", () => {
    const state = make(tree, { activeId: "c", inChainIds: new Set(["b"]) });
    const result = press(state, "ArrowUp", { shiftKey: true });
    expect([...result.state.selectedIds]).toEqual(["c"]);
    const next = press(result.state, "ArrowUp", { shiftKey: true });
    expect(next.state.activeId).toBe("a");
    expect([...next.state.selectedIds].sort()).toEqual(["a", "c"].sort());
  });

  it("only spans visible rows: collapsed content between ends is not selected", () => {
    const rows = [item("r1", 0), header("collection:hidden", 0, { expanded: false }), item("r2", 0)];
    const result = press(make(rows, { activeId: "r1" }), "ArrowDown", { shiftKey: true });
    const next = press(result.state, "ArrowDown", { shiftKey: true });
    expect([...next.state.selectedIds]).toEqual(["r1", "r2"]);
  });

  it("falls back to the target when the anchor is no longer visible", () => {
    const state = make(tree, { activeId: "gone", anchorId: "gone" });
    const result = press(state, "ArrowDown", { shiftKey: true });
    expect(result.state.activeId).toBe("collection:c1");
    expect(result.state.selectedIds.size).toBe(0);
  });

  it("Shift with a non-vertical key is a plain move", () => {
    const result = press(make(tree, { activeId: "a" }), "End", { shiftKey: true });
    expect(result.state.selectedIds.size).toBe(0);
    expect(result.state.activeId).toBe("collection:c2");
  });

  it("stops at the cap and reports it", () => {
    const rows = Array.from({ length: PICKER_SELECTION_CAP + 5 }, (_, i) => item(`r${i}`, 0));
    let state = make(rows, { activeId: "r0", anchorId: "r0" });
    let effect = null;
    for (let i = 0; i < PICKER_SELECTION_CAP + 3; i++) {
      const r = pickerNavReducer(state, { key: "ArrowDown", shiftKey: true });
      state = r.state;
      effect = r.effect ?? effect;
    }
    expect(state.selectedIds.size).toBe(PICKER_SELECTION_CAP);
    expect(effect).toEqual({ type: "cap-reached" });
  });
});

describe("pickerNavReducer Cmd+A", () => {
  it("selects visible requests only, skipping headers and in-chain rows", () => {
    const state = make(tree, { inChainIds: new Set(["b"]) });
    const result = press(state, "a", { metaKey: true });
    expect([...result.state.selectedIds]).toEqual(["a", "c"]);
    expect(result.effect).toBeNull();
  });

  it("accepts Ctrl+A and ignores plain a", () => {
    expect(press(make(tree), "a", { ctrlKey: true }).state.selectedIds.size).toBe(3);
    const state = make(tree);
    expect(press(state, "a")).toEqual({ state, effect: null });
  });

  it("caps at PICKER_SELECTION_CAP and reports it", () => {
    const rows = Array.from({ length: PICKER_SELECTION_CAP + 20 }, (_, i) => item(`r${i}`, 0));
    const result = press(make(rows), "a", { metaKey: true });
    expect(result.state.selectedIds.size).toBe(PICKER_SELECTION_CAP);
    expect(result.effect).toEqual({ type: "cap-reached" });
  });

  it("keeps existing selection and does not duplicate", () => {
    const result = press(make(tree, { selectedIds: new Set(["a", "zzz"]) }), "a", { metaKey: true });
    expect(result.state.selectedIds.size).toBe(4);
  });
});
