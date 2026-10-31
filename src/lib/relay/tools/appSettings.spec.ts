/** @vitest-environment happy-dom */

import { beforeEach, describe, expect, it } from "vitest";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { appSettingsTools } from "./appSettings";
import { createRegistry, executeTool } from "./registry";

const registry = createRegistry(appSettingsTools);

async function readSettings() {
  const fake = createFakeWriteContext();
  // Calls the tool itself: the registry's own serializer redacts again on top.
  const out = await registry.get("get_app_settings")!.run({}, {
    store: fake.store,
    redact: DEFAULT_REDACT_CONTEXT,
    write: fake.write,
  });
  expect(out.ok).toBe(true);
  return (out as { data: Record<string, any> }).data;
}

const HEADERS = [
  { id: "h1", key: "Authorization", value: "Bearer abc", enabled: true },
  { id: "h2", key: "Accept", value: "text/plain", enabled: true },
];

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.getState().setSetting("proxyUrl", "http://user:hunter2@proxy.test:8080");
  useSettingsStore.getState().setSetting("globalHeaders", HEADERS);
  useSettingsStore.getState().setSetting("globalBaseUrl", "https://api.test");
  useRelayStore.getState().setShareValues(false);
});

describe("get_app_settings", () => {
  it("[success] masks proxy password and secret header values when values are not shared", async () => {
    const data = await readSettings();
    expect(data.proxy.proxyUrl).toBe("http://user:@proxy.test:8080");
    expect(JSON.stringify(data)).not.toContain("hunter2");
    expect(data.global.headers).toEqual([
      { id: "h1", key: "Authorization", value: "", enabled: true },
      HEADERS[1],
    ]);
    expect(data.global.baseUrl).toBe("https://api.test");
  });

  it("[success] shows secret header values when the user shares values, proxy stays masked", async () => {
    useRelayStore.getState().setShareValues(true);
    const data = await readSettings();
    expect(data.global.headers).toEqual(HEADERS);
    expect(data.proxy.proxyUrl).toBe("http://user:@proxy.test:8080");
    expect(data.relay.shareValues).toBe(true);
  });

  it("[success] defaults the theme to dark and reports a stored theme", async () => {
    expect((await readSettings()).theme).toBe("dark");
    localStorage.setItem("theme", "light");
    expect((await readSettings()).theme).toBe("light");
  });

  it("[success] reports the approval mode as read-only", async () => {
    const data = await readSettings();
    expect(data.approvalMode).toEqual({
      value: useRelayPermissionStore.getState().mode,
      readOnly: true,
    });
  });

  it("[invalid] takes no input, so a mode or any other field is rejected", async () => {
    const fake = createFakeWriteContext();
    const out = await executeTool(registry, "get_app_settings", { permissionMode: "skip" }, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
    });
    expect(out.ok).toBe(false);
  });
});
