/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { useNodeSearch } from "./useNodeSearch";

const apiNode = (id: string, name: string, method = "GET", url = ""): Node => ({
  id,
  type: "chainNode",
  position: { x: 0, y: 0 },
  data: { name, method, url },
});
const blockNode = (id: string, type: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: {},
});

const nodes: Node[] = [
  apiNode("a1", "List users", "GET", "https://api.test/users"),
  apiNode("a2", "Create order", "POST", "https://api.test/orders"),
  blockNode("d1", "delayNode"),
  blockNode("x1", "mysteryNode"),
];

const search = (query: string, list: Node[] = nodes) =>
  renderHook(() => useNodeSearch(list, query)).result.current;

describe("useNodeSearch", () => {
  it("returns every known node in canvas order for an empty query", () => {
    expect(search("").map((r) => r.id)).toEqual(["a1", "a2", "d1"]);
  });

  it("skips nodes whose flow type is not a registered block", () => {
    expect(search("").some((r) => r.id === "x1")).toBe(false);
  });

  it("uses the request name and method for API nodes", () => {
    const [first] = search("");
    expect(first).toMatchObject({
      type: "api",
      label: "List users",
      method: "GET",
    });
  });

  it("labels non-API blocks with their localized block name", () => {
    const delay = search("").find((r) => r.id === "d1");
    expect(delay).toMatchObject({ type: "delay", method: undefined });
    expect(delay?.label.length).toBeGreaterThan(0);
  });

  it("falls back to the block label when an API node has no name", () => {
    const [result] = search("", [apiNode("a3", "")]);
    expect(result.label.length).toBeGreaterThan(0);
  });

  it("filters by name and reports highlight ranges", () => {
    const results = search("order");
    expect(results.map((r) => r.id)).toEqual(["a2"]);
    expect(results[0].nameRanges.length).toBeGreaterThan(0);
  });

  it("matches on URL and method too", () => {
    expect(search("users").map((r) => r.id)).toContain("a1");
    expect(search("post").map((r) => r.id)).toEqual(["a2"]);
  });

  it("returns nothing when no node matches", () => {
    expect(search("zzzzqq")).toEqual([]);
  });
});
