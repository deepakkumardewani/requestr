import { describe, expect, it } from "vitest";
import { sliceChain } from "./chainSlice";

describe("sliceChain", () => {
  it("upTo returns the node and everything before it in a linear chain", () => {
    const order = ["a", "b", "c", "d"];
    expect(sliceChain(order, "c", "upTo")).toEqual(new Set(["a", "b", "c"]));
  });

  it("fromHere returns the node and everything after it in a linear chain", () => {
    const order = ["a", "b", "c", "d"];
    expect(sliceChain(order, "b", "fromHere")).toEqual(new Set(["b", "c", "d"]));
  });

  it("upTo handles a branch (condition node splitting the order)", () => {
    const order = ["req-1", "cond-1", "branch-a", "branch-b"];
    expect(sliceChain(order, "branch-a", "upTo")).toEqual(
      new Set(["req-1", "cond-1", "branch-a"]),
    );
  });

  it("fromHere handles a branch (condition node splitting the order)", () => {
    const order = ["req-1", "cond-1", "branch-a", "branch-b"];
    expect(sliceChain(order, "cond-1", "fromHere")).toEqual(
      new Set(["cond-1", "branch-a", "branch-b"]),
    );
  });

  it("upTo on the first node returns just that node (no ancestors)", () => {
    const order = ["a", "b", "c"];
    expect(sliceChain(order, "a", "upTo")).toEqual(new Set(["a"]));
  });

  it("fromHere on the last node returns just that node (no descendants)", () => {
    const order = ["a", "b", "c"];
    expect(sliceChain(order, "c", "fromHere")).toEqual(new Set(["c"]));
  });

  it("returns null when the node id is not present in the order", () => {
    expect(sliceChain(["a", "b"], "missing", "upTo")).toBeNull();
    expect(sliceChain(["a", "b"], "missing", "fromHere")).toBeNull();
  });
});
