import { describe, expect, it } from "vitest";
import {
  firstJsonPathMatch,
  queryJsonPath,
  isPlainRecord,
  parseJsonObject,
  prettyPrintJson,
  tryParseJson,
} from "./chainJson";

describe("tryParseJson", () => {
  it("returns the parsed value for valid JSON", () => {
    expect(tryParseJson('{"a":1}', "fallback")).toEqual({ a: 1 });
    expect(tryParseJson("[1,2]", "fallback")).toEqual([1, 2]);
  });

  it("keeps a literal null instead of returning the fallback", () => {
    expect(tryParseJson("null", "fallback")).toBeNull();
  });

  it("returns the fallback for invalid or empty input", () => {
    expect(tryParseJson("{oops", "fallback")).toBe("fallback");
    expect(tryParseJson("   ", undefined)).toBeUndefined();
  });
});

describe("parseJsonObject", () => {
  it("returns objects and arrays", () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonObject("[1]")).toEqual([1]);
  });

  it("returns null for primitives, null, invalid and empty input", () => {
    expect(parseJsonObject("42")).toBeNull();
    expect(parseJsonObject('"s"')).toBeNull();
    expect(parseJsonObject("null")).toBeNull();
    expect(parseJsonObject("{bad")).toBeNull();
    expect(parseJsonObject("")).toBeNull();
  });
});

describe("firstJsonPathMatch", () => {
  const doc = { a: { b: [1, 2] }, n: null };

  it("returns the first match", () => {
    expect(firstJsonPathMatch(doc, "$.a.b[*]")).toBe(1);
    expect(firstJsonPathMatch(doc, "$.a")).toEqual({ b: [1, 2] });
  });

  it("returns a matched null distinctly from no match", () => {
    expect(firstJsonPathMatch(doc, "$.n")).toBeNull();
  });

  it("returns undefined when nothing matches", () => {
    expect(firstJsonPathMatch(doc, "$.missing")).toBeUndefined();
  });

  it("returns undefined for unqueryable input or a throwing path", () => {
    expect(firstJsonPathMatch(undefined, "$.a")).toBeUndefined();
    expect(firstJsonPathMatch(doc, "$..[?(@.x ==")).toBeUndefined();
  });
});

describe("prettyPrintJson", () => {
  it("indents valid JSON", () => {
    expect(prettyPrintJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it("returns invalid or empty text unchanged", () => {
    expect(prettyPrintJson("not json")).toBe("not json");
    expect(prettyPrintJson("")).toBe("");
  });
});

describe("isPlainRecord", () => {
  it("accepts plain objects only", () => {
    expect(isPlainRecord({})).toBe(true);
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord(null)).toBe(false);
    expect(isPlainRecord("x")).toBe(false);
  });
});

describe("queryJsonPath", () => {
  const doc = { a: { b: [1, 2] }, n: null };

  it("returns ok with the first match, including a literal null", () => {
    expect(queryJsonPath(doc, "$.a.b[*]")).toEqual({ ok: true, value: 1 });
    expect(queryJsonPath(doc, "$.n")).toEqual({ ok: true, value: null });
  });

  it("reports noMatch when nothing matches", () => {
    expect(queryJsonPath(doc, "$.missing")).toEqual({
      ok: false,
      reason: "noMatch",
    });
  });

  it("reports invalidJson when the input can't be queried", () => {
    expect(queryJsonPath(undefined, "$.a")).toEqual({
      ok: false,
      reason: "invalidJson",
    });
  });

  it("reports invalidJsonPath when the path throws", () => {
    expect(queryJsonPath(doc, "$..[?(@.x ==")).toEqual({
      ok: false,
      reason: "invalidJsonPath",
    });
  });
});
