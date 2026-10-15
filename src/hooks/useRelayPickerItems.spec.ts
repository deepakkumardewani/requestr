/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Chain } from "@/types/chain";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useRelayPickerItems } from "./useRelayPickerItems";

const SECRET_QUERY_VALUE = "abcdefghijklmnopqrstuvwx";

const request = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  collectionId: "c1",
  name: `Request ${id}`,
  method: "GET" as const,
  url: `https://api.test/${id}`,
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const chain = {
  id: "ch1",
  scope: "global",
  schemaVersion: 1,
  name: "Checkout chain",
  blocks: [],
  nodeIds: [],
  edges: [],
  nodePositions: {},
} as unknown as Chain;

const seed = (requests: unknown[] = [request("r1"), request("r2", { name: "Login" })]) => {
  useCollectionsStore.setState({
    collections: [{ id: "c1", name: "Payments", createdAt: 0, updatedAt: 0 }],
    requests,
  } as never);
  useEnvironmentsStore.setState({
    environments: [{ id: "e1", name: "Production", variables: [], createdAt: 0, updatedAt: 0 }],
  } as never);
  useChainStore.setState({ chains: { ch1: chain } } as never);
  useRelayStore.setState({ shareValues: false });
};

beforeEach(() => {
  seed();
});

describe("useRelayPickerItems", () => {
  it("[success] lists every kind for a blank query", () => {
    const { result } = renderHook(() => useRelayPickerItems(""));
    expect(result.current.items.map((i) => `${i.kind}:${i.id}`)).toEqual([
      "request:r1",
      "request:r2",
      "collection:c1",
      "environment:e1",
      "chain:ch1",
    ]);
    expect(result.current.total).toBe(5);
    expect(result.current.truncated).toBe(false);
  });

  it("[success] maps hits to chips with a label, and details only on requests", () => {
    const { result } = renderHook(() => useRelayPickerItems(""));
    expect(result.current.items[1]).toEqual({
      kind: "request",
      id: "r2",
      label: "Login",
      detail: "GET https://api.test/r2",
    });
    expect(result.current.items[2]).toEqual({ kind: "collection", id: "c1", label: "Payments", detail: undefined });
  });

  it("[success] filters by kind", () => {
    const { result } = renderHook(() => useRelayPickerItems("", "environment"));
    expect(result.current.items).toEqual([{ kind: "environment", id: "e1", label: "Production", detail: undefined }]);
  });

  it("[success] filters by query, case-insensitively", () => {
    const { result } = renderHook(() => useRelayPickerItems("LOGIN"));
    expect(result.current.items.map((i) => i.id)).toEqual(["r2"]);
    expect(result.current.total).toBe(1);
  });

  it("[success] returns nothing when no item matches", () => {
    const { result } = renderHook(() => useRelayPickerItems("zzz-none"));
    expect(result.current).toEqual({ items: [], total: 0, truncated: false });
  });

  it("[success] re-filters when the query prop changes", () => {
    const { result, rerender } = renderHook(({ q }) => useRelayPickerItems(q), { initialProps: { q: "" } });
    expect(result.current.total).toBe(5);
    rerender({ q: "checkout" });
    expect(result.current.items.map((i) => i.id)).toEqual(["ch1"]);
  });

  it("[success] caps at 50 items and flags truncation for 5,000 requests", () => {
    seed(Array.from({ length: 5000 }, (_, i) => request(`b${i}`, { name: `Item ${i}` })));
    const { result } = renderHook(() => useRelayPickerItems("item"));
    expect(result.current.items).toHaveLength(50);
    expect(result.current.total).toBe(5000);
    expect(result.current.truncated).toBe(true);
  });

  it("[success] filters a 5,000 item workspace well under the typing budget", () => {
    seed(Array.from({ length: 5000 }, (_, i) => request(`b${i}`, { name: `Item ${i}` })));
    const started = performance.now();
    const { result } = renderHook(() => useRelayPickerItems("item 49"));
    const elapsed = performance.now() - started;
    expect(result.current.total).toBe(111);
    expect(elapsed).toBeLessThan(1000);
  });

  it("[success] picks up store changes", () => {
    const { result } = renderHook(() => useRelayPickerItems("fresh"));
    expect(result.current.total).toBe(0);
    act(() => {
      useCollectionsStore.setState({ requests: [request("r9", { name: "Fresh one" })] } as never);
    });
    expect(result.current.items.map((i) => i.id)).toEqual(["r9"]);
  });

  it("[success] redacts secret url values unless values are shared", () => {
    const url = `https://api.test/x?api_key=${SECRET_QUERY_VALUE}`;
    seed([request("r1", { url })]);
    const { result } = renderHook(() => useRelayPickerItems("", "request"));
    expect(result.current.items[0].detail).not.toContain(SECRET_QUERY_VALUE);
  });

  it("[success] scrubs a secret environment value out of a request url", () => {
    const secret = "s3cr3t-value-0123456789";
    seed([request("r1", { url: `https://api.test/${secret}/x` })]);
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e1",
          name: "Production",
          variables: [
            { id: "v1", key: "token", initialValue: secret, currentValue: secret, isSecret: true },
          ],
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    } as never);
    const { result } = renderHook(() => useRelayPickerItems("", "request"));
    expect(result.current.items[0].detail).not.toContain(secret);
  });
});
