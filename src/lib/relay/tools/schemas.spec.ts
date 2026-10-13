import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  awaitsUser,
  BULK_CONFIRM_THRESHOLD,
  COLLECTION_DEPTH_MAX,
  isRelayToolName,
  RELAY_TOOL_SCHEMAS,
  type RelayToolName,
  requiresBulkApproval,
} from "./schemas";

const names = Object.keys(RELAY_TOOL_SCHEMAS) as RelayToolName[];

describe("relay tool schemas", () => {
  it("defines read, auto-applied, confirm and question tools", () => {
    const ofKind = (kind: string) =>
      names.filter((name) => RELAY_TOOL_SCHEMAS[name].kind === kind);
    expect(ofKind("read")).toHaveLength(10);
    expect(ofKind("auto")).toHaveLength(20);
    expect(ofKind("confirm").sort()).toEqual([
      "delete_chain",
      "delete_chain_node",
      "delete_collection",
      "delete_environment",
      "delete_request",
      "run_chain",
      "send_request",
    ]);
    expect(ofKind("ui")).toEqual(["ask_user"]);
    expect(names).toHaveLength(38);
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
