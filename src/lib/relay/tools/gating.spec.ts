import { describe, expect, it, vi } from "vitest";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeStoreAccess } from "../storeAccess";
import {
  APPROVAL_REQUIRED,
  executeTool,
  grantApproval,
  type RegisteredTool,
  relayToolRegistry,
  type ToolRegistry,
} from "./registry";
import {
  BULK_CONFIRM_THRESHOLD,
  RELAY_TOOL_SCHEMAS,
  type RelayToolName,
  requiresBulkApproval,
} from "./schemas";

/**
 * The FR-42 invariant, checked across the whole registry: no tool that needs
 * Approve reaches `run` without a token only `grantApproval()` can mint.
 */

const VALID_INPUT: Partial<Record<RelayToolName, unknown>> = {
  delete_request: { ids: ["r1"] },
  delete_requests: { ids: ["r1", "r2"] },
  delete_requests_in_collection: { collectionId: "c1" },
  delete_collection: { ids: ["c1"] },
  delete_environment: { id: "e1" },
  delete_chain: { id: "ch1" },
  delete_chain_node: { chainId: "ch1", nodeId: "n1" },
  clear_history: {},
  send_request: { requestId: "r1" },
  run_chain: { chainId: "ch1", fromNodeId: null },
  delete_folder: { id: "f1" },
  import_backup: {},
  import_api_catalog: { slug: "stripe" },
  export_backup: {
    sections: ["collections"],
    collectionIds: null,
    environmentIds: null,
    chainIds: null,
    includeSecrets: false,
  },
};

const bulkIds = Array.from({ length: BULK_CONFIRM_THRESHOLD + 1 }, (_, i) => `r${i}`);
const BULK_INPUT = {
  ids: bulkIds,
  op: { method: "GET", urlReplace: null, upsertHeaders: null, removeHeaders: null },
};

function spiedRegistry(): { registry: ToolRegistry; runs: Map<string, ReturnType<typeof vi.fn>> } {
  const runs = new Map<string, ReturnType<typeof vi.fn>>();
  const entries = [...relayToolRegistry].map(([name, tool]): [string, RegisteredTool] => {
    const run = vi.fn(async () => ({ ok: true as const, data: {} }));
    runs.set(name, run);
    return [name, { ...tool, run, refs: () => [] }];
  });
  return { registry: new Map(entries), runs };
}

const store = createFakeStoreAccess().access;
const context = { store, redact: DEFAULT_REDACT_CONTEXT };

const toolNames = Object.keys(RELAY_TOOL_SCHEMAS) as RelayToolName[];
const confirmTools = toolNames.filter((name) => RELAY_TOOL_SCHEMAS[name].kind === "confirm");

describe("approval gating across the registry", () => {
  it("has a valid sample input for every confirm tool, so a new one cannot skip this test", () => {
    expect(confirmTools.length).toBeGreaterThan(0);
    for (const name of confirmTools) {
      expect(VALID_INPUT[name], name).toBeDefined();
      expect(RELAY_TOOL_SCHEMAS[name].inputSchema.safeParse(VALID_INPUT[name]).success, name).toBe(true);
    }
  });

  it.each(confirmTools)("%s never reaches run without an approval token", async (name) => {
    const { registry, runs } = spiedRegistry();
    const outcome = await executeTool(registry, name, VALID_INPUT[name], context);
    expect(outcome).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    expect(runs.get(name)).not.toHaveBeenCalled();
  });

  it.each(confirmTools)("%s rejects a token that was not granted", async (name) => {
    const { registry, runs } = spiedRegistry();
    for (const forged of [{}, Object.freeze({}), { approved: true }, true, "approved"]) {
      const outcome = await executeTool(registry, name, VALID_INPUT[name], {
        ...context,
        approval: forged as never,
      });
      expect(outcome).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    }
    expect(runs.get(name)).not.toHaveBeenCalled();
  });

  it.each(confirmTools)("%s runs once a real token is given", async (name) => {
    const { registry, runs } = spiedRegistry();
    const outcome = await executeTool(registry, name, VALID_INPUT[name], {
      ...context,
      approval: grantApproval(),
    });
    expect(outcome.ok).toBe(true);
    expect(runs.get(name)).toHaveBeenCalledOnce();
  });

  it("does not let input fields stand in for approval", async () => {
    const { registry, runs } = spiedRegistry();
    const outcome = await executeTool(
      registry,
      "delete_request",
      { ids: ["r1"], approved: true, approval: true },
      context,
    );
    expect(outcome.ok).toBe(false);
    expect(runs.get("delete_request")).not.toHaveBeenCalled();
  });

  it("gates a bulk update above the threshold and lets one at the threshold through", async () => {
    const { registry, runs } = spiedRegistry();
    expect(await executeTool(registry, "bulk_update_requests", BULK_INPUT, context)).toEqual({
      ok: false,
      error: APPROVAL_REQUIRED,
    });
    expect(runs.get("bulk_update_requests")).not.toHaveBeenCalled();

    const atLimit = { ...BULK_INPUT, ids: bulkIds.slice(0, BULK_CONFIRM_THRESHOLD) };
    expect((await executeTool(registry, "bulk_update_requests", atLimit, context)).ok).toBe(true);
    expect(requiresBulkApproval("bulk_update_requests", atLimit)).toBe(false);
  });

  it("does not gate the read and ordinary write tools", async () => {
    const { registry } = spiedRegistry();
    const ungated = toolNames.filter(
      (name) => RELAY_TOOL_SCHEMAS[name].kind !== "confirm" && name !== "bulk_update_requests" && name !== "ask_user",
    );
    expect(ungated.length).toBeGreaterThan(0);
    for (const name of ungated) {
      // Invalid input stops at validation, which proves the approval check does not come first.
      const outcome = await executeTool(registry, name, {}, context);
      expect(outcome, name).not.toEqual({ ok: false, error: APPROVAL_REQUIRED });
    }
  });
});

describe("approval gating by permission mode", () => {
  it("skip runs a confirm tool without a token", async () => {
    const { registry, runs } = spiedRegistry();
    const outcome = await executeTool(registry, "delete_request", VALID_INPUT.delete_request, {
      ...context,
      permissionMode: "skip",
    });
    expect(outcome.ok).toBe(true);
    expect(runs.get("delete_request")).toHaveBeenCalledOnce();
  });

  it("review still requires a token for a confirm tool", async () => {
    const { registry } = spiedRegistry();
    const outcome = await executeTool(registry, "delete_request", VALID_INPUT.delete_request, {
      ...context,
      permissionMode: "review",
    });
    expect(outcome).toEqual({ ok: false, error: APPROVAL_REQUIRED });
  });

  it("always-ask gates an auto tool until a real token is given, and rejects forged ones", async () => {
    const { registry, runs } = spiedRegistry();
    const input = { name: "Docs", parentId: null };
    const gated = { ...context, permissionMode: "always-ask" as const };
    expect(await executeTool(registry, "create_collection", input, gated)).toEqual({
      ok: false,
      error: APPROVAL_REQUIRED,
    });
    expect(
      await executeTool(registry, "create_collection", input, { ...gated, approval: {} as never }),
    ).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    expect(runs.get("create_collection")).not.toHaveBeenCalled();
    const approved = await executeTool(registry, "create_collection", input, {
      ...gated,
      approval: grantApproval(),
    });
    expect(approved.ok).toBe(true);
  });

  it("always-ask does not gate a read or navigation tool", async () => {
    const { registry, runs } = spiedRegistry();
    const gated = { ...context, permissionMode: "always-ask" as const };
    await executeTool(registry, "open_item", { kind: "request", id: "x" }, gated);
    expect(runs.get("open_item")).toHaveBeenCalledOnce();
  });

  it("forged tokens are rejected in every mode that needs approval", async () => {
    const { registry, runs } = spiedRegistry();
    for (const permissionMode of ["always-ask", "review"] as const) {
      const outcome = await executeTool(registry, "delete_request", VALID_INPUT.delete_request, {
        ...context,
        permissionMode,
        approval: Object.freeze({}) as never,
      });
      expect(outcome).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    }
    expect(runs.get("delete_request")).not.toHaveBeenCalled();
  });
});
