/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapterSetEnabled = vi.fn();
vi.mock("@/lib/analytics/adapter", () => ({
  setEnabled: (enabled: boolean) => adapterSetEnabled(enabled),
}));

const KEY = "rq_analytics_enabled";

async function loadStore() {
  vi.resetModules();
  return import("./useAnalyticsStore");
}

beforeEach(() => {
  localStorage.clear();
  adapterSetEnabled.mockClear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useAnalyticsStore", () => {
  it("exports the backup storage key", async () => {
    const { ANALYTICS_ENABLED_STORAGE_KEY } = await loadStore();
    expect(ANALYTICS_ENABLED_STORAGE_KEY).toBe(KEY);
  });

  it("defaults to enabled when nothing is stored", async () => {
    const { useAnalyticsStore } = await loadStore();
    expect(useAnalyticsStore.getState().enabled).toBe(true);
  });

  it("starts disabled when the opt-out was persisted", async () => {
    localStorage.setItem(KEY, "false");
    const { useAnalyticsStore } = await loadStore();
    expect(useAnalyticsStore.getState().enabled).toBe(false);
  });

  it("treats any other stored value as enabled", async () => {
    localStorage.setItem(KEY, "garbage");
    const { useAnalyticsStore } = await loadStore();
    expect(useAnalyticsStore.getState().enabled).toBe(true);
  });

  it("persists an opt-out, updates state and applies it to the adapter", async () => {
    const { useAnalyticsStore } = await loadStore();
    useAnalyticsStore.getState().setEnabled(false);
    expect(localStorage.getItem(KEY)).toBe("false");
    expect(useAnalyticsStore.getState().enabled).toBe(false);
    expect(adapterSetEnabled).toHaveBeenCalledTimes(1);
    expect(adapterSetEnabled).toHaveBeenCalledWith(false);
  });

  it("removes the stored key when opting back in", async () => {
    localStorage.setItem(KEY, "false");
    const { useAnalyticsStore } = await loadStore();
    useAnalyticsStore.getState().setEnabled(true);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(useAnalyticsStore.getState().enabled).toBe(true);
    expect(adapterSetEnabled).toHaveBeenCalledWith(true);
  });

  it("syncConsent pushes the persisted choice into the adapter without writing storage", async () => {
    localStorage.setItem(KEY, "false");
    const { useAnalyticsStore } = await loadStore();
    useAnalyticsStore.getState().syncConsent();
    expect(adapterSetEnabled).toHaveBeenCalledTimes(1);
    expect(adapterSetEnabled).toHaveBeenCalledWith(false);
    expect(localStorage.getItem(KEY)).toBe("false");
  });

  it("syncConsent reports enabled by default", async () => {
    const { useAnalyticsStore } = await loadStore();
    useAnalyticsStore.getState().syncConsent();
    expect(adapterSetEnabled).toHaveBeenCalledWith(true);
  });

  it("still applies the choice when storage throws", async () => {
    const { useAnalyticsStore } = await loadStore();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    useAnalyticsStore.getState().setEnabled(false);
    expect(useAnalyticsStore.getState().enabled).toBe(false);
    expect(adapterSetEnabled).toHaveBeenCalledWith(false);
  });
});
