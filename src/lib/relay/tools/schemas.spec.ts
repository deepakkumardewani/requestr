import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  approvalNeeded,
  awaitsUser,
  BULK_CONFIRM_THRESHOLD,
  COLLECTION_DEPTH_MAX,
  DIFF_ENTRIES_MAX,
  HISTORY_INDEX_MAX,
  isRelayToolName,
  NAVIGATION_TOOLS,
  RELAY_TOOL_SCHEMAS,
  registerConfirmGate,
  type RelayToolName,
  requiresBulkApproval,
} from "./schemas";

const names = Object.keys(RELAY_TOOL_SCHEMAS) as RelayToolName[];

describe("relay tool schemas", () => {
  it("defines read, auto-applied, confirm and question tools", () => {
    const ofKind = (kind: string) =>
      names.filter((name) => RELAY_TOOL_SCHEMAS[name].kind === kind);
    expect(ofKind("read")).toHaveLength(15);
    expect(ofKind("auto")).toHaveLength(44);
    expect(ofKind("confirm").sort()).toEqual([
      "clear_history",
      "delete_chain",
      "delete_chain_node",
      "delete_collection",
      "delete_environment",
      "delete_folder",
      "delete_request",
      "delete_requests",
      "delete_requests_in_collection",
      "export_backup",
      "import_api_catalog",
      "import_backup",
      "run_chain",
      "send_request",
    ]);
    expect(ofKind("ui")).toEqual(["ask_user"]);
    expect(names).toHaveLength(74);
  });

  it("makes the user answer confirm tools, questions and large bulk edits", () => {
    expect(awaitsUser("delete_request", { ids: ["a"] })).toBe(true);
    expect(awaitsUser("ask_user", { question: "q", options: ["a", "b"] })).toBe(true);
    expect(awaitsUser("get_request", { requestId: "a" })).toBe(false);
    // Bad input goes straight back to the model as a validation error.
    expect(awaitsUser("delete_request", { ids: [] })).toBe(false);
    expect(awaitsUser("nope", {})).toBe(false);
  });

  it("gates bulk edits above ten distinct requests only", () => {
    const ids = (count: number) => Array.from({ length: count }, (_, i) => `r${i}`);
    const op = { method: "GET", urlReplace: null, upsertHeaders: null, removeHeaders: null };
    expect(requiresBulkApproval("bulk_update_requests", { ids: ids(BULK_CONFIRM_THRESHOLD), op })).toBe(false);
    expect(requiresBulkApproval("bulk_update_requests", { ids: ids(BULK_CONFIRM_THRESHOLD + 1), op })).toBe(true);
    // Repeated ids count once.
    expect(requiresBulkApproval("bulk_update_requests", { ids: Array(20).fill("r"), op })).toBe(false);
    expect(requiresBulkApproval("update_request", { ids: ids(30) })).toBe(false);
  });

  it("rejects unknown keys on every tool", () => {
    for (const name of names) {
      const result = RELAY_TOOL_SCHEMAS[name].inputSchema.safeParse({ extra: 1 });
      expect(result.success).toBe(false);
    }
  });

  it("requires nullable optionals to be present", () => {
    const search = RELAY_TOOL_SCHEMAS.search_workspace.inputSchema;
    expect(search.safeParse({ query: "x" }).success).toBe(false);
    expect(search.safeParse({ query: "x", kinds: null, limit: null }).success).toBe(true);
  });

  it("bounds search limit and collection depth", () => {
    const search = RELAY_TOOL_SCHEMAS.search_workspace.inputSchema;
    expect(search.safeParse({ query: "x", kinds: null, limit: 21 }).success).toBe(false);
    const collection = RELAY_TOOL_SCHEMAS.get_collection.inputSchema;
    expect(
      collection.safeParse({ collectionId: "c", depth: COLLECTION_DEPTH_MAX + 1 }).success,
    ).toBe(false);
  });

  it("recognises tool names", () => {
    expect(isRelayToolName("get_request")).toBe(true);
    expect(isRelayToolName("delete_everything")).toBe(false);
  });

  it("imports nothing but zod (usable on the server)", () => {
    const source = readFileSync(new URL("./schemas.ts", import.meta.url), "utf8");
    const imports = [...source.matchAll(/^import .* from "(.*)";?$/gm)].map((m) => m[1]);
    expect(imports).toEqual(["zod"]);
  });
});

describe("ask_user description", () => {
  it("states the question-card rule (BUG-04)", () => {
    expect(RELAY_TOOL_SCHEMAS.ask_user.description).toMatch(/question card, never a plain-text list/);
  });
});

describe("tab and bulk-delete schemas", () => {
  const schema = <N extends RelayToolName>(name: N) => RELAY_TOOL_SCHEMAS[name].inputSchema;

  it("[success] close_tab takes one tabId and close_all_tabs a nullable includePinned", () => {
    expect(schema("close_tab").safeParse({ tabId: "t1" }).success).toBe(true);
    expect(schema("close_all_tabs").safeParse({ includePinned: null }).success).toBe(true);
    expect(schema("close_all_tabs").safeParse({ includePinned: true }).success).toBe(true);
  });

  it("[invalid] rejects missing, blank or extra tab arguments", () => {
    expect(schema("close_tab").safeParse({}).success).toBe(false);
    expect(schema("close_tab").safeParse({ tabId: "" }).success).toBe(false);
    expect(schema("close_all_tabs").safeParse({}).success).toBe(false);
    expect(schema("close_all_tabs").safeParse({ includePinned: "yes" }).success).toBe(false);
  });

  it("[success] bulk deletes accept 1 to 50 ids or one collection id", () => {
    const ids = (count: number) => Array.from({ length: count }, (_, i) => `r${i}`);
    expect(schema("delete_requests").safeParse({ ids: ids(50) }).success).toBe(true);
    expect(schema("delete_requests_in_collection").safeParse({ collectionId: "c1" }).success).toBe(true);
  });

  it("[invalid] bulk deletes reject empty, oversized and blank input", () => {
    const ids = (count: number) => Array.from({ length: count }, (_, i) => `r${i}`);
    expect(schema("delete_requests").safeParse({ ids: [] }).success).toBe(false);
    expect(schema("delete_requests").safeParse({ ids: ids(51) }).success).toBe(false);
    expect(schema("delete_requests_in_collection").safeParse({ collectionId: "" }).success).toBe(false);
  });
});

describe("registerConfirmGate", () => {
  it("[success] makes an auto tool await the user only when its gate says so", () => {
    registerConfirmGate("close_tab", (input) => (input as { tabId: string }).tabId === "dirty");
    expect(awaitsUser("close_tab", { tabId: "dirty" })).toBe(true);
    expect(awaitsUser("close_tab", { tabId: "clean" })).toBe(false);
  });

  it("[invalid] never consults the gate for input that fails validation", () => {
    registerConfirmGate("close_tab", () => true);
    expect(awaitsUser("close_tab", {})).toBe(false);
  });

  it("[success] leaves an auto tool without a gate running straight through", () => {
    expect(awaitsUser("get_request", { requestId: "r1" })).toBe(false);
  });
});

describe("approvalNeeded", () => {
  const bulk = (count: number) => ({
    ids: Array.from({ length: count }, (_, i) => `r${i}`),
    op: { type: "move", folderId: null },
  });

  it("[success] follows the RP-221 table per mode", () => {
    const grid: Array<[string, unknown, [boolean, boolean, boolean]]> = [
      ["get_request", { requestId: "a" }, [false, false, false]],
      ["ask_user", { question: "q", options: ["a", "b"] }, [false, false, false]],
      ["delete_request", { ids: ["a"] }, [true, true, false]],
      ["open_item", { kind: "request", id: "a" }, [false, false, false]],
    ];
    for (const [name, input, expected] of grid) {
      expect(
        (["always-ask", "review", "skip"] as const).map((m) => approvalNeeded(name, input, m)),
      ).toEqual(expected);
    }
  });

  it("[success] gates a bulk edit over the threshold only in always-ask and review", () => {
    const small = bulk(2);
    const large = bulk(BULK_CONFIRM_THRESHOLD + 1);
    expect(approvalNeeded("bulk_update_requests", small, "always-ask")).toBe(true);
    expect(approvalNeeded("bulk_update_requests", small, "review")).toBe(false);
    expect(approvalNeeded("bulk_update_requests", large, "review")).toBe(true);
    expect(approvalNeeded("bulk_update_requests", large, "skip")).toBe(false);
  });

  it("[success] defaults to review and ignores unknown tools", () => {
    expect(approvalNeeded("delete_request", { ids: ["a"] })).toBe(true);
    expect(approvalNeeded("create_collection", { name: "x" })).toBe(false);
    expect(approvalNeeded("nope", {}, "always-ask")).toBe(false);
  });

  it("[success] every auto tool is navigation or gated by always-ask", () => {
    const nav = NAVIGATION_TOOLS as readonly string[];
    for (const name of names.filter((n) => RELAY_TOOL_SCHEMAS[n].kind === "auto")) {
      expect(nav.includes(name) || approvalNeeded(name, {}, "always-ask")).toBe(true);
    }
  });

  it("[success] awaitsUser honors the mode but still awaits ask_user in skip", () => {
    expect(awaitsUser("delete_request", { ids: ["a"] }, "skip")).toBe(false);
    expect(awaitsUser("ask_user", { question: "q", options: ["a", "b"] }, "skip")).toBe(true);
  });
});

describe("tab-only request schemas", () => {
  const parse = (name: RelayToolName, input: unknown) =>
    RELAY_TOOL_SCHEMAS[name].inputSchema.safeParse(input);
  const update = {
    tabId: "t1", kind: "graphql", name: null, url: null, headers: null, query: null,
    variables: null, operationName: null, auth: null, draft: null, eventName: null,
  };

  it("accepts valid input for each kind", () => {
    expect(parse("create_graphql_request", { name: "G", url: "https://a.test/graphql", query: "{ a }", variables: '{"a":1}', operationName: null, headers: null, auth: null }).success).toBe(true);
    expect(parse("create_websocket_request", { name: "W", url: "wss://a.test", headers: null, draft: "hi" }).success).toBe(true);
    expect(parse("create_socketio_request", { name: "S", url: "https://a.test", headers: null, draft: null, eventName: null }).success).toBe(true);
  });

  it("rejects invalid variables JSON and non-ws urls with a message to fix", () => {
    const graphql = parse("create_graphql_request", { name: "G", url: "https://a.test", query: "{ a }", variables: "[1]", operationName: null, headers: null, auth: null });
    expect(graphql.success).toBe(false);
    expect(JSON.stringify(graphql.error?.issues)).toContain("JSON object");
    const socket = parse("create_websocket_request", { name: "W", url: "https://a.test", headers: null, draft: null });
    expect(JSON.stringify(socket.error?.issues)).toContain("ws://");
  });

  it("describes get_active_context and update_tab_request in terms of attached items", () => {
    expect(RELAY_TOOL_SCHEMAS.get_active_context.description).toMatch(/attached/);
    expect(RELAY_TOOL_SCHEMAS.get_active_context.description).toMatch(/never read on its own/);
    expect(RELAY_TOOL_SCHEMAS.update_tab_request.description).toMatch(/must be attached/);
  });

  it("discriminates update_tab_request by kind", () => {
    expect(parse("update_tab_request", { ...update, draft: "x" }).success).toBe(false);
    expect(parse("update_tab_request", { ...update, kind: "websocket", draft: "x" }).success).toBe(true);
    expect(parse("update_tab_request", { ...update, kind: "websocket", eventName: "x" }).success).toBe(false);
    expect(parse("update_tab_request", { ...update, kind: "websocket", url: "https://a.test" }).success).toBe(false);
    expect(parse("update_tab_request", { ...update, variables: "{bad" }).success).toBe(false);
    expect(parse("update_tab_request", { ...update, variables: "{}" }).success).toBe(true);
  });

  it("has no tool or input field that targets the approval mode or a wipe-all", () => {
    const forbidden = /permission|approval_?mode|wipe|clear_all|reset_all/i;
    for (const name of names) {
      const keys = Object.keys(RELAY_TOOL_SCHEMAS[name].inputSchema.shape);
      expect(name).not.toMatch(forbidden);
      for (const key of keys) expect(key).not.toMatch(forbidden);
    }
  });
});
