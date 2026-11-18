/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import type { Chain } from "@/types/chain";
import type { RequestModel } from "@/types";
import { useChainRequests } from "./useChainRequests";

function makeRequest(id: string): RequestModel {
  return {
    id,
    collectionId: "col-1",
    name: id,
    method: "GET",
    url: `https://example.com/${id}`,
    params: [],
    headers: [],
    auth: { type: "none" } as RequestModel["auth"],
    body: { type: "none" } as RequestModel["body"],
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
  };
}

function makeChain(nodeIds: string[]): Chain {
  return {
    id: "chain-1",
    scope: "standalone",
    schemaVersion: 5,
    name: "Test",
    blocks: [],
    nodeIds,
    edges: [],
    nodePositions: {},
  };
}

describe("useChainRequests", () => {
  beforeEach(() => {
    useCollectionsStore.setState({
      requests: [makeRequest("req-1"), makeRequest("req-2")],
    } as never);
  });

  it("resolves nodeIds to their collection requests", () => {
    const chain = makeChain(["req-1", "req-2"]);
    const { result } = renderHook(() => useChainRequests(chain));

    expect(Object.keys(result.current.requests)).toEqual(["req-1", "req-2"]);
    expect(result.current.missingIds).toEqual([]);
  });

  it("names ids with no matching request as missing, rather than throwing", () => {
    const chain = makeChain(["req-1", "deleted-req"]);
    const { result } = renderHook(() => useChainRequests(chain));

    expect(Object.keys(result.current.requests)).toEqual(["req-1"]);
    expect(result.current.missingIds).toEqual(["deleted-req"]);
  });

  it("returns empty results for an empty or undefined chain", () => {
    const { result: emptyChainResult } = renderHook(() =>
      useChainRequests(makeChain([])),
    );
    expect(emptyChainResult.current.requests).toEqual({});
    expect(emptyChainResult.current.missingIds).toEqual([]);

    const { result: undefinedResult } = renderHook(() =>
      useChainRequests(undefined),
    );
    expect(undefinedResult.current.requests).toEqual({});
    expect(undefinedResult.current.missingIds).toEqual([]);
  });

  it("returns a stable requests map across an unrelated rerender", () => {
    const chain = makeChain(["req-1"]);
    const { result, rerender } = renderHook(
      ({ c }: { c: Chain }) => useChainRequests(c),
      { initialProps: { c: chain } },
    );
    const first = result.current.requests;
    rerender({ c: chain });
    expect(result.current.requests).toBe(first);
  });
});
