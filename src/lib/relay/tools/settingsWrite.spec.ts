/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSttConfiguredCache } from "@/hooks/useSttConfigured";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createRegistry, executeTool, grantApproval } from "./registry";
import { requiresDisableApproval } from "./schemas";
import {
  DISABLE_AFTER_TURN,
  disableRelaySpec,
  settingsWriteTools,
} from "./settingsWrite";

const registry = createRegistry(settingsWriteTools);
const fetchMock = vi.fn();

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
  proxyUrl: null,
  sslVerify: null,
  followRedirects: null,
  ...over,
});
const relayInput = (over: Record<string, unknown> = {}) => ({
  shareValues: null,
  speechEngine: null,
  enabled: null,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  resetSttConfiguredCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  settings().setSetting("locale", "en");
  settings().setSetting("proxyUrl", "http://old.test:1");
  settings().setSetting("sslVerify", true);
  settings().setSetting("followRedirects", true);
  settings().setSetting("globalBaseUrl", "https://old.test");
  settings().setSetting("globalHeaders", [
    { id: "o1", key: "X-Old", value: "1", enabled: true },
  ]);
  relay().setShareValues(false);
  relay().setSpeechEngine("browser");
  relay().setEnabled(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const sttConfigured = (configured: boolean) =>
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ configured }) });

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
  it("[success][undo] changes only the given fields and Undo restores all of them", async () => {
    const { run, data, log } = setup();
    const out = await run(
      "update_proxy_settings",
      proxyInput({ proxyUrl: "http://new.test:8080", sslVerify: false }),
    );
    expect(out.ok).toBe(true);
    expect(settings().proxyUrl).toBe("http://new.test:8080");
    expect(settings().sslVerify).toBe(false);
    expect(settings().followRedirects).toBe(true);
    await log.undo(data(out).changeId as string);
    expect(settings().proxyUrl).toBe("http://old.test:1");
    expect(settings().sslVerify).toBe(true);
  });

  it("[success] an empty URL clears the proxy", async () => {
    const { run } = setup();
    expect((await run("update_proxy_settings", proxyInput({ proxyUrl: "" }))).ok).toBe(true);
    expect(settings().proxyUrl).toBe("");
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

  it("[invalid] refuses a URL carrying a password and leaves the proxy alone", async () => {
    const { run, error } = setup();
    const out = await run(
      "update_proxy_settings",
      proxyInput({ proxyUrl: "http://user:hunter2@proxy.test:8080" }),
    );
    expect(out.ok).toBe(false);
    expect(error(out)).toMatch(/password/);
    expect(error(out)).not.toContain("hunter2");
    expect(settings().proxyUrl).toBe("http://old.test:1");
  });

  it("[invalid] refuses a string that is not a URL", async () => {
    const { run, error } = setup();
    const out = await run("update_proxy_settings", proxyInput({ proxyUrl: "not a url" }));
    expect(out.ok).toBe(false);
    expect(error(out)).toMatch(/full URL/);
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

  it("[success] chooses grok when the server has a key", async () => {
    sttConfigured(true);
    const { run } = setup();
    const out = await run("set_relay_preferences", relayInput({ speechEngine: "grok" }));
    expect(out.ok).toBe(true);
    expect(relay().speechEngine).toBe("grok");
  });

  it("[invalid] rejects grok when speech is not configured", async () => {
    sttConfigured(false);
    const { run, error } = setup();
    const out = await run("set_relay_preferences", relayInput({ speechEngine: "grok" }));
    expect(out.ok).toBe(false);
    expect(error(out)).toMatch(/not set up/);
    expect(relay().speechEngine).toBe("browser");
  });

  it("[invalid] rejects grok when the status request fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { run } = setup();
    expect((await run("set_relay_preferences", relayInput({ speechEngine: "grok" }))).ok).toBe(false);
  });

  it("[success] the browser engine needs no status check", async () => {
    relay().setSpeechEngine("grok");
    const { run } = setup();
    await run("set_relay_preferences", relayInput({ speechEngine: "browser" }));
    expect(relay().speechEngine).toBe("browser");
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect((await runUnapproved("set_relay_preferences", relayInput({ shareValues: true }))).ok).toBe(true);
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
