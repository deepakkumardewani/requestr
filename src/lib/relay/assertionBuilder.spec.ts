import { describe, expect, it } from "vitest";
import { ASSERTION_FIELDS_MAX, buildAssertions } from "./assertionBuilder";

const sequentialIds = () => {
  let n = 0;
  return () => `id-${++n}`;
};
const build = (status: number, headers: Record<string, string>, body: string) =>
  buildAssertions({ status, headers, body }, sequentialIds());

describe("buildAssertions", () => {
  it("asserts status, content type and top-level json keys", () => {
    expect(
      build(201, { "Content-Type": "application/json; charset=utf-8" }, '{"id":1,"name":"ada"}'),
    ).toEqual([
      { id: "id-1", source: "status", operator: "eq", expectedValue: "201", enabled: true },
      { id: "id-2", source: "header", sourcePath: "content-type", operator: "contains", expectedValue: "application/json", enabled: true },
      { id: "id-3", source: "jsonpath", sourcePath: "$.id", operator: "exists", enabled: true },
      { id: "id-4", source: "jsonpath", sourcePath: "$.name", operator: "exists", enabled: true },
    ]);
  });

  it("emits only the status assertion when there is no content type or json", () => {
    expect(build(204, {}, "")).toEqual([
      { id: "id-1", source: "status", operator: "eq", expectedValue: "204", enabled: true },
    ]);
  });

  it("skips a blank content type", () => {
    expect(build(200, { "content-type": " ; charset=utf-8" }, "")).toHaveLength(1);
  });

  it.each([["[1,2]"], ["null"], ['"text"'], ["not json"]])(
    "asserts no fields for the non-object body %s",
    (body) => {
      expect(build(200, {}, body)).toHaveLength(1);
    },
  );

  it("never asserts secret-named or non-identifier keys", () => {
    const body = JSON.stringify({ access_token: "x", password: "y", "bad-key": 1, "1st": 2, ok: 3 });
    const paths = build(200, {}, body).map((a) => a.sourcePath);
    expect(paths).toEqual([undefined, "$.ok"]);
  });

  it("never copies a response value into an assertion", () => {
    const secret = "sk-live-4eC39HqLyjWDarjtT1zdp7dc";
    const out = build(200, { "Content-Type": "application/json" }, JSON.stringify({ note: secret }));
    expect(JSON.stringify(out)).not.toContain(secret);
  });

  it("caps the number of field assertions", () => {
    const body = JSON.stringify(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, i])));
    const out = build(200, {}, body);
    expect(out.filter((a) => a.source === "jsonpath")).toHaveLength(ASSERTION_FIELDS_MAX);
    expect(out.at(-1)?.sourcePath).toBe(`$.f${ASSERTION_FIELDS_MAX - 1}`);
  });

  it("generates unique ids by default", () => {
    const out = buildAssertions({ status: 200, headers: { "content-type": "text/plain" }, body: "" });
    expect(new Set(out.map((a) => a.id)).size).toBe(2);
    expect(out.every((a) => a.id.length > 0)).toBe(true);
  });
});
