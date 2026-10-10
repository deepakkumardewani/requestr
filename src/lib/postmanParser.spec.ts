import { describe, expect, it } from "vitest";
import {
  isPostmanCollection,
  PostmanParseError,
  parsePostmanCollection,
} from "./postmanParser";

const SCHEMA =
  "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function collection(
  item: unknown[],
  info: Record<string, unknown> = { name: "C", schema: SCHEMA },
): Record<string, unknown> {
  return { info, item };
}

function singleRequest(request: Record<string, unknown>) {
  const parsed = parsePostmanCollection(
    collection([{ name: "R", request: { url: "https://x.test", ...request } }]),
  );
  return parsed.requests[0];
}

describe("isPostmanCollection", () => {
  it("accepts a document whose schema url points at getpostman.com", () => {
    expect(isPostmanCollection(collection([]))).toBe(true);
  });

  it("accepts a document identified only by _postman_id", () => {
    expect(
      isPostmanCollection(collection([], { name: "C", _postman_id: "abc" })),
    ).toBe(true);
  });

  it("rejects a document with neither schema marker nor _postman_id", () => {
    expect(isPostmanCollection(collection([], { name: "C" }))).toBe(false);
  });

  it("rejects a document with a non-postman schema url", () => {
    expect(
      isPostmanCollection(
        collection([], { name: "C", schema: "https://example.com/schema" }),
      ),
    ).toBe(false);
  });

  it("rejects a document missing info", () => {
    expect(isPostmanCollection({ item: [] })).toBe(false);
  });

  it("rejects a document whose item is not an array", () => {
    expect(isPostmanCollection({ info: { schema: SCHEMA }, item: {} })).toBe(
      false,
    );
  });
});

describe("parsePostmanCollection", () => {
  it("uses info.name as the collection name", () => {
    const parsed = parsePostmanCollection(
      collection(
        [{ name: "R", request: { url: "https://x.test" } }],
        { name: "My API", schema: SCHEMA },
      ),
    );

    expect(parsed.name).toBe("My API");
  });

  it("falls back to a default name when info.name is missing", () => {
    const parsed = parsePostmanCollection(
      collection([{ name: "R", request: { url: "https://x.test" } }], {
        schema: SCHEMA,
      }),
    );

    expect(parsed.name).toBe("Imported Collection");
  });

  it("preserves nested folders with parent links and sibling order", () => {
    const parsed = parsePostmanCollection(
      collection([
        { name: "Top request", request: { url: "https://x.test/a" } },
        {
          name: "Outer",
          item: [
            {
              name: "Inner",
              item: [
                { name: "Deep", request: { url: "https://x.test/deep" } },
              ],
            },
            { name: "Outer req", request: { url: "https://x.test/o" } },
          ],
        },
      ]),
    );

    const outer = parsed.folders.find((f) => f.name === "Outer");
    const inner = parsed.folders.find((f) => f.name === "Inner");
    const byName = (n: string) => parsed.requests.find((r) => r.name === n);

    expect(parsed.folders).toHaveLength(2);
    expect(outer?.parentTempId).toBeNull();
    expect(outer?.order).toBe(1);
    expect(inner?.parentTempId).toBe(outer?.tempId);
    expect(inner?.order).toBe(0);
    expect(byName("Top request")?.folderTempId).toBeNull();
    expect(byName("Deep")?.folderTempId).toBe(inner?.tempId);
    expect(byName("Outer req")?.folderTempId).toBe(outer?.tempId);
    expect(byName("Outer req")?.order).toBe(1);
  });

  it("accepts a string url", () => {
    const req = singleRequest({ url: "https://x.test/path?a=1" });

    expect(req.url).toBe("https://x.test/path?a=1");
    expect(req.params).toEqual([]);
  });

  it("reads raw url and query params from an object url, keeping disabled state", () => {
    const req = singleRequest({
      url: {
        raw: "https://x.test/p?a=1&b=2",
        query: [
          { key: "a", value: "1" },
          { key: "b", value: "2", disabled: true },
          { value: "orphan" },
        ],
      },
    });

    expect(req.url).toBe("https://x.test/p?a=1&b=2");
    expect(req.params).toMatchObject([
      { key: "a", value: "1", enabled: true },
      { key: "b", value: "2", enabled: false },
    ]);
    expect(req.params).toHaveLength(2);
  });

  it("defaults the method to GET when absent and for unsupported verbs", () => {
    expect(singleRequest({}).method).toBe("GET");
    expect(singleRequest({ method: "TRACE" }).method).toBe("GET");
  });

  it("normalizes method case", () => {
    expect(singleRequest({ method: "post" }).method).toBe("POST");
  });

  it("parses headers and drops entries without a key", () => {
    const req = singleRequest({
      header: [
        { key: "X-A", value: "1" },
        { key: "X-B", value: "2", disabled: true },
        { value: "no key" },
      ],
    });

    expect(req.headers).toMatchObject([
      { key: "X-A", value: "1", enabled: true },
      { key: "X-B", value: "2", enabled: false },
    ]);
    expect(req.headers).toHaveLength(2);
  });

  it("names unnamed requests Request", () => {
    const parsed = parsePostmanCollection(
      collection([{ request: { url: "https://x.test" } }]),
    );

    expect(parsed.requests[0].name).toBe("Request");
  });

  it("skips non-folder items that have no request", () => {
    const parsed = parsePostmanCollection(
      collection([
        { name: "Dangling" },
        { name: "Real", request: { url: "https://x.test" } },
      ]),
    );

    expect(parsed.requests.map((r) => r.name)).toEqual(["Real"]);
  });

  describe("auth", () => {
    it("maps bearer auth to a token", () => {
      const req = singleRequest({
        auth: { type: "bearer", bearer: [{ key: "token", value: "tok" }] },
      });

      expect(req.auth).toEqual({ type: "bearer", token: "tok" });
    });

    it("maps basic auth to username and password", () => {
      const req = singleRequest({
        auth: {
          type: "basic",
          basic: [
            { key: "username", value: "u" },
            { key: "password", value: "p" },
          ],
        },
      });

      expect(req.auth).toEqual({
        type: "basic",
        username: "u",
        password: "p",
      });
    });

    it("maps apikey auth to an api-key sent in the header", () => {
      const req = singleRequest({
        auth: {
          type: "apikey",
          apikey: [
            { key: "key", value: "X-Key" },
            { key: "value", value: "secret" },
          ],
        },
      });

      expect(req.auth).toEqual({
        type: "api-key",
        key: "X-Key",
        value: "secret",
        addTo: "header",
      });
    });

    it("uses empty strings when auth fields are missing", () => {
      const req = singleRequest({ auth: { type: "bearer" } });

      expect(req.auth).toEqual({ type: "bearer", token: "" });
    });

    it("maps unsupported auth types and absent auth to none", () => {
      expect(singleRequest({ auth: { type: "oauth2" } }).auth).toEqual({
        type: "none",
      });
      expect(singleRequest({}).auth).toEqual({ type: "none" });
    });
  });

  describe("body", () => {
    it("maps raw json language to a json body", () => {
      const req = singleRequest({
        body: {
          mode: "raw",
          raw: '{"a":1}',
          options: { raw: { language: "json" } },
        },
      });

      expect(req.body).toEqual({ type: "json", content: '{"a":1}' });
    });

    it.each(["xml", "html"] as const)("maps raw %s language", (language) => {
      const req = singleRequest({
        body: { mode: "raw", raw: "<a/>", options: { raw: { language } } },
      });

      expect(req.body).toEqual({ type: language, content: "<a/>" });
    });

    it("maps raw without a known language to a text body", () => {
      const req = singleRequest({ body: { mode: "raw", raw: "hi" } });

      expect(req.body).toEqual({ type: "text", content: "hi" });
    });

    it("maps urlencoded body to form pairs", () => {
      const req = singleRequest({
        body: {
          mode: "urlencoded",
          urlencoded: [
            { key: "a", value: "1" },
            { key: "b", value: "2", disabled: true },
          ],
        },
      });

      expect(req.body.type).toBe("urlencoded");
      expect(req.body.content).toBe("");
      expect(req.body.formData).toMatchObject([
        { key: "a", value: "1", enabled: true },
        { key: "b", value: "2", enabled: false },
      ]);
    });

    it("maps formdata body to form-data pairs", () => {
      const req = singleRequest({
        body: { mode: "formdata", formdata: [{ key: "f", value: "v" }] },
      });

      expect(req.body.type).toBe("form-data");
      expect(req.body.formData).toMatchObject([
        { key: "f", value: "v", enabled: true },
      ]);
    });

    it("maps unsupported modes and missing bodies to none", () => {
      expect(singleRequest({ body: { mode: "file" } }).body).toEqual({
        type: "none",
        content: "",
      });
      expect(singleRequest({}).body).toEqual({ type: "none", content: "" });
    });
  });

  describe("errors", () => {
    it("throws PostmanParseError when there are no items", () => {
      expect(() => parsePostmanCollection(collection([]))).toThrow(
        PostmanParseError,
      );
    });

    it("throws with the no-requests message when folders contain no requests", () => {
      expect(() =>
        parsePostmanCollection(collection([{ name: "Empty", item: [] }])),
      ).toThrow("No requests found in the Postman collection");
    });
  });
});
