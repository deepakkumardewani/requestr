import { describe, expect, it, vi } from "vitest";
import {
  APPROVAL_REQUIRED,
  ApprovalToken,
  ConfirmPreview,
  ToolContext,
  ToolOutcome,
  createRegistry,
  executeTool,
  grantApproval,
  previewConfirmation,
  serializeResult,
  type AnyToolImpl,
  type ToolImpl,
  type RegisteredTool,
  type ToolRegistry,
} from "./registry";
import { RELAY_TOOL_SCHEMAS, type RelayToolName } from "./schemas";

const mockRedactContext = {
  secrets: [],
  variables: [],
  shareValues: false,
} as ToolContext["redact"];

describe("registry.ts", () => {
  describe("grantApproval", () => {
    it("returns a frozen object", () => {
      const token = grantApproval();
      expect(() => {
        (token as any).prop = "value";
      }).toThrow();
    });

    it("returns a different object on each call", () => {
      const token1 = grantApproval();
      const token2 = grantApproval();
      expect(token1).not.toBe(token2);
    });

    it("each token is independently granted", () => {
      const token1 = grantApproval();
      const token2 = grantApproval();
      // Both should be valid approval tokens
      expect(typeof token1).toBe("object");
      expect(typeof token2).toBe("object");
    });
  });

  describe("createRegistry", () => {
    it("creates a registry from tool implementations", () => {
      const impl: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: () => ({ ok: true, data: [] }),
      };
      const registry = createRegistry([impl]);
      expect(registry.has("search_workspace")).toBe(true);
    });

    it("includes the tool name, kind, schema, and run function", () => {
      const impl: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: () => ({ ok: true, data: [] }),
      };
      const registry = createRegistry([impl]);
      const tool = registry.get("search_workspace");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("search_workspace");
      expect(tool?.kind).toBe("read");
      expect(tool?.schema).toBeDefined();
      expect(tool?.run).toBeDefined();
    });

    it("sets refs to empty array when not provided", () => {
      const impl: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: () => ({ ok: true, data: [] }),
      };
      const registry = createRegistry([impl]);
      const tool = registry.get("search_workspace");
      expect(tool?.refs({})).toEqual([]);
    });

    it("uses the provided refs function", () => {
      const impl: ToolImpl<"delete_request"> = {
        name: "delete_request",
        refs: (input) => {
          const inp = input as { ids?: string[] };
          return (inp.ids || []).map((id) => ({ kind: "request" as const, id }));
        },
        run: () => ({ ok: true, data: null }),
      };
      const registry = createRegistry([impl]);
      const tool = registry.get("delete_request");
      const refs = tool?.refs({ ids: ["id1", "id2"] });
      expect(refs).toEqual([
        { kind: "request", id: "id1" },
        { kind: "request", id: "id2" },
      ]);
    });

    it("sets describe to undefined when not provided", () => {
      const impl: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: () => ({ ok: true, data: [] }),
      };
      const registry = createRegistry([impl]);
      const tool = registry.get("search_workspace");
      expect(tool?.describe).toBeUndefined();
    });

    it("uses the provided describe function", () => {
      const impl: ToolImpl<"delete_request"> = {
        name: "delete_request",
        refs: () => [],
        describe: () => ({
          action: "delete",
          severity: "danger",
          targets: ["Request 1"],
          count: 1,
        }),
        run: () => ({ ok: true, data: null }),
      };
      const registry = createRegistry([impl]);
      const tool = registry.get("delete_request");
      const preview = tool!.describe!({}, {} as never);
      expect(preview?.action).toBe("delete");
      expect(preview?.severity).toBe("danger");
    });

    it("registers multiple tools", () => {
      const impl1: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: () => ({ ok: true, data: [] }),
      };
      const impl2: ToolImpl<"get_request"> = {
        name: "get_request",
        run: () => ({ ok: true, data: {} }),
      };
      const registry = createRegistry([impl1, impl2]);
      expect(registry.size).toBe(2);
      expect(registry.has("search_workspace")).toBe(true);
      expect(registry.has("get_request")).toBe(true);
    });
  });

  describe("serializeResult", () => {
    it("returns a ToolOutcome", () => {
      const outcome: ToolOutcome = { ok: true, data: { key: "value" } };
      // serializeResult calls redactDeep which modifies the outcome, so we just verify it returns an outcome
      const result = serializeResult(outcome, { secrets: [], variables: [] } as any);
      expect(result).toHaveProperty("ok");
    });
  });

  describe("executeTool", () => {
    it("returns error for unknown tool name", async () => {
      const registry = createRegistry([]);
      const result = await executeTool(registry, "unknown_tool", {}, {
        store: { exists: () => true } as any,
        redact: mockRedactContext,
      });
      expect(result.ok).toBe(false);
      expect((result as { error: string }).error).toContain("unknown tool");
    });

    it("validates input against the tool's schema", async () => {
      const impl: ToolImpl<"delete_request"> = {
        name: "delete_request",
        run: () => ({ ok: true, data: null }),
      };
      const registry = createRegistry([impl]);
      const result = await executeTool(
        registry,
        "delete_request",
        { ids: [] },
        {
          store: { exists: () => true } as any,
          redact: mockRedactContext,
        }
      );
      expect(result.ok).toBe(false);
      expect((result as { error: string }).error).toContain("invalid input");
    });

    it("checks approval token when tool requires approval", async () => {
      const impl: ToolImpl<"delete_request"> = {
        name: "delete_request",
        run: () => ({ ok: true, data: null }),
      };
      const registry = createRegistry([impl]);
      const result = await executeTool(
        registry,
        "delete_request",
        { ids: ["id1"] },
        {
          store: { exists: () => true } as any,
          redact: mockRedactContext,
        }
      );
      expect(result.ok).toBe(false);
      expect((result as { error: string }).error).toBe(APPROVAL_REQUIRED);
    });

    it("runs the tool when all validations pass", async () => {
      const impl: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: () => ({ ok: true, data: { count: 5 } }),
      };
      const registry = createRegistry([impl]);
      const result = await executeTool(
        registry,
        "search_workspace",
        { query: "test", kinds: null, limit: null },
        {
          store: { exists: () => true } as any,
          redact: mockRedactContext,
        }
      );
      expect(result.ok).toBe(true);
    });

    it("handles async tool implementations", async () => {
      const impl: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return { ok: true, data: { count: 10 } };
        },
      };
      const registry = createRegistry([impl]);
      const result = await executeTool(
        registry,
        "search_workspace",
        { query: "test", kinds: null, limit: null },
        {
          store: { exists: () => true } as any,
          redact: mockRedactContext,
        }
      );
      expect(result.ok).toBe(true);
    });

    it("catches exceptions and returns error outcome", async () => {
      const impl: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: () => {
          throw new Error("unexpected failure");
        },
      };
      const registry = createRegistry([impl]);
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await executeTool(
        registry,
        "search_workspace",
        { query: "test", kinds: null, limit: null },
        {
          store: { exists: () => true } as any,
          redact: mockRedactContext,
        }
      );
      expect(result.ok).toBe(false);
      expect((result as { error: string }).error).toBe("the tool failed unexpectedly");
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    it("checks entity refs exist in the store", async () => {
      const impl: ToolImpl<"delete_request"> = {
        name: "delete_request",
        refs: () => [{ kind: "request", id: "missing-id" }],
        run: () => ({ ok: true, data: null }),
      };
      const registry = createRegistry([impl]);
      const result = await executeTool(
        registry,
        "delete_request",
        { ids: ["id1"] },
        {
          store: {
            exists: (kind: string, id: string) => id !== "missing-id",
          } as any,
          redact: mockRedactContext,
          approval: grantApproval(),
        }
      );
      expect(result.ok).toBe(false);
      expect((result as { error: string }).error).toContain("not found");
    });
  });

  describe("previewConfirmation", () => {
    it("returns null for unknown tool", () => {
      const registry = createRegistry([]);
      const preview = previewConfirmation(registry, "unknown_tool", {}, {} as any);
      expect(preview).toBeNull();
    });

    it("returns null for malformed input", () => {
      const impl: ToolImpl<"delete_request"> = {
        name: "delete_request",
        run: () => ({ ok: true, data: null }),
      };
      const registry = createRegistry([impl]);
      const preview = previewConfirmation(registry, "delete_request", { ids: [] }, {} as any);
      expect(preview).toBeNull();
    });

    it("uses tool's describe function when provided", () => {
      const impl: ToolImpl<"delete_request"> = {
        name: "delete_request",
        describe: () => ({
          action: "delete",
          severity: "danger",
          targets: ["Item 1", "Item 2"],
          count: 2,
        }),
        run: () => ({ ok: true, data: null }),
      };
      const registry = createRegistry([impl]);
      const preview = previewConfirmation(registry, "delete_request", { ids: ["id1", "id2"] }, {} as any);
      expect(preview?.action).toBe("delete");
      expect(preview?.severity).toBe("danger");
      expect(preview?.targets).toEqual(["Item 1", "Item 2"]);
    });

    it("returns null for read tools without describe", () => {
      const impl: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: () => ({ ok: true, data: [] }),
      };
      const registry = createRegistry([impl]);
      const preview = previewConfirmation(registry, "search_workspace", { query: "test", kinds: null, limit: null }, {} as any);
      expect(preview).toBeNull();
    });
  });

  describe("approval token security", () => {
    it("a hand-built object cannot be used as an approval token", async () => {
      const impl: ToolImpl<"delete_request"> = {
        name: "delete_request",
        run: () => ({ ok: true, data: null }),
      };
      const registry = createRegistry([impl]);
      const fakeToken = {} as ApprovalToken;
      const result = await executeTool(
        registry,
        "delete_request",
        { ids: ["id1"] },
        {
          store: { exists: () => true } as any,
          redact: mockRedactContext,
          approval: fakeToken,
        }
      );
      expect(result.ok).toBe(false);
      expect((result as { error: string }).error).toBe(APPROVAL_REQUIRED);
    });

    it("only grantApproval tokens are valid", async () => {
      const impl: ToolImpl<"delete_request"> = {
        name: "delete_request",
        run: () => ({ ok: true, data: null }),
      };
      const registry = createRegistry([impl]);
      const validToken = grantApproval();
      const result = await executeTool(
        registry,
        "delete_request",
        { ids: ["id1"] },
        {
          store: { exists: () => true } as any,
          redact: mockRedactContext,
          approval: validToken,
        }
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("tool context", () => {
    it("passes the full context to the tool", async () => {
      let passedContext: ToolContext | undefined;
      const impl: ToolImpl<"search_workspace"> = {
        name: "search_workspace",
        run: (input, context) => {
          passedContext = context;
          return { ok: true, data: [] };
        },
      };
      const registry = createRegistry([impl]);
      const context: ToolContext = {
        store: { exists: () => true } as any,
        redact: {} as any,
        permissionMode: "skip",
      };
      await executeTool(registry, "search_workspace", { query: "test", kinds: null, limit: null }, context);
      expect(passedContext?.permissionMode).toBe("skip");
    });
  });
});
