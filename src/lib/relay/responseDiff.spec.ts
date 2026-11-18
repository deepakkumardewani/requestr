import { describe, expect, it } from "vitest";
import type { ResponseData } from "@/types";
import { DIFF_VALUE_MAX_CHARS, diffResponses } from "./responseDiff";
import { buildRedactContext, REDACTED } from "./redact";
import { JWT_SECRET, PLAIN_PASSWORD } from "./redact.corpus";
import { DIFF_ENTRIES_MAX } from "./tools/schemas";

const response = (
  overrides: Partial<Pick<ResponseData, "status" | "headers" | "body">> = {},
) => ({ status: 200, headers: {}, body: "", ...overrides });

describe("diffResponses", () => {
  it("reports identical responses", () => {
    const a = response({ headers: { "X-A": "1" }, body: '{"a":1}' });
    expect(diffResponses(a, { ...a })).toEqual({
      identical: true,
      status: null,
      headers: [],
      body: [],
      truncated: false,
    });
  });

  it("reports a status difference", () => {
    const out = diffResponses(response({ status: 200 }), response({ status: 500 }));
    expect(out.status).toEqual({ a: 200, b: 500 });
    expect(out.identical).toBe(false);
  });

  it("reports added, removed and changed headers case-insensitively", () => {
    const out = diffResponses(
      response({ headers: { "Content-Type": "text/plain", "X-Gone": "1", "X-Same": "s" } }),
      response({ headers: { "content-type": "text/html", "X-New": "2", "x-same": "s" } }),
    );
    expect(out.headers).toEqual([
      { path: "content-type", change: "changed", a: "text/plain", b: "text/html" },
      { path: "x-gone", change: "removed", a: "1" },
      { path: "x-new", change: "added", b: "2" },
    ]);
  });

  it("reports nested json body differences with paths", () => {
    const out = diffResponses(
      response({ body: '{"user":{"name":"ada","tags":["a","b"]},"drop":1,"n":1}' }),
      response({ body: '{"user":{"name":"bob","tags":["a","c","d"]},"add":true,"n":1}' }),
    );
    expect(out.body).toEqual([
      { path: "$.user.name", change: "changed", a: "ada", b: "bob" },
      { path: "$.user.tags[1]", change: "changed", a: "b", b: "c" },
      { path: "$.user.tags[2]", change: "added", b: "d" },
      { path: "$.drop", change: "removed", a: "1" },
      { path: "$.add", change: "added", b: "true" },
    ]);
  });

  it("reports a type change between array and object as one change", () => {
    const out = diffResponses(response({ body: '{"x":[1]}' }), response({ body: '{"x":{"0":1}}' }));
    expect(out.body).toEqual([{ path: "$.x", change: "changed", a: "[1]", b: '{"0":1}' }]);
  });

  it("reports a container against a scalar and null values", () => {
    const out = diffResponses(response({ body: '{"x":{"a":1},"y":null}' }), response({ body: '{"x":5,"y":{"z":1}}' }));
    expect(out.body).toEqual([
      { path: "$.x", change: "changed", a: '{"a":1}', b: "5" },
      { path: "$.y", change: "changed", a: "null", b: '{"z":1}' },
    ]);
  });

  it("treats a root scalar json change as a change at the root", () => {
    const out = diffResponses(response({ body: "1" }), response({ body: "2" }));
    expect(out.body).toEqual([{ path: "$", change: "changed", a: "1", b: "2" }]);
  });

  it("compares non-json bodies as text and ignores equal text", () => {
    const out = diffResponses(response({ body: "<p>a</p>" }), response({ body: "<p>b</p>" }));
    expect(out.body).toEqual([{ path: "$", change: "changed", a: "<p>a</p>", b: "<p>b</p>" }]);
    expect(diffResponses(response({ body: "same" }), response({ body: "same" })).identical).toBe(true);
  });

  it("compares as text when only one side is json", () => {
    const out = diffResponses(response({ body: '{"a":1}' }), response({ body: "oops" }));
    expect(out.body).toHaveLength(1);
    expect(out.body[0].path).toBe("$");
  });

  it("clips long values", () => {
    const long = "x".repeat(DIFF_VALUE_MAX_CHARS + 50);
    const out = diffResponses(
      response({ body: JSON.stringify({ v: long }) }),
      response({ body: JSON.stringify({ v: "short" }) }),
    );
    expect(out.body[0].a).toBe(`${"x".repeat(DIFF_VALUE_MAX_CHARS)}…`);
    expect(out.body[0].b).toBe("short");
    const text = diffResponses(response({ body: long }), response({ body: "y" }));
    expect(text.body[0].a).toBe(`${"x".repeat(DIFF_VALUE_MAX_CHARS)}…`);
  });

  it("caps each part and flags truncation", () => {
    const many = (suffix: string) =>
      JSON.stringify(Object.fromEntries(Array.from({ length: DIFF_ENTRIES_MAX + 5 }, (_, i) => [`k${i}`, `${i}${suffix}`])));
    const out = diffResponses(response({ body: many("a") }), response({ body: many("b") }));
    expect(out.body).toHaveLength(DIFF_ENTRIES_MAX);
    expect(out.truncated).toBe(true);
    const headers = (suffix: string) =>
      Object.fromEntries(Array.from({ length: DIFF_ENTRIES_MAX + 1 }, (_, i) => [`h${i}`, `${i}${suffix}`]));
    const byHeaders = diffResponses(response({ headers: headers("a") }), response({ headers: headers("b") }));
    expect(byHeaders.headers).toHaveLength(DIFF_ENTRIES_MAX);
    expect(byHeaders.truncated).toBe(true);
  });

  it("does not flag truncation at exactly the cap", () => {
    const body = (suffix: string) =>
      JSON.stringify(Object.fromEntries(Array.from({ length: DIFF_ENTRIES_MAX }, (_, i) => [`k${i}`, `${i}${suffix}`])));
    const out = diffResponses(response({ body: body("a") }), response({ body: body("b") }));
    expect(out.body).toHaveLength(DIFF_ENTRIES_MAX);
    expect(out.truncated).toBe(false);
  });

  it("stops descending past the depth limit and compares the subtree as a value", () => {
    const nest = (leaf: string) => {
      let value: unknown = leaf;
      for (let i = 0; i < 20; i += 1) value = { n: value };
      return JSON.stringify(value);
    };
    const out = diffResponses(response({ body: nest("a") }), response({ body: nest("b") }));
    expect(out.body).toHaveLength(1);
    expect(out.body[0].change).toBe("changed");
    expect(out.body[0].path.split(".n").length - 1).toBe(12);
  });

  it("redacts secrets in headers and bodies on both sides", () => {
    const out = diffResponses(
      response({
        headers: { "Set-Cookie": "session=abc123def456ghi789", "X-Note": JWT_SECRET },
        body: JSON.stringify({ password: PLAIN_PASSWORD, note: JWT_SECRET, ok: 1 }),
      }),
      response({
        headers: { "Set-Cookie": "session=zzz999yyy888xxx777", "X-Note": "plain" },
        body: JSON.stringify({ password: "another-secret-value", note: "plain", ok: 2 }),
      }),
    );
    const text = JSON.stringify(out);
    for (const secret of [JWT_SECRET, PLAIN_PASSWORD, "abc123def456ghi789", "zzz999yyy888xxx777", "another-secret-value"]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain(REDACTED);
    expect(out.body.map((e) => e.path)).toEqual(["$.note", "$.ok"]);
  });

  it("redacts secrets in text bodies", () => {
    const out = diffResponses(
      response({ body: `token=${PLAIN_PASSWORD}` }),
      response({ body: "token=other-secret-value" }),
    );
    expect(JSON.stringify(out)).not.toContain(PLAIN_PASSWORD);
    expect(JSON.stringify(out)).not.toContain("other-secret-value");
  });

  it("scrubs a resolved environment secret using the supplied context", () => {
    const context = buildRedactContext([
      {
        id: "e",
        name: "E",
        createdAt: 0,
        updatedAt: 0,
        variables: [
          { id: "v", key: "token", initialValue: "", currentValue: "plain-env-secret-value-9981", isSecret: true },
        ],
      },
    ]);
    const out = diffResponses(
      response({ body: '{"a":"plain-env-secret-value-9981"}' }),
      response({ body: '{"a":"fine"}' }),
      context,
    );
    expect(out.body).toEqual([{ path: "$.a", change: "changed", a: "{{token}}", b: "fine" }]);
  });
});
