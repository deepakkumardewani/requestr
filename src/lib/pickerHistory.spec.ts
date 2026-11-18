import { describe, expect, it } from "vitest";
import type { HistoryEntry, HttpMethod } from "@/types";
import {
  dedupeHistory,
  groupHistoryByDay,
  historyItemName,
} from "./pickerHistory";

const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const labels = {
  today: "Today",
  yesterday: "Yesterday",
  formatDate: (ts: number) => `D:${new Date(ts).getDate()}`,
};

const entry = (
  id: string,
  url: string,
  timestamp: number,
  method: HttpMethod = "GET",
) => ({ id, url, timestamp, method }) as HistoryEntry;

describe("historyItemName", () => {
  it("uses the last two path segments", () => {
    expect(historyItemName("https://api.test/v1/users/42")).toBe("users/42");
    expect(historyItemName("https://api.test/users")).toBe("users");
  });

  it("falls back to the host, then to the raw url", () => {
    expect(historyItemName("https://api.test/")).toBe("api.test");
    expect(historyItemName("{{base}}/x")).toBe("{{base}}/x");
  });
});

describe("dedupeHistory", () => {
  it("keeps the latest entry per method + URL, newest first", () => {
    const result = dedupeHistory([
      entry("old", "https://a.test/x", 1),
      entry("new", "https://a.test/x", 3),
      entry("post", "https://a.test/x", 2, "POST"),
    ]);
    expect(result.map((e) => e.id)).toEqual(["new", "post"]);
  });

  it("returns [] for no entries", () => {
    expect(dedupeHistory([])).toEqual([]);
  });
});

describe("groupHistoryByDay", () => {
  it("returns no rows for zero entries", () => {
    expect(groupHistoryByDay([], { labels, now: NOW })).toEqual([]);
  });

  it("groups under Today / Yesterday / date headers with counts", () => {
    const rows = groupHistoryByDay(
      [
        entry("a", "https://a.test/a", NOW - HOUR),
        entry("b", "https://a.test/b", NOW - 2 * HOUR),
        entry("c", "https://a.test/c", NOW - DAY),
        entry("d", "https://a.test/d", NOW - 5 * DAY),
      ],
      { labels, now: NOW },
    );
    const headers = rows.flatMap((r) =>
      r.kind === "header" ? [[r.label, r.count.visible]] : [],
    );
    expect(headers).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["D:10", 1],
    ]);
    expect(rows.map((r) => r.id)).toEqual([
      "day:Today",
      "a",
      "b",
      "day:Yesterday",
      "c",
      "day:D:10",
      "d",
    ]);
  });

  it("names rows from the URL and uses the entry id as the row id", () => {
    const [, row] = groupHistoryByDay(
      [entry("h1", "https://a.test/v1/users/42", NOW)],
      { labels, now: NOW },
    );
    expect(row).toMatchObject({
      kind: "item",
      id: "h1",
      item: { name: "users/42", method: "GET" },
    });
  });

  it("dedupes before grouping", () => {
    const rows = groupHistoryByDay(
      [entry("1", "https://a.test/x", NOW), entry("2", "https://a.test/x", NOW - HOUR)],
      { labels, now: NOW },
    );
    expect(rows.filter((r) => r.kind === "item")).toHaveLength(1);
  });

  it("applies the search filter and drops empty days", () => {
    const rows = groupHistoryByDay(
      [entry("a", "https://a.test/orders", NOW), entry("b", "https://a.test/users", NOW - DAY)],
      { labels, now: NOW, filter: "users" },
    );
    expect(rows.map((r) => r.id)).toEqual(["day:Yesterday", "b"]);
  });

  it("applies the method predicate", () => {
    const rows = groupHistoryByDay(
      [entry("a", "https://a.test/a", NOW, "POST"), entry("b", "https://a.test/b", NOW)],
      { labels, now: NOW, matchesMethod: (m) => m === "POST" },
    );
    expect(rows.map((r) => r.id)).toEqual(["day:Today", "a"]);
  });
});
