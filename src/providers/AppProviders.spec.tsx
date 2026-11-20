/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAnalytics } from "@/lib/analytics/adapter";
import { recordSession } from "@/lib/prompts/sessionTracker";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { AppProviders } from "./AppProviders";

vi.mock("@/lib/analytics/adapter", () => ({
  initAnalytics: vi.fn(),
  installErrorCapture: vi.fn(() => vi.fn()),
  track: vi.fn(),
  setEnabled: vi.fn(),
}));

vi.mock("@/lib/prompts/sessionTracker", () => ({
  recordSession: vi.fn(),
}));

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useTheme: () => ({ theme: "dark", resolvedTheme: "dark" }),
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

describe("AppProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ hydrated: false } as Partial<
      ReturnType<typeof useSettingsStore.getState>
    >);
    useTabsStore.setState({ tabs: [], activeTabId: null, hydrated: false });
    useCollectionsStore.setState({ collections: [], requests: [] });
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    useHistoryStore.setState({ entries: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children inside tooltip and theme wrappers", async () => {
    render(
      <AppProviders>
        <span data-testid="child">hello</span>
      </AppProviders>,
    );

    expect(screen.getByTestId("child")).toHaveTextContent("hello");
  });

  it("mirrors the Reduce motion setting onto <html> app-wide", () => {
    useSettingsStore.setState({ reducedMotion: "on" });
    render(<AppProviders>{null}</AppProviders>);
    expect(document.documentElement.dataset.reducedMotion).toBe("on");

    cleanup();
    document.documentElement.removeAttribute("data-reduced-motion");
    useSettingsStore.setState({ reducedMotion: "system" });
  });

  it("hydrates all stores on mount", async () => {
    const hydrateSettings = vi.spyOn(useSettingsStore.getState(), "hydrate");
    const hydrateTabs = vi.spyOn(useTabsStore.getState(), "hydrate");
    const hydrateCollections = vi.spyOn(
      useCollectionsStore.getState(),
      "hydrate",
    );
    const hydrateEnvironments = vi.spyOn(
      useEnvironmentsStore.getState(),
      "hydrate",
    );
    const hydrateHistory = vi.spyOn(useHistoryStore.getState(), "hydrate");

    render(<AppProviders>{null}</AppProviders>);

    await waitFor(() => {
      expect(hydrateSettings).toHaveBeenCalled();
      expect(hydrateTabs).toHaveBeenCalled();
      expect(hydrateCollections).toHaveBeenCalled();
      expect(hydrateEnvironments).toHaveBeenCalled();
      expect(hydrateHistory).toHaveBeenCalled();
    });

  });

  it("records the session day and initializes analytics on mount", async () => {
    render(<AppProviders>{null}</AppProviders>);

    await waitFor(() => {
      expect(vi.mocked(recordSession)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(initAnalytics)).toHaveBeenCalledTimes(1);
    });
  });
});
