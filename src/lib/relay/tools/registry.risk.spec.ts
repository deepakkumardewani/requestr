/** @vitest-environment happy-dom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { RelayPermissionMode } from "../permission";
import { buildRedactContext, DEFAULT_REDACT_CONTEXT, REDACTED } from "../redact";
import { ENV_SECRET_VALUE, JWT_SECRET } from "../redact.corpus";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import {
  APPROVAL_REQUIRED,
  executeTool,
  grantApproval,
  type RegisteredTool,
  createRegistry,
  previewConfirmation,
  relayToolRegistry,
  type ToolRegistry,
} from "./registry";
import { awaitsUser, RELAY_TOOL_SCHEMAS } from "./schemas";

/**
 * HH-RISK, HH-H03, HH-H04, L-07 through the real registry: an escalating
 * `auto` call is held for a card in Review exactly like a `confirm` call.
 */

const SCRIPT = 'pm.environment.set("ts", Date.now());';

const baseRequest = (id: string) => ({
  id,
  collectionId: "c1",
  folderId: null,
  name: `Req ${id}`,
  method: "GET" as const,
  url: "https://api.test/orders",
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

const environment = {
  id: "e1",
  name: "Prod",
  createdAt: 1,
  updatedAt: 1,
  variables: [
    { id: "v1", key: "host", initialValue: "api.test", currentValue: "api.test", isSecret: false },
    { id: "v2", key: "key", initialValue: "", currentValue: ENV_SECRET_VALUE, isSecret: true },
  ],
};

function setup() {
  const fake = createFakeWriteContext({
    collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
    requests: [baseRequest("r1")],
    environments: [environment],
  } as never);
  const run = (
    name: string,
    input: unknown,
    mode: RelayPermissionMode,
    approved = false,
    redact = DEFAULT_REDACT_CONTEXT,
  ) =>
    executeTool(relayToolRegistry, name, input, {
      store: fake.store,
      redact,
      write: fake.write,
      permissionMode: mode,
      ...(approved ? { approval: grantApproval() } : {}),
    });
  const request = () => fake.state.requests.find((r) => r.id === "r1")!;
  return { ...fake, run, request };
}

const scripts = (over: Record<string, unknown> = {}) => ({
  requestId: "r1",
  pre: SCRIPT,
  post: null,
  ...over,
});
const prefs = (over: Record<string, unknown> = {}) => ({
  shareValues: null,
  enabled: null,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  useRelayStore.getState().setShareValues(false);
  useRelayStore.getState().setEnabled(true);
  useSettingsStore.getState().setSetting("sslVerify", true);
});

describe("set_request_scripts across modes (HH-H03)", () => {
  it("Review: refuses without approval and writes nothing", async () => {
    const { run, request } = setup();
    expect(await run("set_request_scripts", scripts(), "review")).toEqual({
      ok: false,
      error: APPROVAL_REQUIRED,
    });
    expect(request().preScript).toBe("");
  });

  it("Review: writes once approved", async () => {
    const { run, request } = setup();
    expect((await run("set_request_scripts", scripts(), "review", true)).ok).toBe(true);
    expect(request().preScript).toBe(SCRIPT);
  });

  it("Always-ask: refuses without approval", async () => {
    const { run, request } = setup();
    expect(await run("set_request_scripts", scripts(), "always-ask")).toMatchObject({
      error: APPROVAL_REQUIRED,
    });
    expect(request().preScript).toBe("");
  });

  it("Skip: writes with no approval", async () => {
    const { run, request } = setup();
    expect((await run("set_request_scripts", scripts({ post: "pm.test()" }), "skip")).ok).toBe(true);
    expect(request().preScript).toBe(SCRIPT);
    expect(request().postScript).toBe("pm.test()");
  });

  it.each(["review", "skip", "always-ask"] as const)(
    "%s: a token-shaped literal is refused as script_contains_secret even when approved",
    async (mode) => {
      const { run, request } = setup();
      const out = await run(
        "set_request_scripts",
        scripts({ pre: `const t = "${JWT_SECRET}";` }),
        mode,
        true,
      );
      expect(out).toMatchObject({ ok: false });
      expect((out as { error: string }).error).toContain("script_contains_secret");
      expect(request().preScript).toBe("");
    },
  );

  it("refuses a Basic credential literal but not prose about basic auth", async () => {
    const { run } = setup();
    const out = await run(
      "set_request_scripts",
      scripts({ pre: 'pm.request.headers.add({key:"Authorization",value:"Basic dXNlcjpwYXNzd29yZA=="})' }),
      "skip",
    );
    expect((out as { error: string }).error).toContain("script_contains_secret");
    const prose = await run(
      "set_request_scripts",
      scripts({ pre: "// basic authentication handled upstream" }),
      "skip",
    );
    expect(prose.ok).toBe(true);
  });

  it("refuses a secret in the post script too", async () => {
    const { run } = setup();
    const out = await run(
      "set_request_scripts",
      scripts({ pre: null, post: "fetch(u, {headers:{Authorization:'Bearer abcdef123456'}})" }),
      "skip",
    );
    expect((out as { error: string }).error).toContain("script_contains_secret");
  });

  it("accepts a variable reference and code that merely names a token", async () => {
    const { run, request } = setup();
    const pre = 'const token = pm.environment.get("{{token}}");';
    expect((await run("set_request_scripts", scripts({ pre }), "skip")).ok).toBe(true);
    expect(request().preScript).toBe(pre);
  });

  it("the description no longer claims scripts are never run, and says approval is needed", () => {
    const { description } = RELAY_TOOL_SCHEMAS.set_request_scripts;
    expect(description).not.toMatch(/never run/i);
    expect(description).toMatch(/run when the request is sent/i);
    expect(description).toMatch(/Review mode/);
    expect(description).toMatch(/\{\{variable\}\}/);
  });

  it("the card carries the full script text and the request name", () => {
    const { store } = setup();
    const preview = previewConfirmation(
      relayToolRegistry,
      "set_request_scripts",
      scripts({ post: "pm.test('ok')" }),
      store,
    );
    expect(preview).toMatchObject({ action: "change", severity: "caution", targets: ["Req r1"], count: 1 });
    expect(preview?.detail).toBe(`Pre-request script:\n${SCRIPT}\n\nPost-response script:\npm.test('ok')`);
  });

  it("the card shows only the script being written, and falls back to the id for a missing request", () => {
    const { store } = setup();
    const post = previewConfirmation(
      relayToolRegistry,
      "set_request_scripts",
      scripts({ requestId: "gone", pre: null, post: "x()" }),
      store,
    );
    expect(post?.targets).toEqual(["gone"]);
    expect(post?.detail).toBe("Post-response script:\nx()");
  });
});

describe("awaitsUser agrees with runValidated for every escalating tool", () => {
  const CASES: [string, unknown][] = [
    ["set_request_scripts", scripts()],
    ["update_proxy_settings", { sslVerify: false, followRedirects: null }],
    ["export_history", { format: "json" }],
    ["export_postman", { collectionId: "c1" }],
    ["set_relay_preferences", prefs({ shareValues: true })],
  ];

  /** A registry whose `run` is a spy, so an unheld call cannot touch the real stores or disk. */
  function spied() {
    const runs = new Map<string, ReturnType<typeof vi.fn>>();
    const entries = [...relayToolRegistry].map(([name, tool]): [string, RegisteredTool] => {
      const run = vi.fn(async () => ({ ok: true as const, data: {} }));
      runs.set(name, run);
      return [name, { ...tool, run, refs: () => [] }];
    });
    return { registry: new Map(entries) as ToolRegistry, runs };
  }

  it.each(CASES)("%s: held exactly when awaitsUser says so, in every mode", async (name, input) => {
    for (const mode of ["review", "skip", "always-ask"] as const) {
      const { registry, runs } = spied();
      const out = await executeTool(registry, name, input, {
        store: setup().store,
        redact: DEFAULT_REDACT_CONTEXT,
        permissionMode: mode,
      });
      const held = !out.ok && out.error === APPROVAL_REQUIRED;
      expect(held, `${name} in ${mode}`).toBe(awaitsUser(name, input, mode));
      expect(runs.get(name)).toHaveBeenCalledTimes(held ? 0 : 1);
    }
  });

  it.each(CASES)("%s: Review shows a card payload", (name, input) => {
    expect(previewConfirmation(relayToolRegistry, name, input, setup().store)).not.toBeNull();
  });
});

describe("non-escalating input is untouched", () => {
  it("shareValues false and enabled false skip the Review card for shareValues", async () => {
    const { run } = setup();
    expect((await run("set_relay_preferences", prefs({ shareValues: false }), "review")).ok).toBe(true);
  });

  it("sslVerify true runs in Review with no card", async () => {
    const { run } = setup();
    expect((await run("update_proxy_settings", { sslVerify: true, followRedirects: null }, "review")).ok).toBe(true);
  });

  it("Always-ask still holds a non-escalating auto call", async () => {
    const { run } = setup();
    expect(await run("update_proxy_settings", { sslVerify: true, followRedirects: null }, "always-ask")).toMatchObject({
      error: APPROVAL_REQUIRED,
    });
  });
});

describe("shareValues (HH-H04, L-07)", () => {
  const envOf = (shareValues: boolean) => buildRedactContext([environment] as never, shareValues);

  it("Review: Deny leaves the preference false and get_environment stays masked", async () => {
    const { run } = setup();
    const held = await run("set_relay_preferences", prefs({ shareValues: true }), "review");
    expect(held).toMatchObject({ ok: false, error: APPROVAL_REQUIRED });
    expect(useRelayStore.getState().shareValues).toBe(false);

    const out = await run(
      "get_environment",
      { environmentId: "e1" },
      "review",
      false,
      envOf(useRelayStore.getState().shareValues),
    );
    const variables = (out as { data: { variables: object[] } }).data.variables;
    expect(variables).toEqual([
      { key: "host", isSecret: false, hasValue: true },
      { key: "key", isSecret: true, hasValue: true },
    ]);
    expect(JSON.stringify(out)).not.toContain(ENV_SECRET_VALUE);
  });

  it("Review: Approve turns it on, shows non-secret values and still masks secrets", async () => {
    const { run } = setup();
    expect((await run("set_relay_preferences", prefs({ shareValues: true }), "review", true)).ok).toBe(true);
    expect(useRelayStore.getState().shareValues).toBe(true);
    const out = await run("get_environment", { environmentId: "e1" }, "review", false, envOf(true));
    expect((out as { data: { variables: object[] } }).data.variables).toEqual([
      { key: "host", isSecret: false, hasValue: true, value: "api.test" },
      { key: "key", isSecret: true, hasValue: true, value: REDACTED },
    ]);
    expect(JSON.stringify(out)).not.toContain(ENV_SECRET_VALUE);
  });

  it("Skip: applies true with no card", async () => {
    const { run } = setup();
    expect((await run("set_relay_preferences", prefs({ shareValues: true }), "skip")).ok).toBe(true);
    expect(useRelayStore.getState().shareValues).toBe(true);
  });

  it("enabled:false still needs approval in Review and not in Skip (unchanged)", async () => {
    const { run } = setup();
    expect(await run("set_relay_preferences", prefs({ enabled: false }), "review")).toMatchObject({
      error: APPROVAL_REQUIRED,
    });
    expect((await run("set_relay_preferences", prefs({ enabled: false }), "skip")).ok).toBe(true);
  });

  it("get_environment and the attached-context description share one shape", async () => {
    const { run, store } = setup();
    const shared = envOf(true);
    const tool = await run("get_environment", { environmentId: "e1" }, "skip", false, shared);
    const { active, ...fromTool } = (tool as { data: Record<string, unknown> }).data;
    expect(active).toBe(false);
    const direct = await executeTool(
      relayToolRegistry,
      "get_active_context",
      {},
      {
        store,
        redact: shared,
        attached: [{ kind: "environment", id: "e1", label: "Prod" }],
      },
    );
    const [item] = (direct as { data: { attached: Record<string, unknown>[] } }).data.attached;
    const { kind, ...fromContext } = item;
    expect(kind).toBe("environment");
    expect(fromContext).toEqual(fromTool);
  });
});

describe("several escalating calls in one turn and mode flips", () => {
  it("each call is held on its own: toggling shareValues true, false, true gives two cards", () => {
    const inputs = [prefs({ shareValues: true }), prefs({ shareValues: false }), prefs({ shareValues: true })];
    expect(inputs.map((input) => awaitsUser("set_relay_preferences", input, "review"))).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("one approval releases only the call it was granted for", async () => {
    const { run } = setup();
    const first = await run("set_relay_preferences", prefs({ shareValues: true }), "review", true);
    const second = await run("export_history", { format: "json" }, "review");
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ error: APPROVAL_REQUIRED });
  });

  it("the mode is read per call from the context, so a held call stays held until approved", async () => {
    const { run, request } = setup();
    expect(await run("set_request_scripts", scripts(), "review")).toMatchObject({ error: APPROVAL_REQUIRED });
    expect(request().preScript).toBe("");
    expect((await run("set_request_scripts", scripts(), "review", true)).ok).toBe(true);
    expect(request().preScript).toBe(SCRIPT);
  });

  it("a confirm tool is asked once: one approval deletes, with no second prompt", async () => {
    const { run, state } = setup();
    expect(awaitsUser("delete_request", { ids: ["r1"] }, "review")).toBe(true);
    expect(await run("delete_request", { ids: ["r1"] }, "review")).toMatchObject({ error: APPROVAL_REQUIRED });
    expect(state.requests).toHaveLength(1);
    expect((await run("delete_request", { ids: ["r1"] }, "review", true)).ok).toBe(true);
    expect(state.requests).toHaveLength(0);
  });
});

describe("executeTool guarantees around the gate", () => {
  it("answers an unknown tool without throwing", async () => {
    const { run } = setup();
    expect(await run("rename_the_universe", {}, "skip")).toEqual({
      ok: false,
      error: "unknown tool: rename_the_universe",
    });
  });

  it("reports every validation issue, naming the field or 'input' for whole-object issues", async () => {
    const { run } = setup();
    const out = await run("export_history", { format: "xml", extra: 1 }, "skip");
    expect(out).toMatchObject({ ok: false });
    expect((out as { error: string }).error).toMatch(/^invalid input: /);
    expect((out as { error: string }).error).toContain("format: ");
    expect((out as { error: string }).error).toContain("input: ");
  });

  it("checks the approval before it looks for the entity, and the entity before it runs", async () => {
    const { run } = setup();
    const missing = scripts({ requestId: "gone" });
    expect(await run("set_request_scripts", missing, "review")).toMatchObject({ error: APPROVAL_REQUIRED });
    expect(await run("set_request_scripts", missing, "review", true)).toEqual({
      ok: false,
      error: "request not found: gone",
    });
  });

  it("turns a throwing tool into a generic failure and logs it with context", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const registry = createRegistry([
      {
        name: "set_theme",
        run: () => {
          throw new Error("boom");
        },
      },
    ]);
    const out = await executeTool(registry, "set_theme", { theme: "dark" }, {
      store: setup().store,
      redact: DEFAULT_REDACT_CONTEXT,
      permissionMode: "skip",
    });
    expect(out).toEqual({ ok: false, error: "the tool failed unexpectedly" });
    expect(error).toHaveBeenCalledWith("[relay] tool failed", expect.objectContaining({ tool: "set_theme" }));
    error.mockRestore();
  });

  it("redacts every result before it leaves, even a successful one", async () => {
    const registry = createRegistry([
      { name: "set_theme", run: () => ({ ok: true, data: { echo: `Bearer ${"q".repeat(12)}` } }) },
    ]);
    const out = await executeTool(registry, "set_theme", { theme: "dark" }, {
      store: setup().store,
      redact: DEFAULT_REDACT_CONTEXT,
      permissionMode: "skip",
    });
    expect(out).toEqual({ ok: true, data: { echo: `Bearer ${REDACTED}` } });
  });

  it("previewConfirmation is null for an unknown tool, a malformed call and a confirm tool with no describe", () => {
    const { store } = setup();
    expect(previewConfirmation(relayToolRegistry, "rename_the_universe", {}, store)).toBeNull();
    expect(previewConfirmation(relayToolRegistry, "export_history", { format: "xml" }, store)).toBeNull();
    const bare = createRegistry([{ name: "clear_history", run: () => ({ ok: true, data: {} }) }]);
    expect(previewConfirmation(bare, "clear_history", {}, store)).toBeNull();
    expect(previewConfirmation(bare, "export_history", { format: "json" }, store)).toBeNull();
  });
});
