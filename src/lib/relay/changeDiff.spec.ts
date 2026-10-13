import { describe, expect, it } from "vitest";
import { buildChangeDiff, DIFF_ROWS_MAX } from "./changeDiff";
import { REDACTED } from "./redact";

describe("buildChangeDiff", () => {
  it("lists only changed leaves and skips noise keys", () => {
    const diff = buildChangeDiff(
      { id: "r1", name: "List", url: "https://a.test", updatedAt: 1 },
      { id: "r1", name: "List", url: "https://b.test", updatedAt: 2 },
    );
    expect(diff.rows).toEqual([
      { path: "url", before: "https://a.test", after: "https://b.test" },
    ]);
    expect(diff.hidden).toBe(0);
  });

  it("names list items by key or name and reports additions and removals", () => {
    const diff = buildChangeDiff(
      { headers: [{ key: "Accept", value: "a" }] },
      { headers: [{ key: "X-New", value: "1" }] },
    );
    expect(diff.rows.map((r) => r.path)).toEqual([
      "headers[Accept].value",
      "headers[X-New].value",
    ]);
    expect(diff.rows[0]).toMatchObject({ before: "a", after: null });
    expect(diff.rows[1]).toMatchObject({ before: null, after: "1" });
  });

  it("shows a created entity as additions", () => {
    const diff = buildChangeDiff(null, { name: "New", method: "GET" });
    expect(diff.rows).toEqual([
      { path: "name", before: null, after: "New" },
      { path: "method", before: null, after: "GET" },
    ]);
  });

  it("falls back to the index for unnamed list items", () => {
    const diff = buildChangeDiff({ tags: [] }, { tags: ["a"] });
    expect(diff.rows[0].path).toBe("tags[0]");
  });

  it("never shows secret variable values or secret-looking strings", () => {
    const diff = buildChangeDiff(
      { variables: [{ key: "API_TOKEN", currentValue: "s3cret", initialValue: "s3cret", isSecret: true }] },
      { variables: [{ key: "API_TOKEN", currentValue: "s3cret", initialValue: "s3cret", isSecret: true }] },
    );
    expect(diff.rows).toEqual([]);
    const text = JSON.stringify(
      buildChangeDiff(
        { auth: { token: "Bearer abcdef123456" } },
        { variables: [{ key: "K", currentValue: "hunter2", isSecret: true }] },
      ),
    );
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("abcdef123456");
    expect(text).toContain(REDACTED);
  });

  it("truncates long values and caps the number of rows", () => {
    const many = Object.fromEntries(
      Array.from({ length: DIFF_ROWS_MAX + 5 }, (_, i) => [`k${i}`, "x".repeat(200)]),
    );
    const diff = buildChangeDiff({}, many);
    expect(diff.rows).toHaveLength(DIFF_ROWS_MAX);
    expect(diff.hidden).toBe(5);
    expect(diff.rows[0].after?.length).toBeLessThan(200);
  });
});
