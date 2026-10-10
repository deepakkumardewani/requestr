import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchGraphQLSchema,
  formatTypeRef,
  type IntrospectionTypeRef,
} from "./graphqlIntrospection";

const schemaBody = JSON.stringify({
  data: {
    __schema: {
      queryType: { name: "Query" },
      mutationType: null,
      subscriptionType: null,
      types: [
        {
          kind: "OBJECT",
          name: "Query",
          description: null,
          fields: [
            {
              name: "hello",
              description: null,
              args: [],
              type: { kind: "SCALAR", name: "String", ofType: null },
            },
          ],
        },
        { kind: "SCALAR", name: "__Schema", description: null, fields: null },
      ],
    },
  },
});

function typeRef(partial: Partial<IntrospectionTypeRef>): IntrospectionTypeRef {
  return {
    kind: "SCALAR",
    name: "String",
    ofType: null,
    ...partial,
  };
}

describe("formatTypeRef", () => {
  it("returns Unknown for null ref", () => {
    expect(formatTypeRef(null)).toBe("Unknown");
  });

  it("formats NON_NULL and LIST wrappers", () => {
    const nonNull: IntrospectionTypeRef = {
      kind: "NON_NULL",
      name: null,
      ofType: typeRef({ name: "Int" }),
    };
    expect(formatTypeRef(nonNull)).toBe("Int!");

    const list: IntrospectionTypeRef = {
      kind: "LIST",
      name: null,
      ofType: nonNull,
    };
    expect(formatTypeRef(list)).toBe("[Int!]");
  });
});

describe("fetchGraphQLSchema", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards only enabled headers with keys to the proxy", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        status: 200,
        body: schemaBody,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchGraphQLSchema({
      url: "https://api.example.com/graphql",
      headers: [
        { id: "1", key: "Authorization", value: "Bearer x", enabled: true },
        { id: "2", key: "X-Off", value: "nope", enabled: false },
        { id: "3", key: "", value: "empty-key", enabled: true },
      ],
      sslVerify: true,
      followRedirects: false,
      timeoutMs: 5000,
    });

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const payload = JSON.parse(String(calls[0][1].body));
    expect(payload.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer x",
    });
  });

  it("throws network RequestError when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));

    await expect(
      fetchGraphQLSchema({
        url: "https://api.example.com/graphql",
        headers: [],
        sslVerify: true,
        followRedirects: true,
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ type: "network" });
  });

  it("throws proxy error when proxy payload reports error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ status: 502, body: "", error: "bad gateway" }),
    ));

    await expect(
      fetchGraphQLSchema({
        url: "https://api.example.com/graphql",
        headers: [],
        sslVerify: true,
        followRedirects: true,
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ type: "proxy", message: "bad gateway" });
  });

  it("throws parse error when body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ status: 200, body: "not-json" }),
    ));

    await expect(
      fetchGraphQLSchema({
        url: "https://api.example.com/graphql",
        headers: [],
        sslVerify: true,
        followRedirects: true,
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ type: "parse" });
  });

  it("throws proxy error when GraphQL errors array is present", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({
        status: 200,
        body: JSON.stringify({ errors: [{ message: "introspection denied" }] }),
      }),
    ));

    await expect(
      fetchGraphQLSchema({
        url: "https://api.example.com/graphql",
        headers: [],
        sslVerify: true,
        followRedirects: true,
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ type: "proxy", message: "introspection denied" });
  });

  it("filters built-in __ types from the parsed schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ status: 200, body: schemaBody }),
    ));

    const schema = await fetchGraphQLSchema({
      url: "https://api.example.com/graphql",
      headers: [],
      sslVerify: true,
      followRedirects: true,
      timeoutMs: 1000,
    });

    expect(schema.queryTypeName).toBe("Query");
    expect(schema.types.map((t) => t.name)).toEqual(["Query"]);
  });
});
