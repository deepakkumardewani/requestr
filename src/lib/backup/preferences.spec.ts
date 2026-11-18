/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { BACKUP_PREFERENCE_KEYS, readPreferences, writePreferences } from "./preferences";

const EXCLUDED = [
  "rq_anon_id",
  "rq_onboarding_complete",
  "rq_relay_open",
  "rq_relay_width",
  "rq_relay_active_thread",
  "rq_relay_onboarded",
  "rq_relay_recent",
  "rq_chain_abc",
];

describe("preferences", () => {
  beforeEach(() => localStorage.clear());

  it("lists exactly the eight allow-listed keys", () => {
    expect([...BACKUP_PREFERENCE_KEYS].sort()).toEqual(
      [
        "requestly_active_env_id",
        "rq_collapsed_folders",
        "rq_sidebar_open_sections",
        "requestly_imported_hub_slugs",
        "rq_relay_enabled",
        "rq_relay_permission_mode",
        "rq_relay_share_values",
        "rq_relay_speech_engine",
      ].sort(),
    );
  });

  it("reads nothing from empty storage", () => {
    expect(readPreferences()).toEqual({});
  });

  it("reads only allow-listed keys that hold a value", () => {
    localStorage.setItem("rq_collapsed_folders", "[1]");
    localStorage.setItem("rq_relay_enabled", "");
    for (const key of EXCLUDED) localStorage.setItem(key, "secret");
    expect(readPreferences()).toEqual({
      rq_collapsed_folders: "[1]",
      rq_relay_enabled: "",
    });
  });

  it("writes allow-listed keys and ignores the rest", () => {
    writePreferences({
      requestly_active_env_id: "env-1",
      rq_anon_id: "evil",
      rq_relay_open: "true",
    });
    expect(localStorage.getItem("requestly_active_env_id")).toBe("env-1");
    expect(localStorage.getItem("rq_anon_id")).toBeNull();
    expect(localStorage.getItem("rq_relay_open")).toBeNull();
  });

  it("marks onboarding complete even with no preferences", () => {
    writePreferences({});
    expect(localStorage.getItem("rq_onboarding_complete")).toBe("true");
  });

  it("overrides a stale onboarding value supplied by the file", () => {
    writePreferences({ rq_onboarding_complete: "false" });
    expect(localStorage.getItem("rq_onboarding_complete")).toBe("true");
  });

  it("round-trips through read after write without leaking onboarding", () => {
    const prefs = { rq_sidebar_open_sections: "[\"a\"]", rq_relay_speech_engine: "web" };
    writePreferences(prefs);
    expect(readPreferences()).toEqual(prefs);
  });
});
