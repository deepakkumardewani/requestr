import { describe, expect, it } from "vitest";
import { z } from "zod";
import { afterEach } from "vitest";
import {
  AUTH_TYPES,
  awaitsUser,
  BODY_TYPES,
  FOLDER_ID_ERROR_CODE,
  folderIdError,
  RELAY_TOOL_SCHEMAS,
  type RelayToolName,
  registerCallCheck,
  SEARCH_KINDS,
} from "./schemas";

const parse = (name: RelayToolName, input: unknown) =>
  RELAY_TOOL_SCHEMAS[name].inputSchema.safeParse(input);

const CHAIN_BLOCK_KEYS = [
  "requestId",
  "sourceJsonPath",
  "schema",
  "delayMs",
  "itemAlias",
  "maxIterations",
  "variable",
  "branches",
  "targetField",
  "targetKey",
] as const;

const inputJsonSchema = (name: RelayToolName) =>
  z.toJSONSchema(RELAY_TOOL_SCHEMAS[name].inputSchema, { io: "input" }) as {
    properties: Record<string, { required?: string[]; properties?: Record<string, unknown> }>;
    required?: string[];
  };

describe("HH-M02: one read/write vocabulary", () => {
  it("[success] body types are the names get_request returns, xml and html included", () => {
    expect([...BODY_TYPES].sort()).toEqual(
      ["form-data", "html", "json", "none", "text", "urlencoded", "xml"].sort(),
    );
  });

  it.each(["xml", "html", "form-data"])("[success] set_request_body accepts %s", (type) => {
    expect(parse("set_request_body", { requestId: "r1", body: { type, content: "x" } }).success).toBe(true);
  });

  it("[invalid] the old write-only name form is refused", () => {
    expect(parse("set_request_body", { requestId: "r1", body: { type: "form", content: "x" } }).success).toBe(false);
  });

  it("[success] auth uses api-key with key and value, as get_request does", () => {
    expect([...AUTH_TYPES]).toEqual(["none", "bearer", "basic", "api-key"]);
    const auth = {
      type: "api-key",
      token: null,
      username: null,
      password: null,
      key: "X-Key",
      value: "{{K}}",
      addTo: "header",
    };
    expect(parse("set_request_auth", { requestId: "r1", auth }).success).toBe(true);
    expect(parse("set_request_auth", { requestId: "r1", auth: { ...auth, type: "apikey" } }).success).toBe(false);
  });

  it("[invalid] the old keyName and keyValue fields are refused", () => {
    const old = {
      type: "api-key",
      token: null,
      username: null,
      password: null,
      keyName: "X-Key",
      keyValue: "{{K}}",
      addTo: null,
    };
    expect(parse("set_request_auth", { requestId: "r1", auth: old }).success).toBe(false);
  });

  it("[success] the auth description names value, not keyValue, as a secret field", () => {
    const { description } = RELAY_TOOL_SCHEMAS.set_request_auth;
    expect(description).toContain("password, value");
    expect(description).not.toContain("keyValue");
  });
});

describe("HH-M19: no graphql body type", () => {
  it("[invalid] BODY_TYPES has no graphql and set_request_body{type:graphql} fails zod", () => {
    expect(BODY_TYPES).not.toContain("graphql");
    expect(parse("set_request_body", { requestId: "r1", body: { type: "graphql", content: "{ a }" } }).success).toBe(false);
  });

  it("[invalid] create_request refuses a graphql body too", () => {
    const create = {
      name: "R",
      collectionId: "c1",
      folderId: null,
      method: "POST",
      url: "https://a.test",
      headers: null,
      params: null,
      auth: null,
      body: { type: "graphql", content: "{ a }" },
    };
    expect(parse("create_request", create).success).toBe(false);
  });

  it("[success] the description points GraphQL to create_graphql_request and no longer promises wrapping", () => {
    const { description } = RELAY_TOOL_SCHEMAS.set_request_body;
    expect(description).toContain("create_graphql_request");
    expect(description).not.toMatch(/sent as a JSON body/);
  });
});

describe("HH-M17: nullable chain fields are optional", () => {
  const block = (extra: Record<string, unknown>) => ({
    chainId: "ch1",
    block: { kind: "delay", delayMs: 500, ...extra },
    after: null,
    afterHandle: null,
  });

  it("[success] add_chain_node accepts a block with every nullable key omitted", () => {
    expect(parse("add_chain_node", block({})).success).toBe(true);
  });

  it("[success] explicit nulls are still accepted", () => {
    const nulls = Object.fromEntries(CHAIN_BLOCK_KEYS.map((key) => [key, null]));
    expect(parse("add_chain_node", block(nulls)).success).toBe(true);
  });

  it("[success] update_chain_node accepts a patch with only the keys it changes", () => {
    expect(parse("update_chain_node", { chainId: "ch1", nodeId: "n1", patch: { delayMs: 10 } }).success).toBe(true);
    expect(parse("update_chain_node", { chainId: "ch1", nodeId: "n1", patch: {} }).success).toBe(true);
  });

  it("[invalid] a wrongly typed optional key is still refused", () => {
    expect(parse("add_chain_node", block({ delayMs: "soon" })).success).toBe(false);
  });

  it("[success] the JSON schema sent to the model lists none of the block keys as required", () => {
    const blockSchema = inputJsonSchema("add_chain_node").properties.block;
    expect(blockSchema.required).toEqual(["kind"]);
    for (const key of CHAIN_BLOCK_KEYS) {
      expect(Object.keys(blockSchema.properties ?? {})).toContain(key);
    }
  });

  it("[success] the descriptions tell the model it may omit unused fields", () => {
    expect(RELAY_TOOL_SCHEMAS.add_chain_node.description).toContain("omit the rest or leave them null");
    expect(RELAY_TOOL_SCHEMAS.update_chain_node.description).toContain("omit the rest or leave them null");
  });
});

describe("HH-M15: read-after-write surface", () => {
  it("[success] search can target folders", () => {
    expect(SEARCH_KINDS).toContain("folder");
    expect(parse("search_workspace", { query: "q", kinds: ["folder"], limit: null }).success).toBe(true);
    expect(RELAY_TOOL_SCHEMAS.search_workspace.description).toContain("folders");
  });

  it("[success] get_request and get_tab_request descriptions promise the extra fields", () => {
    expect(RELAY_TOOL_SCHEMAS.get_request.description).toMatch(/assertions, timeout, SSL and redirect/);
    expect(RELAY_TOOL_SCHEMAS.get_tab_request.description).toMatch(/HTTP tabs return/);
    expect(RELAY_TOOL_SCHEMAS.get_tab_request.description).toContain("generate_tests");
  });
});

describe("L-22 (part): tab ids and open_page sections", () => {
  it("[success] update_tab_request names both tabId sources", () => {
    const { description } = RELAY_TOOL_SCHEMAS.update_tab_request;
    expect(description).toContain("get_active_context");
    for (const creator of ["create_graphql_request", "create_websocket_request", "create_socketio_request"]) {
      expect(description).toContain(creator);
    }
  });

  it("[invalid] open_page rejects a section for a non-settings page, naming the field", () => {
    const result = parse("open_page", { page: "environments", section: "proxy" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path).toEqual(["section"]);
    expect(result.error.issues[0].message).toContain("settings");
  });

  it("[success] open_page takes a section for settings and null elsewhere", () => {
    expect(parse("open_page", { page: "settings", section: "proxy" }).success).toBe(true);
    expect(parse("open_page", { page: "environments", section: null }).success).toBe(true);
  });
});

describe("call check and folder id error", () => {
  afterEach(() => registerCallCheck(() => true));

  it("[success] a folder id error carries its code and names the folder tool", () => {
    const message = folderIdError("f1", "rename_folder");
    expect(message.startsWith(`${FOLDER_ID_ERROR_CODE}:`)).toBe(true);
    expect(message).toContain("f1");
    expect(message).toContain("rename_folder");
  });

  it("[success] a vetoed call shows no card, and a passing call still asks in review mode", () => {
    const call = { ids: ["a"] };
    expect(awaitsUser("delete_requests", call, "review")).toBe(true);
    registerCallCheck(() => false);
    expect(awaitsUser("delete_requests", call, "review")).toBe(false);
  });
});
