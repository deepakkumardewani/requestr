import { afterEach, describe, expect, it, vi } from "vitest";
import { type ConsentEnv, readConsentEnv, resolveConsent } from "./consent";

const prodEnv: ConsentEnv = {
  analyticsFlag: "true",
  nodeEnv: "production",
  webdriver: false,
  doNotTrack: false,
  gpc: false,
  toggleEnabled: true,
  e2eOverride: false,
};

const resolve = (patch: Partial<ConsentEnv>) =>
  resolveConsent({ ...prodEnv, ...patch });

describe("resolveConsent", () => {
  it("enables analytics in a clean production environment", () => {
    expect(resolve({})).toEqual({ enabled: true, reason: "enabled" });
  });

  it.each<[string, Partial<ConsentEnv>, string]>([
    ["Do-Not-Track", { doNotTrack: true }, "dnt"],
    ["Global Privacy Control", { gpc: true }, "gpc"],
    ["the settings toggle being off", { toggleEnabled: false }, "toggle_off"],
    ["the env flag being unset", { analyticsFlag: undefined }, "env_off"],
    ["the env flag not being 'true'", { analyticsFlag: "false" }, "env_off"],
    ["development mode", { nodeEnv: "development" }, "development"],
    ["test mode", { nodeEnv: "test" }, "test"],
    ["webdriver automation", { webdriver: true }, "webdriver"],
  ])("disables on %s", (_label, patch, reason) => {
    expect(resolve(patch)).toEqual({ enabled: false, reason });
  });

  describe("e2e override", () => {
    it.each(["development", "test", undefined])(
      "enables outside production (nodeEnv=%s) even without the env flag",
      (nodeEnv) => {
        expect(
          resolve({
            e2eOverride: true,
            nodeEnv,
            analyticsFlag: undefined,
            webdriver: true,
          }),
        ).toEqual({ enabled: true, reason: "override" });
      },
    );

    it("is ignored in production", () => {
      expect(
        resolve({ e2eOverride: true, analyticsFlag: undefined }),
      ).toEqual({ enabled: false, reason: "env_off" });
      expect(resolve({ e2eOverride: true, webdriver: true })).toEqual({
        enabled: false,
        reason: "webdriver",
      });
    });

    it("still reports a plain enabled result in production when everything else allows it", () => {
      expect(resolve({ e2eOverride: true })).toEqual({
        enabled: true,
        reason: "enabled",
      });
    });

    it.each(["development", "test", "production"])(
      "never bypasses Do-Not-Track, GPC or the toggle (nodeEnv=%s)",
      (nodeEnv) => {
        expect(resolve({ e2eOverride: true, nodeEnv, doNotTrack: true })).toEqual(
          { enabled: false, reason: "dnt" },
        );
        expect(resolve({ e2eOverride: true, nodeEnv, gpc: true })).toEqual({
          enabled: false,
          reason: "gpc",
        });
        expect(
          resolve({ e2eOverride: true, nodeEnv, toggleEnabled: false }),
        ).toEqual({ enabled: false, reason: "toggle_off" });
      },
    );
  });

  it("gives Do-Not-Track precedence over GPC and the toggle", () => {
    expect(
      resolve({ doNotTrack: true, gpc: true, toggleEnabled: false }).reason,
    ).toBe("dnt");
    expect(resolve({ gpc: true, toggleEnabled: false }).reason).toBe("gpc");
  });
});

describe("readConsentEnv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads safe defaults when no browser globals exist", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(readConsentEnv(true)).toEqual({
      analyticsFlag: "true",
      nodeEnv: "production",
      webdriver: false,
      doNotTrack: false,
      gpc: false,
      toggleEnabled: true,
      e2eOverride: false,
    });
  });

  it("falls back to safe defaults when navigator and window are undefined", () => {
    vi.stubGlobal("navigator", undefined);
    vi.stubGlobal("window", undefined);
    expect(readConsentEnv(true)).toMatchObject({
      webdriver: false,
      doNotTrack: false,
      gpc: false,
      e2eOverride: false,
    });
  });

  it("reads navigator and window signals", () => {
    vi.stubGlobal("navigator", {
      webdriver: true,
      doNotTrack: "1",
      globalPrivacyControl: true,
    });
    vi.stubGlobal("window", { __RQ_ANALYTICS_E2E__: true });
    const env = readConsentEnv(false);
    expect(env).toMatchObject({
      webdriver: true,
      doNotTrack: true,
      gpc: true,
      toggleEnabled: false,
      e2eOverride: true,
    });
  });

  it("does not treat DNT '0' or a non-true override as set", () => {
    vi.stubGlobal("navigator", { doNotTrack: "0" });
    vi.stubGlobal("window", { __RQ_ANALYTICS_E2E__: "yes" });
    expect(readConsentEnv(true)).toMatchObject({
      doNotTrack: false,
      e2eOverride: false,
    });
  });
});
