import { describe, expect, it } from "vitest";
import {
  EMPTY_MATCH,
  looksLikeCurl,
  looksLikeUrl,
  matchText,
  scoreItem,
  searchItems,
  tokenize,
  type SearchableItem,
} from "@/lib/pickerSearch";

const BENCH_ITEM_COUNT = 500;
/** Generous CI bound; local runs are well under 1ms. */
const BENCH_BUDGET_MS = 5;
const BENCH_RUNS = 5;

describe("tokenize", () => {
  it("splits on whitespace, lowercases and drops empties", () => {
    expect(tokenize("  Get   Users ")).toEqual(["get", "users"]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("matchText", () => {
  it("classifies exact, prefix, substring and subsequence", () => {
    expect(matchText("users", "Users")?.tier).toBe("exact");
    expect(matchText("us", "Users")?.tier).toBe("prefix");
    expect(matchText("ser", "Users")?.tier).toBe("substring");
    expect(matchText("urs", "Users")?.tier).toBe("subsequence");
    expect(matchText("zzz", "Users")).toBeNull();
  });

  it("returns highlight ranges and merges adjacent subsequence hits", () => {
    expect(matchText("ser", "Users")?.ranges).toEqual([[1, 4]]);
    expect(matchText("uers", "Users")?.ranges).toEqual([
      [0, 1],
      [2, 5],
    ]);
  });
});

describe("scoreItem", () => {
  const item: SearchableItem = { name: "List orders", method: "GET", url: "https://api.x.io/orders", groupName: "Shop" };

  it("returns the empty match for a blank query", () => {
    expect(scoreItem("  ", item)).toBe(EMPTY_MATCH);
  });

  it("requires every token to match (AND)", () => {
    expect(scoreItem("list orders", item)).not.toBeNull();
    expect(scoreItem("list nope", item)).toBeNull();
  });

  it("matches method, url and group fields, skipping missing ones", () => {
    expect(scoreItem("get", item)).not.toBeNull();
    expect(scoreItem("shop", item)).not.toBeNull();
    expect(scoreItem("api.x.io", { name: "n", url: item.url })?.urlRanges).toEqual([[8, 16]]);
    expect(scoreItem("get", { name: "plain" })).toBeNull();
  });

  it("highlights name ranges only for name hits and merges overlaps", () => {
    const match = scoreItem("ord ders", item);
    expect(match?.nameRanges).toEqual([[5, 11]]);
    expect(match?.urlRanges).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(scoreItem("LIST", item)?.nameRanges).toEqual([[0, 4]]);
  });

  it("prefers name over url over group for the same tier", () => {
    const byName = scoreItem("abc", { name: "abc", url: "abc", groupName: "abc" });
    const byUrl = scoreItem("abc", { name: "x", url: "abc", groupName: "abc" });
    const byGroup = scoreItem("abc", { name: "x", groupName: "abc" });
    expect(byName!.score).toBeGreaterThan(byUrl!.score);
    expect(byUrl!.score).toBeGreaterThan(byGroup!.score);
  });
});

describe("searchItems", () => {
  const items: SearchableItem[] = [
    { name: "xx user yy" },
    { name: "u_s_e_r" },
    { name: "user" },
    { name: "user profile" },
    { name: "unrelated" },
  ];

  it("ranks exact > prefix > substring > subsequence and drops non-matches", () => {
    const names = searchItems("user", items).map((r) => r.item.name);
    expect(names).toEqual(["user", "user profile", "xx user yy", "u_s_e_r"]);
  });

  it("returns all items in input order for an empty query", () => {
    expect(searchItems("", items).map((r) => r.item)).toEqual(items);
  });

  it("scores 500 items within the benchmark budget", () => {
    const many = Array.from({ length: BENCH_ITEM_COUNT }, (_, i) => ({
      name: `Request ${i}`,
      method: "GET" as const,
      url: `https://api.example.com/v1/resource/${i}`,
      groupName: "Collection",
    }));
    // Best of several runs after a warm-up: a single cold run is dominated by JIT and worker load.
    searchItems("res 4", many);
    const timings = Array.from({ length: BENCH_RUNS }, () => {
      const start = performance.now();
      searchItems("res 4", many);
      return performance.now() - start;
    });
    expect(Math.min(...timings)).toBeLessThan(BENCH_BUDGET_MS);
  });
});

describe("looksLikeCurl / looksLikeUrl", () => {
  it("detects curl case-insensitively with leading whitespace", () => {
    expect(looksLikeCurl("curl https://x.io")).toBe(true);
    expect(looksLikeCurl("  CURL -X POST")).toBe(true);
    expect(looksLikeCurl("curl")).toBe(true);
    expect(looksLikeCurl("curly")).toBe(false);
    expect(looksLikeCurl("get curl")).toBe(false);
  });

  it("detects http(s) URLs", () => {
    expect(looksLikeUrl("https://x.io/a")).toBe(true);
    expect(looksLikeUrl("  HTTP://x.io")).toBe(true);
    expect(looksLikeUrl("x.io/a")).toBe(false);
    expect(looksLikeUrl("https://")).toBe(false);
  });
});
