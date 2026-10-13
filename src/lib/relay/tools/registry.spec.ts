import { describe, expect, it, vi } from "vitest";
import { DEFAULT_REDACT_CONTEXT, REDACTED } from "../redact";
import { createFakeStoreAccess } from "../storeAccess";
import { MAX_TOOL_RESULT_CHARS } from "../tokenBudget";
import {
  createRegistry,
  executeTool,
  relayToolRegistry,
  serializeResult,
  type AnyToolImpl,
} from "./registry";
import { RELAY_TOOL_SCHEMAS } from "./schemas";

const { access: store } = createFakeStoreAccess({
  requests: [
    {
      id: "r1",
      collectionId: "c1",
      name: "R",
      method: "GET",
      url: "https://a.test",
      params: [],
      headers: [],
      auth: { type: "none" },
      body: { type: "none", content: "" },
      preScript: "",
      postScript: "",
      createdAt: 0,
      updatedAt: 0,
    },
  ],
});
const context = { store, redact: DEFAULT_REDACT_CONTEXT };

describe("executeTool", () => {
  it("rejects unknown tools without throwing", async () => {
    expect(await executeTool(relayToolRegistry, "nope", {}, context)).toEqual({
      ok: false,
      error: "unknown tool: nope",
    });
  });

  it("reports invalid input", async () => {
    const out = await executeTool(relayToolRegistry, "get_request", {}, context);
    expect(out).toMatchObject({ ok: false });
    expect((out as { error: string }).error).toContain("invalid input");
  });

  it("rechecks ids against live state", async () => {
    const out = await executeTool(relayToolRegistry, "get_request", { requestId: "gone" }, context);
    expect(out).toEqual({ ok: false, error: "request not found: gone" });
  });

  it("runs a valid tool", async () => {
    const out = await executeTool(relayToolRegistry, "get_request", { requestId: "r1" }, context);
    expect(out.ok).toBe(true);
  });

  it("turns a thrown run into a failure outcome", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const boom: AnyToolImpl = {
      name: "get_workspace_summary",
      run: () => {
        throw new Error("kaboom");
      },
    };
    const out = await executeTool(createRegistry([boom]), "get_workspace_summary", {}, context);
    expect(out).toEqual({ ok: false, error: "the tool failed unexpectedly" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reports a known tool that is not registered as unknown", async () => {
    const out = await executeTool(createRegistry([]), "get_request", { requestId: "r1" }, context);
    expect(out).toMatchObject({ ok: false });
  });
});

describe("serializeResult", () => {
  it("redacts secrets in the data", () => {
    const out = serializeResult(
      { ok: true, data: { password: "hunter2-long", note: "Bearer abcdef123456" } },
      DEFAULT_REDACT_CONTEXT,
    );
    expect(JSON.stringify(out)).not.toContain("hunter2");
    expect(JSON.stringify(out)).not.toContain("abcdef123456");
    expect(JSON.stringify(out)).toContain(REDACTED);
  });

  it("caps oversized results", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`k${i}`, "v".repeat(300)]),
    );
    const out = serializeResult({ ok: true, data: wide }, DEFAULT_REDACT_CONTEXT);
    expect(out).toMatchObject({ truncated: true });
    expect((out as unknown as { preview: string }).preview.length).toBeLessThanOrEqual(
      MAX_TOOL_RESULT_CHARS + 3,
    );
  });
});

describe("relayToolRegistry", () => {
  it("registers every schema exactly once with its schema and kind", () => {
    const schemaNames = Object.keys(RELAY_TOOL_SCHEMAS).sort();
    expect([...relayToolRegistry.keys()].sort()).toEqual(schemaNames);
    for (const [name, tool] of relayToolRegistry) {
      const definition = RELAY_TOOL_SCHEMAS[name as keyof typeof RELAY_TOOL_SCHEMAS];
      expect(tool.schema).toBe(definition.inputSchema);
      expect(tool.kind).toBe(definition.kind);
    }
  });

  it("fails a write tool cleanly when no write context is available", async () => {
    const out = await executeTool(
      relayToolRegistry,
      "set_active_environment",
      { environmentId: "e1" },
      context,
    );
    expect(out.ok).toBe(false);
  });
});
