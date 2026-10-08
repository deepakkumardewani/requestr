import { describe, expect, it } from "vitest";
import type { Chain, ChainEdge, SubChainBlock } from "@/types/chain";
import {
  getInvalidSubChainNodeIds,
  getUpstreamAliases,
  isSubChainReferenceInvalid,
  reaches,
} from "./subChainGraph";

function sub(id: string, chainId: string): SubChainBlock {
  return { id, type: "subchain", chainId, inputBindings: {} };
}

function chain(
  id: string,
  refs: string[] = [],
  nodeIds: string[] = ["req"],
): Chain {
  return {
    id,
    scope: "collection",
    schemaVersion: 5,
    name: id,
    createdAt: 1,
    blocks: refs.map((r, i) => sub(`${id}-s${i}`, r)),
    nodeIds,
    edges: [],
    nodePositions: {},
  } as Chain;
}

const chains = {
  a: chain("a", ["b"]),
  b: chain("b", ["c"]),
  c: chain("c"),
  loop1: chain("loop1", ["loop2"]),
  loop2: chain("loop2", ["loop1"]),
};

describe("reaches", () => {
  it("is true for the chain itself", () => {
    expect(reaches(chains, "a", "a")).toBe(true);
  });
  it("follows transitive references", () => {
    expect(reaches(chains, "a", "c")).toBe(true);
    expect(reaches(chains, "c", "a")).toBe(false);
  });
  it("terminates on cyclic graphs", () => {
    expect(reaches(chains, "loop1", "a")).toBe(false);
  });
  it("tolerates missing chains", () => {
    expect(reaches(chains, "ghost", "a")).toBe(false);
  });
});

describe("isSubChainReferenceInvalid", () => {
  it("flags an unset reference", () => {
    expect(isSubChainReferenceInvalid(chains, "a", "")).toBe(true);
  });
  it("flags a deleted chain", () => {
    expect(isSubChainReferenceInvalid(chains, "a", "ghost")).toBe(true);
  });
  it("flags a self reference", () => {
    expect(isSubChainReferenceInvalid(chains, "a", "a")).toBe(true);
  });
  it("flags a transitive reference back to the host", () => {
    expect(isSubChainReferenceInvalid(chains, "c", "a")).toBe(true);
  });
  it("accepts a valid downstream reference", () => {
    expect(isSubChainReferenceInvalid(chains, "a", "c")).toBe(false);
  });
  it("flags a child with nothing runnable", () => {
    const empty = chain("empty", [], []);
    expect(
      isSubChainReferenceInvalid({ ...chains, empty }, "a", "empty"),
    ).toBe(true);
  });
});

describe("getInvalidSubChainNodeIds", () => {
  it("returns only the invalid blocks", () => {
    const blocks = [sub("ok", "c"), sub("gone", "ghost"), sub("self", "a")];
    expect(getInvalidSubChainNodeIds(chains, "a", blocks)).toEqual([
      "gone",
      "self",
    ]);
  });
});

describe("getUpstreamAliases", () => {
  const edge = (
    source: string,
    target: string,
    keys: string[],
    branchId?: string,
  ): ChainEdge => ({
    id: `${source}-${target}`,
    sourceRequestId: source,
    targetRequestId: target,
    branchId,
    injections: keys.map((targetKey) => ({ targetKey }) as never),
  });

  it("collects aliases from non-adjacent upstream edges, skipping branch edges", () => {
    const edges = [
      edge("a", "b", ["token"]),
      edge("b", "sub", ["userId"]),
      edge("x", "sub", ["ignored"], "branch-1"),
    ];
    expect(getUpstreamAliases(edges, "sub").sort()).toEqual([
      "token",
      "userId",
    ]);
  });

  it("terminates on cyclic edges", () => {
    const edges = [edge("a", "b", ["k1"]), edge("b", "a", ["k2"])];
    expect(getUpstreamAliases(edges, "b").sort()).toEqual(["k1", "k2"]);
  });
});
