import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFinalUrl,
  buildUrlWithParams,
  cn,
  formatBytes,
  formatDuration,
  generateId,
  getRelativeTime,
  interpolateVariables,
  parsePathParams,
  parseQueryString,
  syncParamsFromUrl,
  truncateUrl,
} from "./utils";

describe("cn", () => {
  it("merges class tokens", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});

describe("formatBytes", () => {
  it("formats zero and scales units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toMatch(/^1(\.0)? KB$/);
    expect(formatBytes(1024 * 1024)).toContain("MB");
  });
});

describe("formatDuration", () => {
  it("uses ms under one second and seconds above", () => {
    expect(formatDuration(500)).toBe("500 ms");
    expect(formatDuration(1500)).toBe("1.50 s");
  });
});

describe("generateId", () => {
  it("returns a UUID-shaped string", () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

describe("interpolateVariables", () => {
  it("replaces known keys", () => {
    expect(interpolateVariables("{{a}}", { a: "x" })).toBe("x");
  });
});

describe("parsePathParams", () => {
  it("extracts :param tokens from path before query", () => {
    expect(parsePathParams("https://h/:id/:id2?x=1")).toEqual(["id", "id2"]);
    expect(parsePathParams("noop")).toEqual([]);
  });
});

describe("parseQueryString", () => {
  it("parses full URL or relative path with placeholder origin", () => {
    expect(parseQueryString("https://a.test?q=1&x=y")).toEqual([
      { key: "q", value: "1" },
      { key: "x", value: "y" },
    ]);
    expect(parseQueryString("relative?q=1")).toEqual([
      { key: "q", value: "1" },
    ]);
  });

  it("returns [] on invalid URL input", () => {
    expect(parseQueryString("http://[")).toEqual([]);
  });
});

describe("parseQueryString edge cases", () => {
  it("keeps duplicate keys as separate entries in URL order", () => {
    expect(parseQueryString("https://a.test?a=1&a=2")).toEqual([
      { key: "a", value: "1" },
      { key: "a", value: "2" },
    ]);
  });

  it("yields an empty string value for `a=` and for a bare `a`", () => {
    expect(parseQueryString("https://a.test?a=&b")).toEqual([
      { key: "a", value: "" },
      { key: "b", value: "" },
    ]);
  });

  it("decodes both + and %20 to a space", () => {
    expect(parseQueryString("https://a.test?a=x+y&b=x%20y")).toEqual([
      { key: "a", value: "x y" },
      { key: "b", value: "x y" },
    ]);
  });

  it("excludes the fragment from the last value", () => {
    expect(parseQueryString("https://a.test?a=1#frag")).toEqual([
      { key: "a", value: "1" },
    ]);
  });

  it("parses a leading-slash relative path", () => {
    expect(parseQueryString("/users?q=1")).toEqual([{ key: "q", value: "1" }]);
  });

  it("returns [] when the URL has no query string", () => {
    expect(parseQueryString("https://a.test/path")).toEqual([]);
  });

  it("keeps malformed percent sequences raw instead of throwing", () => {
    expect(parseQueryString("https://a.test?a=%zz&b=100%")).toEqual([
      { key: "a", value: "%zz" },
      { key: "b", value: "100%" },
    ]);
  });

  it("characterizes: invalid UTF-8 percent bytes decode to the replacement character", () => {
    expect(parseQueryString("https://a.test?a=%E0%A4%A")).toEqual([
      { key: "a", value: "\uFFFD%A" },
    ]);
  });
});

describe("buildFinalUrl", () => {
  it("encodes path params and appends query string", () => {
    expect(
      buildFinalUrl("https://x/:id", [
        { key: "id", value: "a/b", enabled: true, type: "path" },
        { key: "q", value: "1", enabled: true, type: "query" },
      ]),
    ).toBe("https://x/a%2Fb?q=1");
  });
});

describe("buildFinalUrl edge cases", () => {
  const q = (key: string, value: string, enabled = true) => ({
    key,
    value,
    enabled,
    type: "query" as const,
  });
  const path = (key: string, value: string, enabled = true) => ({
    key,
    value,
    enabled,
    type: "path" as const,
  });

  it("appends table query rows after a duplicate key already in the URL", () => {
    expect(buildFinalUrl("https://x/p?a=1", [q("a", "2")])).toBe(
      "https://x/p?a=1&a=2",
    );
  });

  it("does not duplicate a URL query pair that is mirrored by an enabled row", () => {
    expect(buildFinalUrl("https://x/p?limit=1", [q("limit", "1")])).toBe(
      "https://x/p?limit=1",
    );
  });

  it("dedupes a mirrored pair once while keeping a repeated URL-only pair", () => {
    expect(
      buildFinalUrl("https://x/p?a=1&a=1&b=2", [q("a", "1"), q("b", "2")]),
    ).toBe("https://x/p?a=1&a=1&b=2");
  });

  it("encodes a space in a path value as %20", () => {
    expect(buildFinalUrl("https://x/:name", [path("name", "a b")])).toBe(
      "https://x/a%20b",
    );
  });

  it("characterizes: only the first occurrence of a repeated :param is replaced", () => {
    expect(buildFinalUrl("https://x/:id/:id", [path("id", "7")])).toBe(
      "https://x/7/:id",
    );
  });

  it("characterizes: a shorter param key also matches the prefix of a longer token", () => {
    expect(buildFinalUrl("https://x/:idx/:id", [path("id", "1")])).toBe(
      "https://x/1x/:id",
    );
  });

  it("characterizes: {{var}} in a value is percent-encoded, not left for interpolation", () => {
    expect(
      buildFinalUrl("https://x/:id", [
        path("id", "{{userId}}"),
        q("token", "{{token}}"),
      ]),
    ).toBe("https://x/%7B%7BuserId%7D%7D?token=%7B%7Btoken%7D%7D");
  });

  it("ignores disabled rows and rows with an empty key", () => {
    expect(
      buildFinalUrl("https://x/:id", [
        path("id", "9", false),
        q("off", "1", false),
        q("", "nokey"),
      ]),
    ).toBe("https://x/:id");
  });

  it("does not treat a :8080 port as a path param", () => {
    expect(
      buildFinalUrl("http://localhost:8080/:id", [path("id", "5")]),
    ).toBe("http://localhost:8080/5");
  });

  it("treats rows without a type as query params", () => {
    expect(
      buildFinalUrl("https://x", [{ key: "a", value: "b c", enabled: true }]),
    ).toBe("https://x?a=b%20c");
  });

  it("characterizes: table query params land after a fragment already in the URL", () => {
    expect(buildFinalUrl("https://x/p?a=1#f", [q("b", "2")])).toBe(
      "https://x/p?a=1#f&b=2",
    );
  });
});

describe("buildUrlWithParams", () => {
  it("returns base without query when no enabled params", () => {
    expect(buildUrlWithParams("https://a.test/old?q=1", [])).toBe(
      "https://a.test/old",
    );
  });

  it("returns original base when encodeURIComponent throws", () => {
    const spy = vi
      .spyOn(globalThis, "encodeURIComponent")
      .mockImplementationOnce(() => {
        throw new Error("fail");
      });
    const out = buildUrlWithParams("https://a.test", [
      { key: "k", value: "v", enabled: true },
    ]);
    spy.mockRestore();
    expect(out).toBe("https://a.test");
  });
});

describe("buildUrlWithParams edge cases", () => {
  it("replaces the existing query with the enabled rows, preserving duplicate keys", () => {
    expect(
      buildUrlWithParams("https://a.test/p?old=1", [
        { key: "a", value: "1", enabled: true },
        { key: "a", value: "2", enabled: true },
      ]),
    ).toBe("https://a.test/p?a=1&a=2");
  });

  it("emits `key=` for an empty value", () => {
    expect(
      buildUrlWithParams("https://a.test", [
        { key: "a", value: "", enabled: true },
      ]),
    ).toBe("https://a.test?a=");
  });

  it("encodes a space as %20 and not +", () => {
    expect(
      buildUrlWithParams("https://a.test", [
        { key: "a b", value: "c d", enabled: true },
      ]),
    ).toBe("https://a.test?a%20b=c%20d");
  });

  it("skips disabled rows and rows with an empty key", () => {
    expect(
      buildUrlWithParams("https://a.test", [
        { key: "off", value: "1", enabled: false },
        { key: "", value: "x", enabled: true },
        { key: "on", value: "2", enabled: true },
      ]),
    ).toBe("https://a.test?on=2");
  });

  it("characterizes: a fragment on the base URL is dropped entirely when rows exist", () => {
    expect(
      buildUrlWithParams("https://a.test/p?x=1#frag", [
        { key: "a", value: "1", enabled: true },
      ]),
    ).toBe("https://a.test/p?a=1");
  });
});

describe("syncParamsFromUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives path params from URL and merges query from URL when present", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("fixed-uuid");
    const existing = [{ id: "keep", key: "oldQ", value: "z", enabled: true }];
    const { pathParams, queryParams } = syncParamsFromUrl(
      "https://h/users/:userId/details?oldQ=new&other=1",
      existing,
    );
    expect(pathParams.map((p) => p.key)).toEqual(["userId"]);
    expect(queryParams.map((p) => [p.key, p.value])).toEqual([
      ["oldQ", "new"],
      ["other", "1"],
    ]);
  });

  it("preserves existing query param rows when URL has no query", () => {
    const existing = [{ id: "e1", key: "a", value: "1", enabled: true }];
    const { queryParams } = syncParamsFromUrl("https://h/test", existing);
    expect(queryParams).toEqual(existing);
  });
});

describe("syncParamsFromUrl edge cases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps id and enabled flag of an existing row whose key is still in the URL", () => {
    const existing = [{ id: "r1", key: "a", value: "old", enabled: false }];
    const { queryParams } = syncParamsFromUrl("https://h?a=new", existing);
    expect(queryParams).toEqual([
      { id: "r1", key: "a", value: "new", enabled: false },
    ]);
  });

  it("creates enabled rows with generated ids for keys not in the table", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("gen-id");
    const { queryParams } = syncParamsFromUrl("https://h?z=9", []);
    expect(queryParams).toEqual([
      { id: "gen-id", key: "z", value: "9", enabled: true },
    ]);
  });

  it("drops table rows whose keys are no longer in the URL query", () => {
    const existing = [{ id: "r1", key: "gone", value: "1", enabled: true }];
    const { queryParams } = syncParamsFromUrl("https://h?kept=1", existing);
    expect(queryParams.map((p) => p.key)).toEqual(["kept"]);
  });

  it("characterizes: duplicate URL keys both reuse the same existing row id", () => {
    const existing = [{ id: "r1", key: "a", value: "0", enabled: true }];
    const { queryParams } = syncParamsFromUrl("https://h?a=1&a=2", existing);
    expect(queryParams.map((p) => [p.id, p.value])).toEqual([
      ["r1", "1"],
      ["r1", "2"],
    ]);
  });

  it("keeps empty-valued keys as rows with empty value", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("gen-id");
    const { queryParams } = syncParamsFromUrl("https://h?a=&b", []);
    expect(queryParams.map((p) => [p.key, p.value])).toEqual([
      ["a", ""],
      ["b", ""],
    ]);
  });

  it("decodes + and %20 as spaces and ignores the fragment", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("gen-id");
    const { queryParams } = syncParamsFromUrl("https://h?a=x+y&b=x%20y#f", []);
    expect(queryParams.map((p) => p.value)).toEqual(["x y", "x y"]);
  });

  it("derives query rows from a relative URL", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("gen-id");
    const { queryParams } = syncParamsFromUrl("/users/:id?q=1", []);
    expect(queryParams.map((p) => [p.key, p.value])).toEqual([["q", "1"]]);
  });

  it("preserves the value of an existing path param and blanks new ones", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("gen-id");
    const existing = [
      { id: "p1", key: "id", value: "42", enabled: true, type: "path" as const },
    ];
    const { pathParams } = syncParamsFromUrl("https://h/:id/:slug", existing);
    expect(pathParams).toEqual([
      existing[0],
      { id: "gen-id", key: "slug", value: "", enabled: true, type: "path" },
    ]);
  });

  it("does not derive a path param from a :8080 port", () => {
    const { pathParams } = syncParamsFromUrl("http://localhost:8080/x", []);
    expect(pathParams).toEqual([]);
  });

  it("keeps a malformed percent sequence raw as the row value", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("gen-id");
    const { queryParams } = syncParamsFromUrl("https://h?a=%zz", []);
    expect(queryParams.map((p) => [p.key, p.value])).toEqual([["a", "%zz"]]);
  });
});

describe("truncateUrl", () => {
  it("returns original when short enough", () => {
    expect(truncateUrl("abc", 10)).toBe("abc");
    expect(truncateUrl("abcdefghijklmnop", 10).endsWith("…")).toBe(true);
  });
});

describe("getRelativeTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("buckets elapsed time into human phrases", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    expect(getRelativeTime(now - 30_000)).toBe("just now");
    expect(getRelativeTime(now - 120_000)).toBe("2m ago");
    expect(getRelativeTime(now - 3_600_000)).toBe("1h ago");
    expect(getRelativeTime(now - 48 * 3_600_000)).toBe("2d ago");
  });
});
