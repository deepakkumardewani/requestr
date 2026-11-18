/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { createTranslator } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { relayMessages } from "@/components/relay/relayIntlMock";
import { ToolRow } from "@/components/relay/ToolRow";
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_CATEGORY_BY_TOOL,
  capabilityBadge,
  categoryBadge,
  loadToolsFirstError,
} from "../capabilities";
import { RELAY_ERROR_META } from "../errors";
import {
  APPROVAL_REQUIRED,
  type ApprovalToken,
  createRegistry,
  executeTool,
  grantApproval,
  previewConfirmation,
  relayToolRegistry,
  serializeResult,
  type ToolContext,
  type ToolImpl,
} from "./registry";
import { awaitsUser, RELAY_TOOL_SCHEMAS } from "./schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const LOCALES = ["en", "fr", "ja"] as const;

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: { relay: relayMessages("en") } as never,
      namespace: namespace as never,
    }),
}));

afterEach(cleanup);

type Messages = Record<string, unknown>;
const lookup = (locale: (typeof LOCALES)[number], path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Messages | undefined)?.[key],
      relayMessages(locale),
    );

const registered = [...relayToolRegistry.keys()];

describe("tool consistency matrix", () => {
  it("registers at least one tool", () => {
    expect(registered.length).toBeGreaterThan(0);
  });

  it("registers exactly the tools the schemas declare", () => {
    expect(registered.toSorted()).toEqual(Object.keys(RELAY_TOOL_SCHEMAS).toSorted());
  });

  it("registers the new tools and not the removed one", () => {
    expect(registered).toEqual(
      expect.arrayContaining(["list_api_catalog", "list_history", "load_tools"]),
    );
    expect(registered).not.toContain("delete_request");
  });

  it.each(registered)("%s has an implementation", (name) => {
    const impl = relayToolRegistry.get(name);
    expect(impl?.name).toBe(name);
    expect(typeof impl?.run).toBe("function");
  });

  it.each(registered)("%s has exactly one capability category", (name) => {
    const category = (CAPABILITY_CATEGORY_BY_TOOL as Record<string, string>)[name];
    expect(category).toBeTruthy();
    const listedIn = CAPABILITY_CATEGORIES.filter((entry) =>
      (entry.tools as readonly string[]).includes(name),
    );
    expect(listedIn.length).toBeLessThanOrEqual(1);
  });

  it.each(registered)("%s has running and done labels in en, fr and ja", (name) => {
    for (const locale of LOCALES) {
      for (const phase of ["running", "done"]) {
        const label = lookup(locale, `tools.${name}.${phase}`);
        expect(label, `${locale} tools.${name}.${phase}`).toEqual(expect.any(String));
        expect((label as string).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("error codes have en/fr/ja entries", () => {
  const messageKeys = Object.values(RELAY_ERROR_META).map((meta) => meta.messageKey);

  it.each(messageKeys)("%s is translated in every locale", (key) => {
    for (const locale of LOCALES) {
      const text = lookup(locale, key);
      expect(text, `${locale} ${key}`).toEqual(expect.any(String));
      expect((text as string).length).toBeGreaterThan(0);
    }
  });

  it("every locale carries the same error keys as English", () => {
    const keysOf = (locale: (typeof LOCALES)[number]) =>
      Object.keys(lookup(locale, "errors") as Messages).toSorted();
    expect(keysOf("fr")).toEqual(keysOf("en"));
    expect(keysOf("ja")).toEqual(keysOf("en"));
  });

  it("covers the tool-level error codes", () => {
    for (const locale of LOCALES) {
      for (const key of ["loadToolsFirst", "catalogAlreadyImported", "catalogUnknownSlug", "folderIdRefused"]) {
        expect(lookup(locale, `errors.${key}`), `${locale} ${key}`).toEqual(expect.any(String));
      }
    }
  });
});

describe("old threads render read-only without errors (HH-M18)", () => {
  const legacy = [
    { type: "tool-delete_request", input: { ids: ["r1"] }, output: { ok: true, data: {} } },
    { type: "tool-delete_request", input: { ids: ["r1"] }, state: "input-available" },
    { type: "tool-send_request", input: { requestId: "r1", proxyUrl: "http://p" }, output: { ok: true, data: { status: 200 } } },
    { type: "tool-delete_request", input: {}, state: "output-error", errorText: "gone" },
  ];

  it.each(legacy.map((part, i) => [i, part] as const))("legacy part %i renders a row", (_i, part) => {
    expect(() =>
      render(createElement(ToolRow, { part: { state: "output-available", ...part } })),
    ).not.toThrow();
    const row = screen.getByTestId("relay-tool-row");
    expect(row).toHaveTextContent(/\S/);
    expect(row.querySelector("button")).toBeNull();
  });

  it("a removed tool uses the generic label", () => {
    render(
      createElement(ToolRow, {
        part: { type: "tool-delete_request", state: "output-available", output: { ok: true } },
      }),
    );
    expect(screen.getByTestId("relay-tool-row")).toHaveTextContent("Finished a step");
  });
});

describe("registry run path guards", () => {
  const redact = { secrets: [], variables: [], shareValues: false } as ToolContext["redact"];
  const store = { exists: () => true } as unknown as ToolContext["store"];
  const context = (extra: Partial<ToolContext> = {}): ToolContext => ({ store, redact, ...extra });
  const summaryImpl = (overrides: Partial<ToolImpl<"get_workspace_summary">> = {}) =>
    createRegistry([
      { name: "get_workspace_summary", run: () => ({ ok: true, data: "ran" }), ...overrides },
    ]);

  afterEach(() => vi.restoreAllMocks());

  it("refuses a tool outside the enabled set with the load_tools_first error", async () => {
    const result = await executeTool(
      summaryImpl(),
      "get_workspace_summary",
      {},
      context({ enabledTools: new Set(["load_tools"]) }),
    );
    expect(result).toEqual({ ok: false, error: loadToolsFirstError("get_workspace_summary") });
  });

  it("runs a tool that is in the enabled set", async () => {
    const result = await executeTool(
      summaryImpl(),
      "get_workspace_summary",
      {},
      context({ enabledTools: new Set(["get_workspace_summary"]) }),
    );
    expect(result).toEqual({ ok: true, data: "ran" });
  });

  it("returns the validation problem and never runs", async () => {
    const run = vi.fn(() => ({ ok: true as const, data: null }));
    const result = await executeTool(
      summaryImpl({ validate: () => "nothing to summarise", run }),
      "get_workspace_summary",
      {},
      context(),
    );
    expect(result).toEqual({ ok: false, error: "nothing to summarise" });
    expect(run).not.toHaveBeenCalled();
  });

  it("turns a throwing validator into a plain failure and logs with context", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await executeTool(
      summaryImpl({
        validate: () => {
          throw new Error("boom");
        },
      }),
      "get_workspace_summary",
      {},
      context(),
    );
    expect(result).toEqual({ ok: false, error: "the tool failed unexpectedly" });
    expect(log).toHaveBeenCalledWith(
      "[relay] tool validation failed",
      expect.objectContaining({ tool: "get_workspace_summary" }),
    );
  });

  it("turns a throwing run into a plain failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await executeTool(
      summaryImpl({
        run: () => {
          throw new Error("boom");
        },
      }),
      "get_workspace_summary",
      {},
      context(),
    );
    expect(result).toEqual({ ok: false, error: "the tool failed unexpectedly" });
    expect(log).toHaveBeenCalledWith(
      "[relay] tool failed",
      expect.objectContaining({ tool: "get_workspace_summary" }),
    );
  });

  it("reports an unknown tool name", async () => {
    const result = await executeTool(summaryImpl(), "delete_request", {}, context());
    expect(result).toEqual({ ok: false, error: "unknown tool: delete_request" });
  });

  it("describes an auto tool with the generic preview when it has no describe", () => {
    const registry = createRegistry([
      { name: "set_theme", run: () => ({ ok: true, data: null }) },
    ]);
    expect(previewConfirmation(registry, "set_theme", { theme: "dark" }, store)).not.toBeNull();
  });

  it("gives no preview for a read tool without describe, an unknown name or bad input", () => {
    const registry = summaryImpl();
    expect(previewConfirmation(registry, "get_workspace_summary", {}, store)).toBeNull();
    expect(previewConfirmation(registry, "delete_request", {}, store)).toBeNull();
    expect(previewConfirmation(registry, "get_workspace_summary", { extra: 1 }, store)).toBeNull();
  });

  it("gives no preview when a referenced item is gone", () => {
    const registry = createRegistry([
      {
        name: "delete_requests",
        refs: () => [{ kind: "request", id: "gone" }],
        run: () => ({ ok: true, data: null }),
      },
    ]);
    const missing = { exists: () => false } as unknown as ToolContext["store"];
    expect(previewConfirmation(registry, "delete_requests", { ids: ["gone"] }, missing)).toBeNull();
  });
});

describe("call check against the live registry", () => {
  it("shows no card for a delete that names an item that does not exist", () => {
    expect(awaitsUser("delete_requests", { ids: ["no-such-request"] }, "review")).toBe(false);
  });

  it("shows no card for a name that is not a tool", () => {
    expect(awaitsUser("delete_request", { ids: ["x"] }, "review")).toBe(false);
  });
});

describe("registry guards on the live registry", () => {
  const redact = { secrets: [], variables: [], shareValues: false } as ToolContext["redact"];
  const missingStore = { exists: () => false } as unknown as ToolContext["store"];
  const liveStore = { exists: () => true } as unknown as ToolContext["store"];

  it("reports every invalid field of a malformed call", async () => {
    const result = await executeTool(
      relayToolRegistry,
      "delete_requests",
      { ids: 5 },
      { store: liveStore, redact },
    );
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/^invalid input: ids: /);
  });

  it("reports an input that is not an object as the input itself", async () => {
    const result = await executeTool(relayToolRegistry, "delete_requests", null, {
      store: liveStore,
      redact,
    });
    expect((result as { error: string }).error).toMatch(/^invalid input: input: /);
  });

  it("names the missing entity before asking for approval", async () => {
    const result = await executeTool(
      relayToolRegistry,
      "delete_requests",
      { ids: ["gone"] },
      { store: missingStore, redact, permissionMode: "review" },
    );
    expect(result).toEqual({ ok: false, error: "request not found: gone" });
  });

  it("requires approval for a confirm tool and rejects a hand-built token", async () => {
    const registry = createRegistry([
      { name: "delete_requests", run: () => ({ ok: true, data: "deleted" }) },
    ]);
    const base = { store: liveStore, redact, permissionMode: "review" } as const;
    const call = { ids: ["r1"] };
    expect(await executeTool(registry, "delete_requests", call, base)).toEqual({
      ok: false,
      error: APPROVAL_REQUIRED,
    });
    const forged = Object.freeze({}) as ApprovalToken;
    expect(
      await executeTool(registry, "delete_requests", call, { ...base, approval: forged }),
    ).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    expect(
      await executeTool(registry, "delete_requests", call, { ...base, approval: grantApproval() }),
    ).toEqual({ ok: true, data: "deleted" });
  });

  it("passes refs, validate and describe through to the registered tool", () => {
    const registry = createRegistry([
      {
        name: "delete_requests",
        refs: () => [{ kind: "request", id: "r1" }],
        validate: () => null,
        describe: () => ({
          action: "delete",
          severity: "danger",
          targets: ["Request 1"],
          count: 1,
        }),
        run: () => ({ ok: true, data: null }),
      },
    ]);
    const tool = registry.get("delete_requests");
    expect(tool?.refs({})).toEqual([{ kind: "request", id: "r1" }]);
    expect(tool?.validate?.({}, { store: liveStore, redact })).toBeNull();
    expect(
      previewConfirmation(registry, "delete_requests", { ids: ["r1"] }, liveStore)?.targets,
    ).toEqual(["Request 1"]);
  });

  it("returns a small result unchanged", () => {
    expect(serializeResult({ ok: true, data: { note: "hello" } }, redact)).toEqual({
      ok: true,
      data: { note: "hello" },
    });
  });
});

describe("capability badges follow the live approval rules", () => {
  it("shows no badge for no tools or read-only tools", () => {
    expect(capabilityBadge([], "review")).toBe("runs");
    expect(capabilityBadge(["get_request"], "review")).toBe("runs");
  });

  it("asks when any tool in the group needs approval in review mode", () => {
    expect(capabilityBadge(["get_request", "delete_requests"], "review")).toBe("asks");
  });

  it("marks a group by its strictest tool regardless of order", () => {
    expect(capabilityBadge(["delete_requests", "get_request"], "review")).toBe("asks");
    expect(capabilityBadge(["delete_requests", "get_request"], "skip")).toBe("runs");
  });
});

describe("category badges", () => {
  it("shows no marker for the read area and an ask marker for the organize area in review", () => {
    const byId = (id: string) => CAPABILITY_CATEGORIES.find((entry) => entry.id === id)!;
    expect(categoryBadge(byId("read"), "review")).toBe("runs");
    expect(categoryBadge(byId("organize"), "review")).toBe("asks");
  });
});
