/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createRegistry, executeTool, grantApproval } from "./registry";
import {
  approvalNeeded,
  RELAY_TOOL_SCHEMAS,
  requiresDisableApproval,
  risk,
} from "./schemas";
import {
  DISABLE_AFTER_TURN,
  disableRelaySpec,
  settingsWriteTools,
} from "./settingsWrite";

const registry = createRegistry(settingsWriteTools);

function setup() {
  const fake = createFakeWriteContext();
  const run = (name: string, input: unknown) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
      approval: grantApproval(),
    });
  const runUnapproved = (name: string, input: unknown) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
    });
  const data = (out: Awaited<ReturnType<typeof run>>) =>
    (out as { data: Record<string, unknown> }).data;
  const error = (out: Awaited<ReturnType<typeof run>>) =>
    (out as { error: string }).error;
  return { ...fake, run, runUnapproved, data, error };
}

const settings = () => useSettingsStore.getState();
const relay = () => useRelayStore.getState();

const proxyInput = (over: Record<string, unknown> = {}) => ({
  sslVerify: null,
  followRedirects: null,
  ...over,
});
const relayInput = (over: Record<string, unknown> = {}) => ({
  shareValues: null,
  enabled: null,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  settings().setSetting("locale", "en");
  settings().setSetting("proxyUrl", "http://old.test:1");
  settings().setSetting("sslVerify", true);
  settings().setSetting("followRedirects", true);
  settings().setSetting("globalBaseUrl", "https://old.test");
  settings().setSetting("globalHeaders", [
    { id: "o1", key: "X-Old", value: "1", enabled: true },
  ]);
  relay().setShareValues(false);
  relay().setEnabled(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("set_theme", () => {
  it("[success] stores the theme and Undo restores the previous one", async () => {
    localStorage.setItem("theme", "light");
    const { run, data, log } = setup();
    const out = await run("set_theme", { theme: "system" });
    expect(out.ok).toBe(true);
    expect(localStorage.getItem("theme")).toBe("system");
    expect(data(out).summary).toBe("Switched the theme to the system setting");
    expect(data(out).entityId).toBe("appearance");
    await log.undo(data(out).changeId as string);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("[success][undo] Undo removes the key when no theme was stored", async () => {
    const { run, data, log } = setup();
    const out = await run("set_theme", { theme: "dark" });
    expect(localStorage.getItem("theme")).toBe("dark");
    await log.undo(data(out).changeId as string);
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("[invalid] rejects an unknown theme", async () => {
    const { run } = setup();
    expect((await run("set_theme", { theme: "neon" })).ok).toBe(false);
    expect(localStorage.getItem("theme")).toBeNull();
  });
});

describe("set_language", () => {
  it("[success][undo] sets the locale and Undo restores it", async () => {
    const { run, data, log } = setup();
    const out = await run("set_language", { locale: "ja" });
    expect(settings().locale).toBe("ja");
    expect(data(out).summary).toBe("Changed the language to Japanese");
    await log.undo(data(out).changeId as string);
    expect(settings().locale).toBe("en");
  });

  it("[invalid] rejects an unsupported locale", async () => {
    const { run } = setup();
    expect((await run("set_language", { locale: "de" })).ok).toBe(false);
    expect(settings().locale).toBe("en");
  });
});

describe("update_proxy_settings", () => {
  it("[success][undo] changes only the given fields and Undo restores them", async () => {
    const { run, data, log } = setup();
    const out = await run("update_proxy_settings", proxyInput({ sslVerify: false }));
    expect(out.ok).toBe(true);
    expect(settings().sslVerify).toBe(false);
    expect(settings().followRedirects).toBe(true);
    expect(settings().proxyUrl).toBe("http://old.test:1");
    await log.undo(data(out).changeId as string);
    expect(settings().sslVerify).toBe(true);
  });

  it("[success] changes a boolean alone", async () => {
    const { run } = setup();
    await run("update_proxy_settings", proxyInput({ followRedirects: false }));
    expect(settings().followRedirects).toBe(false);
    expect(settings().proxyUrl).toBe("http://old.test:1");
  });

  it("[invalid] refuses when every field is null", async () => {
    const { run, error } = setup();
    const out = await run("update_proxy_settings", proxyInput());
    expect(out.ok).toBe(false);
    expect(error(out)).toMatch(/nothing to change/);
  });

  it("[invalid] rejects proxyUrl: the user sets it in Settings", async () => {
    const { run } = setup();
    const out = await run(
      "update_proxy_settings",
      proxyInput({ proxyUrl: "http://new.test:8080" }),
    );
    expect(out.ok).toBe(false);
    expect(settings().proxyUrl).toBe("http://old.test:1");
  });
});

describe("set_global_variables", () => {
  it("[success][undo] sets base URL and headers (enabled defaults to true) and Undo restores both", async () => {
    const { run, data, log } = setup();
    const out = await run("set_global_variables", {
      baseUrl: "https://new.test",
      headers: [
        { key: "Accept", value: "json", enabled: null },
        { key: "X-Off", value: "1", enabled: false },
      ],
    });
    expect(out.ok).toBe(true);
    expect(settings().globalBaseUrl).toBe("https://new.test");
    expect(
      settings().globalHeaders.map((h) => [h.key, h.value, h.enabled]),
    ).toEqual([
      ["Accept", "json", true],
      ["X-Off", "1", false],
    ]);
    await log.undo(data(out).changeId as string);
    expect(settings().globalBaseUrl).toBe("https://old.test");
    expect(settings().globalHeaders.map((h) => h.key)).toEqual(["X-Old"]);
  });

  it("[success] leaves headers alone when only the base URL is given", async () => {
    const { run } = setup();
    await run("set_global_variables", { baseUrl: "https://b.test", headers: null });
    expect(settings().globalHeaders.map((h) => h.key)).toEqual(["X-Old"]);
  });

  it("[success] leaves the base URL alone when only headers are given", async () => {
    const { run } = setup();
    await run("set_global_variables", {
      baseUrl: null,
      headers: [{ key: "Accept", value: "json", enabled: true }],
    });
    expect(settings().globalBaseUrl).toBe("https://old.test");
  });

  it("[invalid] refuses when both parts are null", async () => {
    const { run, error } = setup();
    const out = await run("set_global_variables", { baseUrl: null, headers: null });
    expect(out.ok).toBe(false);
    expect(error(out)).toMatch(/nothing to change/);
  });

  it("[invalid] refuses a secret header with a value, case-insensitively", async () => {
    const { run, error } = setup();
    const out = await run("set_global_variables", {
      baseUrl: null,
      headers: [{ key: "AUTHORIZATION", value: "Bearer x", enabled: null }],
    });
    expect(out.ok).toBe(false);
    expect(error(out)).toContain("AUTHORIZATION");
    expect(settings().globalHeaders.map((h) => h.key)).toEqual(["X-Old"]);
  });

  it("[success] allows a secret header with an empty value", async () => {
    const { run } = setup();
    const out = await run("set_global_variables", {
      baseUrl: null,
      headers: [{ key: "Authorization", value: "", enabled: null }],
    });
    expect(out.ok).toBe(true);
  });
});

describe("set_relay_preferences", () => {
  it("[success][undo] changes shareValues and Undo restores it", async () => {
    const { run, data, log } = setup();
    const out = await run("set_relay_preferences", relayInput({ shareValues: true }));
    expect(out.ok).toBe(true);
    expect(relay().shareValues).toBe(true);
    expect(DISABLE_AFTER_TURN in data(out)).toBe(false);
    await log.undo(data(out).changeId as string);
    expect(relay().shareValues).toBe(false);
  });

  it("[success] enabled true is applied now", async () => {
    relay().setEnabled(false);
    const { run } = setup();
    await run("set_relay_preferences", relayInput({ enabled: true }));
    expect(relay().enabled).toBe(true);
  });

  it("[invalid] the preferences schema rejects speechEngine", () => {
    const schema = RELAY_TOOL_SCHEMAS.set_relay_preferences.inputSchema;
    expect(schema.safeParse(relayInput({ speechEngine: "browser" })).success).toBe(false);
  });

  it("[success] enabled false defers turning off and leaves Relay on now", async () => {
    const { run, data } = setup();
    const out = await run("set_relay_preferences", relayInput({ enabled: false }));
    expect(out).toMatchObject({ ok: true });
    expect(data(out)[DISABLE_AFTER_TURN]).toBe(true);
    expect(data(out).summary).toBe("Relay will turn off when this reply ends");
    expect(relay().enabled).toBe(true);
  });

  it("[success] enabled false with other changes applies those and still defers", async () => {
    const { run, data } = setup();
    const out = await run(
      "set_relay_preferences",
      relayInput({ enabled: false, shareValues: true }),
    );
    expect(relay().shareValues).toBe(true);
    expect(relay().enabled).toBe(true);
    expect(data(out)[DISABLE_AFTER_TURN]).toBe(true);
    expect(data(out).changeId).toBeTruthy();
  });

  it("[invalid] asks for approval before turning Relay off, and not for other changes", async () => {
    const { runUnapproved } = setup();
    const off = await runUnapproved("set_relay_preferences", relayInput({ enabled: false }));
    expect(off).toEqual({ ok: false, error: "approval required" });
    expect((await runUnapproved("set_relay_preferences", relayInput({ shareValues: false }))).ok).toBe(true);
  });

  it("[invalid] refuses when every field is null", async () => {
    const { run, error } = setup();
    const out = await run("set_relay_preferences", relayInput());
    expect(out.ok).toBe(false);
    expect(error(out)).toMatch(/nothing to change/);
  });

  it("[invalid] rejects permissionMode and leaves the approval mode untouched", async () => {
    const before = useRelayPermissionStore.getState().mode;
    const { run } = setup();
    const out = await run(
      "set_relay_preferences",
      relayInput({ shareValues: true, permissionMode: "skip" }),
    );
    expect(out.ok).toBe(false);
    expect(relay().shareValues).toBe(false);
    expect(useRelayPermissionStore.getState().mode).toBe(before);
  });

  it("requires confirmation only for enabled: false", () => {
    expect(requiresDisableApproval("set_relay_preferences", relayInput({ enabled: false }))).toBe(true);
    expect(requiresDisableApproval("set_relay_preferences", relayInput({ enabled: true }))).toBe(false);
    expect(requiresDisableApproval("set_theme", { enabled: false })).toBe(false);
  });
});

describe("disableRelaySpec", () => {
  it("[success] turns Relay off and Undo turns it back on", async () => {
    const { log, origin } = setup().write;
    const result = await log.apply(origin, disableRelaySpec());
    expect(result.ok).toBe(true);
    expect(relay().enabled).toBe(false);
    await log.undo((result as { change: { id: string } }).change.id);
    expect(relay().enabled).toBe(true);
  });
});

describe("Review-only escalation of auto settings tools (HH-M05, HH-M06, L-05)", () => {
  const globalInput = (over: Record<string, unknown> = {}) => ({
    baseUrl: null,
    headers: null,
    ...over,
  });
  const header = (key: string, value: string, enabled: boolean | null = true) => ({
    key,
    value,
    enabled,
  });

  it("[success] turning sslVerify off asks in Review and not in Skip", () => {
    const input = proxyInput({ sslVerify: false });
    expect(risk("update_proxy_settings", input)).toBe("escalate");
    expect(approvalNeeded("update_proxy_settings", input, "review")).toBe(true);
    expect(approvalNeeded("update_proxy_settings", input, "skip")).toBe(false);
  });

  it("[success] turning sslVerify on or changing redirects stays automatic", () => {
    expect(approvalNeeded("update_proxy_settings", proxyInput({ sslVerify: true }), "review")).toBe(false);
    expect(approvalNeeded("update_proxy_settings", proxyInput({ followRedirects: false }), "review")).toBe(false);
  });

  it("[success] changing the base url escalates in Review only", () => {
    const input = globalInput({ baseUrl: "https://evil.test" });
    expect(approvalNeeded("set_global_variables", input, "review")).toBe(true);
    expect(approvalNeeded("set_global_variables", input, "skip")).toBe(false);
  });

  it("[success] re-sending the unchanged base url, ignoring whitespace, stays automatic", () => {
    expect(risk("set_global_variables", globalInput({ baseUrl: " https://old.test " }))).toBe("low");
  });

  it("[success] adding or changing a global header escalates", () => {
    expect(risk("set_global_variables", globalInput({ headers: [header("X-Old", "1"), header("X-New", "2")] }))).toBe("escalate");
    expect(risk("set_global_variables", globalInput({ headers: [header("x-old", "changed")] }))).toBe("escalate");
  });

  it("[success] re-enabling a disabled global header escalates", () => {
    settings().setSetting("globalHeaders", [{ id: "o1", key: "X-Old", value: "1", enabled: false }]);
    expect(risk("set_global_variables", globalInput({ headers: [header("X-Old", "1", true)] }))).toBe("escalate");
    expect(risk("set_global_variables", globalInput({ headers: [header("X-Old", "1", null)] }))).toBe("escalate");
    expect(risk("set_global_variables", globalInput({ headers: [header("X-Old", "1", false)] }))).toBe("low");
  });

  it("[success] removing a global header is automatic", () => {
    expect(risk("set_global_variables", globalInput({ headers: [] }))).toBe("low");
    expect(approvalNeeded("set_global_variables", globalInput({ headers: [] }), "review")).toBe(false);
  });

  it("[success] keeping a header as it is stays automatic", () => {
    expect(risk("set_global_variables", globalInput({ headers: [header("X-OLD", "1")] }))).toBe("low");
  });

  it.each(["export_history", "export_postman"])(
    "[success] %s asks in Review and not in Skip (L-05)",
    (name) => {
      expect(approvalNeeded(name, {}, "review")).toBe(true);
      expect(approvalNeeded(name, {}, "skip")).toBe(false);
    },
  );

  it("[success] a tool with no risk row is low", () => {
    expect(risk("set_theme", { theme: "dark" })).toBe("low");
    expect(risk("not_a_tool", {})).toBe("low");
  });

  it("[success] shareValues true escalates in Review, false does not", () => {
    expect(approvalNeeded("set_relay_preferences", relayInput({ shareValues: true }), "review")).toBe(true);
    expect(approvalNeeded("set_relay_preferences", relayInput({ shareValues: false }), "review")).toBe(false);
  });
});

describe("set_global_variables base url validation", () => {
  it("[invalid] refuses a base url that is not an http(s) address", async () => {
    const { run } = setup();
    const out = await run("set_global_variables", { baseUrl: "javascript:alert(1)", headers: null });
    expect(out.ok).toBe(false);
    expect(settings().globalBaseUrl).toBe("https://old.test");
  });
});

describe("update_proxy_settings undo snapshot", () => {
  it("[success][undo] Undo restores every proxy group key, leaving the user's proxyUrl as it was", async () => {
    const { run, data, log } = setup();
    const out = await run(
      "update_proxy_settings",
      proxyInput({ sslVerify: false, followRedirects: false }),
    );
    expect(settings().proxyUrl).toBe("http://old.test:1");
    await log.undo(data(out).changeId as string);
    expect(settings().sslVerify).toBe(true);
    expect(settings().followRedirects).toBe(true);
    expect(settings().proxyUrl).toBe("http://old.test:1");
  });
});
