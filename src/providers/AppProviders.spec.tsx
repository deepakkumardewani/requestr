/** @vitest-environment happy-dom */

import { useCronitor } from "@cronitorio/cronitor-rum-nextjs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { AppProviders } from "./AppProviders";

vi.mock("@cronitorio/cronitor-rum-nextjs", () => ({
  useCronitor: vi.fn(),
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

  it("hydrates all stores on mount and initializes Cronitor hook", async () => {
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

    expect(vi.mocked(useCronitor)).toHaveBeenCalledWith(
      "b6ec34d37802f3167d0bdd1e5faafe29",
    );
  });
});
