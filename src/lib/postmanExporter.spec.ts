import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import type {
  AuthConfig,
  BodyConfig,
  CollectionFolderModel,
  CollectionModel,
  KVPair,
  RequestModel,
} from "@/types";
import {
  downloadPostmanCollection,
  downloadPostmanRequest,
  exportToPostmanCollection,
} from "./postmanExporter";
import { isPostmanCollection, parsePostmanCollection } from "./postmanParser";

const SCHEMA =
  "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function kv(key: string, value: string, enabled = true): KVPair {
  return { id: `id-${key}`, key, value, enabled };
}

function makeCollection(
  overrides: Partial<CollectionModel> = {},
): CollectionModel {
  return {
    id: "col1",
    name: "My Collection",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<RequestModel> = {}): RequestModel {
  return {
    id: "r1",
    collectionId: "col1",
    folderId: null,
    name: "Req",
    method: "GET",
    url: "https://api.test/users",
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeFolder(
  overrides: Partial<CollectionFolderModel> = {},
): CollectionFolderModel {
  return {
    id: "f1",
    collectionId: "col1",
    name: "Folder",
    parentFolderId: null,
    order: 0,
    ...overrides,
  };
}

function roundTrip(
  requests: RequestModel[],
  folders: CollectionFolderModel[] = [],
) {
  const exported = exportToPostmanCollection(
    makeCollection(),
    requests,
    folders,
  );
  return parsePostmanCollection(
    JSON.parse(JSON.stringify(exported)) as Record<string, unknown>,
  );
}

describe("exportToPostmanCollection", () => {
  it("emits the v2.1 schema and the collection name", () => {
    const result = exportToPostmanCollection(makeCollection(), []);

    expect(result.info.name).toBe("My Collection");
    expect(result.info.schema).toBe(SCHEMA);
    expect(result.item).toEqual([]);
  });

  it("includes the description only when the collection has one", () => {
    const withDesc = exportToPostmanCollection(
      makeCollection({ description: "docs" }),
      [],
    );
    const without = exportToPostmanCollection(makeCollection(), []);

    expect(withDesc.info.description).toBe("docs");
    expect("description" in without.info).toBe(false);
  });

  it("splits a valid url into protocol, host segments, path and query", () => {
    const [item] = exportToPostmanCollection(makeCollection(), [
      makeRequest({
        url: "https://api.test/v1/users?page=2",
        params: [kv("limit", "10")],
      }),
    ]).item;

    expect(item).toMatchObject({
      request: {
        url: {
          raw: "https://api.test/v1/users?page=2",
          protocol: "https",
          host: ["api", "test"],
          path: ["v1", "users"],
          query: [
            { key: "page", value: "2" },
            { key: "limit", value: "10" },
          ],
        },
      },
    });
  });

  it("omits query when the url has no query and no enabled params", () => {
    const [item] = exportToPostmanCollection(makeCollection(), [
      makeRequest({ params: [kv("off", "1", false)] }),
    ]).item;

    expect("query" in (item as { request: { url: object } }).request.url).toBe(
      false,
    );
  });

  it("keeps a non-parseable url raw with its enabled params", () => {
    const [item] = exportToPostmanCollection(makeCollection(), [
      makeRequest({ url: "{{baseUrl}}/users", params: [kv("a", "1")] }),
    ]).item;

    expect((item as { request: { url: unknown } }).request.url).toEqual({
      raw: "{{baseUrl}}/users",
      query: [{ key: "a", value: "1" }],
    });
  });

  it("exports only enabled headers with keys", () => {
    const [item] = exportToPostmanCollection(makeCollection(), [
      makeRequest({
        headers: [kv("A", "1"), kv("B", "2", false), kv("", "3")],
      }),
    ]).item;

    expect((item as { request: { header: unknown } }).request.header).toEqual([
      { key: "A", value: "1" },
    ]);
  });

  it("nests folders and orders them by their order field, before requests", () => {
    const folders = [
      makeFolder({ id: "fB", name: "B", order: 1 }),
      makeFolder({ id: "fA", name: "A", order: 0 }),
      makeFolder({ id: "fC", name: "Child", parentFolderId: "fA" }),
    ];
    const requests = [
      makeRequest({ id: "r1", name: "Root", createdAt: 5 }),
      makeRequest({ id: "r2", name: "InChild", folderId: "fC" }),
    ];

    const { item } = exportToPostmanCollection(
      makeCollection(),
      requests,
      folders,
    );

    expect(item).toEqual([
      {
        name: "A",
        item: [
          { name: "Child", item: [expect.objectContaining({ name: "InChild" })] },
        ],
      },
      { name: "B", item: [] },
      expect.objectContaining({ name: "Root" }),
    ]);
  });

  it("orders sibling requests by creation time", () => {
    const { item } = exportToPostmanCollection(makeCollection(), [
      makeRequest({ id: "late", name: "Late", createdAt: 9 }),
      makeRequest({ id: "early", name: "Early", createdAt: 2 }),
    ]);

    expect(item.map((i) => i.name)).toEqual(["Early", "Late"]);
  });

  describe("bodies", () => {
    const rawCases: Array<[BodyConfig["type"], string]> = [
      ["json", "json"],
      ["xml", "xml"],
      ["text", "text"],
      ["html", "html"],
    ];

    it.each(rawCases)("exports a %s body as raw with language", (type, lang) => {
      const [item] = exportToPostmanCollection(makeCollection(), [
        makeRequest({ body: { type, content: "payload" } }),
      ]).item;

      expect((item as { request: { body: unknown } }).request.body).toEqual({
        mode: "raw",
        raw: "payload",
        options: { raw: { language: lang } },
      });
    });

    it("omits the body for type none", () => {
      const [item] = exportToPostmanCollection(makeCollection(), [
        makeRequest(),
      ]).item;

      expect("body" in (item as { request: object }).request).toBe(false);
    });

    it("exports only enabled urlencoded pairs", () => {
      const [item] = exportToPostmanCollection(makeCollection(), [
        makeRequest({
          body: {
            type: "urlencoded",
            content: "",
            formData: [kv("a", "1"), kv("b", "2", false)],
          },
        }),
      ]).item;

      expect((item as { request: { body: unknown } }).request.body).toEqual({
        mode: "urlencoded",
        urlencoded: [{ key: "a", value: "1" }],
      });
    });

    it("exports form-data pairs as text fields", () => {
      const [item] = exportToPostmanCollection(makeCollection(), [
        makeRequest({
          body: { type: "form-data", content: "", formData: [kv("f", "v")] },
        }),
      ]).item;

      expect((item as { request: { body: unknown } }).request.body).toEqual({
        mode: "formdata",
        formdata: [{ key: "f", value: "v", type: "text" }],
      });
    });

    it("tolerates a form body without formData", () => {
      const [item] = exportToPostmanCollection(makeCollection(), [
        makeRequest({ body: { type: "urlencoded", content: "" } }),
      ]).item;

      expect(
        (item as { request: { body: unknown } }).request.body,
      ).toEqual({ mode: "urlencoded", urlencoded: [] });
    });
  });

  describe("auth", () => {
    it("omits auth for type none", () => {
      const [item] = exportToPostmanCollection(makeCollection(), [
        makeRequest(),
      ]).item;

      expect("auth" in (item as { request: object }).request).toBe(false);
    });

    it("exports api-key auth including the in location", () => {
      const auth: AuthConfig = {
        type: "api-key",
        key: "X-Key",
        value: "s",
        addTo: "query",
      };
      const [item] = exportToPostmanCollection(makeCollection(), [
        makeRequest({ auth }),
      ]).item;

      expect((item as { request: { auth: unknown } }).request.auth).toEqual({
        type: "apikey",
        apikey: [
          { key: "key", value: "X-Key", type: "string" },
          { key: "value", value: "s", type: "string" },
          { key: "in", value: "query", type: "string" },
        ],
      });
    });
  });
});

describe("export then parse round-trip", () => {
  it("produces a document recognized as a Postman collection", () => {
    const exported = exportToPostmanCollection(makeCollection(), [
      makeRequest(),
    ]);

    expect(isPostmanCollection(exported as unknown as Record<string, unknown>)).toBe(
      true,
    );
  });

  it("restores the collection name, requests and folder hierarchy", () => {
    const folders = [
      makeFolder({ id: "fA", name: "A" }),
      makeFolder({ id: "fC", name: "Child", parentFolderId: "fA" }),
    ];
    const parsed = roundTrip(
      [
        makeRequest({ id: "r1", name: "Root req" }),
        makeRequest({ id: "r2", name: "Deep req", folderId: "fC" }),
      ],
      folders,
    );

    const a = parsed.folders.find((f) => f.name === "A");
    const child = parsed.folders.find((f) => f.name === "Child");
    const deep = parsed.requests.find((r) => r.name === "Deep req");
    const root = parsed.requests.find((r) => r.name === "Root req");

    expect(parsed.name).toBe("My Collection");
    expect(a?.parentTempId).toBeNull();
    expect(child?.parentTempId).toBe(a?.tempId);
    expect(deep?.folderTempId).toBe(child?.tempId);
    expect(root?.folderTempId).toBeNull();
  });

  it("restores method, url and enabled headers", () => {
    const [req] = roundTrip([
      makeRequest({
        method: "PUT",
        url: "https://api.test/v1/x",
        headers: [kv("X-A", "1"), kv("X-Off", "2", false)],
      }),
    ]).requests;

    expect(req.method).toBe("PUT");
    expect(req.url).toBe("https://api.test/v1/x");
    expect(req.headers).toMatchObject([
      { key: "X-A", value: "1", enabled: true },
    ]);
    expect(req.headers).toHaveLength(1);
  });

  it("restores query params as enabled pairs", () => {
    const [req] = roundTrip([
      makeRequest({ params: [kv("q", "cats")] }),
    ]).requests;

    expect(req.params).toMatchObject([
      { key: "q", value: "cats", enabled: true },
    ]);
  });

  it.each([
    ["json", '{"a":1}'],
    ["xml", "<a/>"],
    ["html", "<p/>"],
    ["text", "plain"],
  ] as const)("restores a %s body", (type, content) => {
    const [req] = roundTrip([makeRequest({ body: { type, content } })]).requests;

    expect(req.body).toEqual({ type, content });
  });

  it("restores urlencoded and form-data pairs", () => {
    const parsed = roundTrip([
      makeRequest({
        id: "u",
        name: "U",
        createdAt: 1,
        body: { type: "urlencoded", content: "", formData: [kv("a", "1")] },
      }),
      makeRequest({
        id: "f",
        name: "F",
        createdAt: 2,
        body: { type: "form-data", content: "", formData: [kv("b", "2")] },
      }),
    ]);
    const u = parsed.requests.find((r) => r.name === "U");
    const f = parsed.requests.find((r) => r.name === "F");

    expect(u?.body.type).toBe("urlencoded");
    expect(u?.body.formData).toMatchObject([{ key: "a", value: "1" }]);
    expect(f?.body.type).toBe("form-data");
    expect(f?.body.formData).toMatchObject([{ key: "b", value: "2" }]);
  });

  it.each<[string, AuthConfig, AuthConfig]>([
    [
      "bearer",
      { type: "bearer", token: "t" },
      { type: "bearer", token: "t" },
    ],
    [
      "basic",
      { type: "basic", username: "u", password: "p" },
      { type: "basic", username: "u", password: "p" },
    ],
    [
      "api-key (header)",
      { type: "api-key", key: "K", value: "V", addTo: "header" },
      { type: "api-key", key: "K", value: "V", addTo: "header" },
    ],
    ["none", { type: "none" }, { type: "none" }],
  ])("restores %s auth", (_label, auth, expected) => {
    const [req] = roundTrip([makeRequest({ auth })]).requests;

    expect(req.auth).toEqual(expected);
  });
});

describe("download helpers", () => {
  let blobs: Blob[];
  let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };
  let createObjectURL: Mock<typeof URL.createObjectURL>;
  let revokeObjectURL: Mock<typeof URL.revokeObjectURL>;

  beforeEach(() => {
    blobs = [];
    anchor = { href: "", download: "", click: vi.fn() };
    createObjectURL = vi.fn<typeof URL.createObjectURL>((blob) => {
      if (!(blob instanceof Blob)) throw new Error("expected a Blob");
      blobs.push(blob);
      return "blob:mock-url";
    });
    revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.stubGlobal("document", { createElement: () => anchor });
  });

  afterEach(() => {
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
    vi.unstubAllGlobals();
  });

  it("downloads a collection as a sanitized .postman_collection.json file", () => {
    downloadPostmanCollection(makeCollection({ name: "My API/v2 !" }), [
      makeRequest(),
    ]);

    expect(anchor.download).toBe("My_API_v2__.postman_collection.json");
    expect(anchor.href).toBe("blob:mock-url");
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("serializes the exported collection as JSON blob content", async () => {
    downloadPostmanCollection(
      makeCollection(),
      [makeRequest({ name: "Only" })],
      [makeFolder()],
    );

    const parsed = JSON.parse(await blobs[0].text());

    expect(blobs[0].type).toBe("application/json");
    expect(parsed.info.name).toBe("My Collection");
    expect(parsed.item.map((i: { name: string }) => i.name)).toEqual([
      "Folder",
      "Only",
    ]);
  });

  it("downloads a single request wrapped in a one-item collection", async () => {
    downloadPostmanRequest(makeRequest({ name: "Get users" }));

    const parsed = JSON.parse(await blobs[0].text());

    expect(anchor.download).toBe("Get_users.postman_collection.json");
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(parsed.info).toEqual({ name: "Get users", schema: SCHEMA });
    expect(parsed.item).toHaveLength(1);
    expect(parsed.item[0].request.method).toBe("GET");
  });
});
