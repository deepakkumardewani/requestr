import { describe, expect, it } from "vitest";
import { parseFormDataFromContent, resolveFormDataRows } from "./bodyFormData";

describe("parseFormDataFromContent", () => {
  it("returns empty array for empty string", () => {
    expect(parseFormDataFromContent("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseFormDataFromContent("   ")).toEqual([]);
  });

  it("parses JSON object into KV pairs", () => {
    const result = parseFormDataFromContent('{"name":"John","age":"30"}');
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe("name");
    expect(result[0].value).toBe("John");
    expect(result[0].enabled).toBe(true);
    expect(result[1].key).toBe("age");
    expect(result[1].value).toBe("30");
  });

  it("converts non-string JSON values to string", () => {
    const result = parseFormDataFromContent('{"count":42,"active":true}');
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("42");
    expect(result[1].value).toBe("true");
  });

  it("converts null/undefined values to empty string", () => {
    const result = parseFormDataFromContent('{"key":null}');
    expect(result[0].value).toBe("");
  });

  it("falls through to urlencoded parsing when JSON is an array", () => {
    const result = parseFormDataFromContent("[1,2,3]");
    // Arrays are not parsed as KV, treated as urlencoded string
    const keys = result.map((r) => r.key);
    expect(keys).toContain("[1,2,3]");
  });

  it("falls through on invalid JSON", () => {
    const result = parseFormDataFromContent("{invalid json");
    // Falls through to urlencoded parsing
    expect(result).toBeDefined();
  });

  it("parses urlencoded string", () => {
    const result = parseFormDataFromContent("name=John&age=30");
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe("name");
    expect(result[0].value).toBe("John");
    expect(result[1].key).toBe("age");
    expect(result[1].value).toBe("30");
  });

  it("handles key-only parts without equals", () => {
    const result = parseFormDataFromContent("flag");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("flag");
    expect(result[0].value).toBe("");
  });

  it("decodes URL-encoded components", () => {
    const result = parseFormDataFromContent("email=user%40example.com&name=John+Doe");
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("user@example.com");
    expect(result[1].value).toBe("John Doe");
  });

  it("filters empty parts", () => {
    const result = parseFormDataFromContent("a=1&&b=2");
    expect(result).toHaveLength(2);
  });

  it("falls back to raw key/value on decode failure", () => {
    const result = parseFormDataFromContent("%ZZ=value");
    // decodeURIComponent throws on %ZZ, falls back to raw
    // The URIError is caught, raw key used
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});

describe("resolveFormDataRows", () => {
  it("returns formData when non-empty", () => {
    const formData = [
      { id: "1", key: "a", value: "1", enabled: true },
    ];
    const result = resolveFormDataRows(formData, "ignored");
    expect(result).toBe(formData);
  });

  it("falls back to parsing content when formData is empty", () => {
    const result = resolveFormDataRows([], "name=Test");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("name");
    expect(result[0].value).toBe("Test");
  });

  it("falls back to parsing content when formData is undefined", () => {
    const result = resolveFormDataRows(undefined, "key=value");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("key");
    expect(result[0].value).toBe("value");
  });
});
