/**
 * Pure consent resolution (R18, R22, R22a). User-controlled gates (DNT, GPC,
 * toggle) always win; the e2e override only bypasses the environment gates.
 */

export type ConsentReason =
  | "enabled"
  | "override"
  | "env_off"
  | "development"
  | "test"
  | "webdriver"
  | "dnt"
  | "gpc"
  | "toggle_off";

export type ConsentEnv = {
  /** Value of `NEXT_PUBLIC_ANALYTICS_ENABLED`. */
  analyticsFlag: string | undefined;
  nodeEnv: string | undefined;
  webdriver: boolean;
  doNotTrack: boolean;
  gpc: boolean;
  /** The Settings toggle (`useAnalyticsStore`). */
  toggleEnabled: boolean;
  /** `window.__RQ_ANALYTICS_E2E__ === true`. */
  e2eOverride: boolean;
};

export type ConsentResult = { enabled: boolean; reason: ConsentReason };

declare global {
  interface Window {
    /** Playwright-only: enables the adapter outside production; see R22a. */
    __RQ_ANALYTICS_E2E__?: boolean;
  }
}

const disabled = (reason: ConsentReason): ConsentResult => ({
  enabled: false,
  reason,
});

export function resolveConsent(env: ConsentEnv): ConsentResult {
  if (env.doNotTrack) return disabled("dnt");
  if (env.gpc) return disabled("gpc");
  if (!env.toggleEnabled) return disabled("toggle_off");
  if (env.e2eOverride && env.nodeEnv !== "production") {
    return { enabled: true, reason: "override" };
  }
  if (env.analyticsFlag !== "true") return disabled("env_off");
  if (env.nodeEnv === "development") return disabled("development");
  if (env.nodeEnv === "test") return disabled("test");
  if (env.webdriver) return disabled("webdriver");
  return { enabled: true, reason: "enabled" };
}

/** Reads the browser environment; the `process.env` access must stay literal so Next inlines it. */
export function readConsentEnv(toggleEnabled: boolean): ConsentEnv {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const win = typeof window === "undefined" ? undefined : window;
  return {
    analyticsFlag: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
    nodeEnv: process.env.NODE_ENV,
    webdriver: nav?.webdriver === true,
    doNotTrack: nav?.doNotTrack === "1",
    gpc:
      (nav as (Navigator & { globalPrivacyControl?: boolean }) | undefined)
        ?.globalPrivacyControl === true,
    toggleEnabled,
    e2eOverride: win?.__RQ_ANALYTICS_E2E__ === true,
  };
}
