import { describe, expect, it } from "vitest";
import { summarizeCollection } from "./collectionSummary";
import { RELAY_COLLECTION_ITEM_CAP } from "./constants";

type Request = { name: string; method: string; url: string };

const request = (id: string): Request => ({
  name: `Request ${id}`,
  method: "GET",
  url: `https://api.test/r${id}`,
});

describe("summarizeCollection", () => {
  it("returns empty list and zero total for empty input", () => {
    const result = summarizeCollection([]);
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.more).toBeUndefined();
  });

  it("includes all items when count is at the cap", () => {
    const requests = Array.from({ length: 50 }, (_, i) => request(String(i)));
    const result = summarizeCollection(requests);
    expect(result.total).toBe(50);
    expect(result.items).toHaveLength(50);
    expect(result.more).toBeUndefined();
  });

  it("includes cap items and adds 'more' tail for excess", () => {
    const requests = Array.from({ length: 51 }, (_, i) => request(String(i)));
    const result = summarizeCollection(requests);
    expect(result.total).toBe(51);
    expect(result.items).toHaveLength(RELAY_COLLECTION_ITEM_CAP);
    expect(result.more).toBe("…and 1 more — use search");
  });

  it("summarizes a large collection correctly", () => {
    const requests = Array.from({ length: 500 }, (_, i) => request(String(i)));
    const result = summarizeCollection(requests);
    expect(result.total).toBe(500);
    expect(result.items).toHaveLength(50);
    expect(result.more).toBe("…and 450 more — use search");
  });

  it("respects a custom cap", () => {
    const requests = Array.from({ length: 100 }, (_, i) => request(String(i)));
    const result = summarizeCollection(requests, 30);
    expect(result.total).toBe(100);
    expect(result.items).toHaveLength(30);
    expect(result.more).toBe("…and 70 more — use search");
  });

  it("preserves request name, method and url", () => {
    const requests = [
      { name: "Get users", method: "GET", url: "https://api.test/users" },
      { name: "Create order", method: "POST", url: "https://api.test/orders" },
    ];
    const result = summarizeCollection(requests);
    expect(result.items).toEqual(requests);
  });

  it("discards extra fields beyond name, method and url", () => {
    const requests = [
      {
        name: "Get users",
        method: "GET",
        url: "https://api.test/users",
        collectionId: "c1",
        headers: [],
        body: {},
      } as never,
    ];
    const result = summarizeCollection(requests);
    expect(result.items[0]).toEqual({
      name: "Get users",
      method: "GET",
      url: "https://api.test/users",
    });
    expect(result.items[0]).not.toHaveProperty("collectionId");
  });

  it("uses exact em dash and ellipsis characters in the tail", () => {
    const requests = Array.from({ length: 100 }, (_, i) => request(String(i)));
    const result = summarizeCollection(requests);
    expect(result.more).toBe("…and 50 more — use search");
    expect(result.more).toContain("…");
    expect(result.more).toContain("—");
  });

  it("handles single excess item", () => {
    const requests = Array.from({ length: 51 }, (_, i) => request(String(i)));
    const result = summarizeCollection(requests);
    expect(result.more).toBe("…and 1 more — use search");
  });
});
