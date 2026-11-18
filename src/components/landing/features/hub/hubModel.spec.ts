import { describe, expect, it } from "vitest";
import type { Feature } from "../../data/features";
import { DEFAULT_CATEGORY, groupByCategory, groupHeadingId, placeGroup } from "./hubModel";

function feature(id: string, extra: Partial<Feature> = {}): Feature {
  return { id, title: id, description: id, ...extra };
}

describe("groupByCategory", () => {
  it("keeps first-seen order and puts uncategorised features in More", () => {
    const groups = groupByCategory([
      feature("a", { category: "B" }),
      feature("b", { category: "A" }),
      feature("c"),
      feature("d", { category: "B" }),
    ]);
    expect(groups.map((group) => group.category)).toEqual(["B", "A", DEFAULT_CATEGORY]);
    expect(groups[0].features.map((f) => f.id)).toEqual(["a", "d"]);
  });
});

describe("groupHeadingId", () => {
  it("slugifies the category into a space-free id", () => {
    expect(groupHeadingId("JSON Tools")).toBe("group-json-tools");
    expect(groupHeadingId(" AI & More ")).toBe("group-ai-more");
  });
});

describe("placeGroup", () => {
  it("leads with wide preview cards and pairs the rest", () => {
    const placed = placeGroup([feature("a"), feature("b", { preview: "compare" }), feature("c")]);
    expect(placed).toEqual([
      { feature: expect.objectContaining({ id: "b" }), wide: true },
      { feature: expect.objectContaining({ id: "a" }), wide: false },
      { feature: expect.objectContaining({ id: "c" }), wide: false },
    ]);
  });

  it("widens an odd compact card so no grid cell is left empty", () => {
    const placed = placeGroup([feature("a"), feature("b"), feature("c")]);
    expect(placed.map((p) => p.wide)).toEqual([false, false, true]);
  });
});
