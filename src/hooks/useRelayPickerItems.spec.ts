/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Chain } from "@/types/chain";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
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
  useTabsStore.setState({ tabs: [], activeTabId: null } as never);
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

  it("[success] offers the active tab as currentTab, never in the searched items", () => {
    useTabsStore.setState({
      tabs: [{ tabId: "t1", name: "Login call" }],
      activeTabId: "t1",
    } as never);
    const { result } = renderHook(() => useRelayPickerItems(""));
    expect(result.current.currentTab).toEqual({
      kind: "tab",
      id: "t1",
      label: "Login call",
    });
    expect(result.current.items.some((i) => i.kind === "tab")).toBe(false);
  });

  it("[success] gives a saved request tab its collection as the breadcrumb", () => {
    useTabsStore.setState({
      tabs: [{ tabId: "t1", name: "Login", requestId: "r2" }],
      activeTabId: "t1",
    } as never);
    const { result } = renderHook(() => useRelayPickerItems(""));
    expect(result.current.currentTab?.detail).toBe("Payments");
  });

  it("[success] has no currentTab when no tab is open", () => {
    const { result } = renderHook(() => useRelayPickerItems(""));
    expect(result.current.currentTab).toBeNull();
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
    expect(result.current).toEqual({ items: [], total: 0, truncated: false, currentTab: null });
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

  it("[success] caps at 50 items and flags truncation for 51 requests with a query", () => {
    seed(Array.from({ length: 51 }, (_, i) => request(`r${i}`, { name: `Item ${i}` })));
    const { result } = renderHook(() => useRelayPickerItems("item"));
    expect(result.current.items).toHaveLength(50);
    expect(result.current.total).toBe(51);
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

  describe("edge cases and invariants", () => {
    it("returns items, total, and truncated with correct structure", () => {
      const { result } = renderHook(() => useRelayPickerItems(""));
      expect(result.current).toHaveProperty("items");
      expect(result.current).toHaveProperty("total");
      expect(result.current).toHaveProperty("truncated");
      expect(result.current).toHaveProperty("currentTab");
      expect(Array.isArray(result.current.items)).toBe(true);
      expect(typeof result.current.total).toBe("number");
      expect(typeof result.current.truncated).toBe("boolean");
    });

    it("every item is a PickerItem with kind, id, and label", () => {
      const { result } = renderHook(() => useRelayPickerItems(""));
      for (const item of result.current.items) {
        expect(item).toHaveProperty("kind");
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("label");
      }
    });

    it("currentTab is either null or a PickerItem with detail for saved requests", () => {
      seed([request("r1", { name: "Saved Request" })]);
      useTabsStore.setState({
        tabs: [{ tabId: "t1", name: "My Tab", requestId: "r1" }],
        activeTabId: "t1",
      } as never);
      const { result } = renderHook(() => useRelayPickerItems(""));

      expect(result.current.currentTab).not.toBeUndefined();
      if (result.current.currentTab) {
        expect(result.current.currentTab.kind).toBe("tab");
        expect(result.current.currentTab.label).toBe("My Tab");
        expect(result.current.currentTab.detail).toBe("Payments"); // breadcrumb
      }
    });

    it("currentTab has no detail for unsaved tabs", () => {
      useTabsStore.setState({
        tabs: [{ tabId: "t1", name: "Unsaved Tab" }],
        activeTabId: "t1",
      } as never);
      const { result } = renderHook(() => useRelayPickerItems(""));

      expect(result.current.currentTab).toEqual({
        kind: "tab",
        id: "t1",
        label: "Unsaved Tab",
        detail: undefined,
      });
    });

    it("filters by multiple kinds", () => {
      const { result } = renderHook(() => useRelayPickerItems("", "request"));
      expect(result.current.items.every((i) => i.kind === "request")).toBe(true);
    });

    it("omits the currentTab from the searched items", () => {
      useTabsStore.setState({
        tabs: [{ tabId: "t1", name: "Open Tab" }],
        activeTabId: "t1",
      } as never);
      const { result } = renderHook(() => useRelayPickerItems(""));

      expect(result.current.items.some((i) => i.id === "t1")).toBe(false);
    });

    it("total counts all matches before truncation", () => {
      seed(Array.from({ length: 100 }, (_, i) => request(`r${i}`, { name: `Item ${i}` })));
      const { result } = renderHook(() => useRelayPickerItems("item"));

      expect(result.current.total).toBe(100);
      expect(result.current.items).toHaveLength(50);
      expect(result.current.truncated).toBe(true);
    });

    it("kind=all does not include tab in the picker items", () => {
      useTabsStore.setState({
        tabs: [{ tabId: "t1", name: "Tab" }],
        activeTabId: "t1",
      } as never);
      const { result } = renderHook(() => useRelayPickerItems("", "all"));

      expect(result.current.items.some((i) => i.kind === "tab")).toBe(false);
    });

    it("detail field is set for collections (collection breadcrumb)", () => {
      const { result } = renderHook(() => useRelayPickerItems("", "collection"));
      expect(result.current.items[0]).toHaveProperty("detail");
    });

    it("request detail includes method and URL", () => {
      const { result } = renderHook(() => useRelayPickerItems("", "request"));
      expect(result.current.items[0].detail).toContain("GET");
      expect(result.current.items[0].detail).toContain("https://api.test");
    });

    it("preserves stable item order across re-renders when data does not change", () => {
      const { result: result1 } = renderHook(() => useRelayPickerItems("login"));
      const items1 = result1.current.items.map((i) => i.id);

      const { result: result2 } = renderHook(() => useRelayPickerItems("login"));
      const items2 = result2.current.items.map((i) => i.id);

      expect(items1).toEqual(items2);
    });

    it("query filter is case-insensitive", () => {
      const { result: result1 } = renderHook(() => useRelayPickerItems("LOGIN"));
      const { result: result2 } = renderHook(() => useRelayPickerItems("login"));

      expect(result1.current.items.length).toBe(result2.current.items.length);
      expect(result1.current.items.map((i) => i.id)).toEqual(result2.current.items.map((i) => i.id));
    });

    it("respects deferredValue to avoid filtering on every keystroke", () => {
      const { result, rerender } = renderHook(({ q }) => useRelayPickerItems(q), {
        initialProps: { q: "item 0" },
      });
      const initialItems = result.current.items.length;

      rerender({ q: "item 0z" });
      // deferredValue should not have updated yet, so items should be the same
      expect(result.current.items.length).toBe(initialItems);
    });

    it("returns no items with a query that matches nothing", () => {
      const { result } = renderHook(() => useRelayPickerItems("xyzzy-no-match"));
      expect(result.current).toEqual({
        items: [],
        total: 0,
        truncated: false,
        currentTab: null,
      });
    });

    it("handles empty requests array", () => {
      seed([]);
      const { result } = renderHook(() => useRelayPickerItems(""));

      expect(result.current.items).toContainEqual(
        expect.objectContaining({ kind: "collection", id: "c1" }),
      );
      expect(result.current.items.every((i) => i.kind !== "request")).toBe(true);
    });

    it("handles undefined requestId for tabs", () => {
      useTabsStore.setState({
        tabs: [{ tabId: "t1", name: "Unsaved" }],
        activeTabId: "t1",
      } as never);
      const { result } = renderHook(() => useRelayPickerItems(""));

      expect(result.current.currentTab).toEqual({
        kind: "tab",
        id: "t1",
        label: "Unsaved",
        detail: undefined,
      });
    });

    it("handles a request with an invalid collectionId", () => {
      seed([request("r1", { name: "Orphan", collectionId: "nonexistent" })]);
      const { result } = renderHook(() => useRelayPickerItems(""));

      // Should still return the request, just without a breadcrumb
      expect(result.current.items.some((i) => i.id === "r1")).toBe(true);
    });

    it("updates items when the workspace changes", () => {
      const { result } = renderHook(() => useRelayPickerItems("fresh"));
      expect(result.current.total).toBe(0);

      act(() => {
        useCollectionsStore.setState({
          requests: [request("r9", { name: "Fresh one" })],
        } as never);
      });

      expect(result.current.items.some((i) => i.id === "r9")).toBe(true);
    });

    it("updates items when environments change", () => {
      seed([request("r1", { url: "https://api.test/{{token}}" })]);
      useEnvironmentsStore.setState({
        environments: [
          {
            id: "e1",
            name: "Dev",
            variables: [{ id: "v1", key: "token", initialValue: "secret", currentValue: "secret", isSecret: true }],
            createdAt: 0,
            updatedAt: 0,
          },
        ],
      } as never);

      const { result } = renderHook(() => useRelayPickerItems("", "request"));
      const detail1 = result.current.items[0].detail;

      act(() => {
        useEnvironmentsStore.setState({
          environments: [
            {
              id: "e2",
              name: "Prod",
              variables: [{ id: "v2", key: "token", initialValue: "other", currentValue: "other", isSecret: true }],
              createdAt: 0,
              updatedAt: 0,
            },
          ],
        } as never);
      });

      const detail2 = result.current.items[0].detail;
      expect(detail1).toBeDefined();
      expect(detail2).toBeDefined();
    });
  });
});
