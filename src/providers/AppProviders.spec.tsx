/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_NOTICE_DISMISSED_KEY } from "@/components/common/AnalyticsNotice";
import { initAnalytics } from "@/lib/analytics/adapter";
import { safeStorage } from "@/lib/analytics/dedupe";
import { recordSession } from "@/lib/prompts/sessionTracker";
import { usePromptStore } from "@/stores/usePromptStore";
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
  isFirstSession: vi.fn(() => true),
}));

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useTheme: () => ({ theme: "dark", resolvedTheme: "dark" }),
}));

const mockPathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({ push: vi.fn() }),
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

  describe("analytics notice", () => {
    beforeEach(() => {
      safeStorage.remove(ANALYTICS_NOTICE_DISMISSED_KEY);
      mockPathname.value = "/";
      window.__RQ_ANALYTICS_E2E__ = true;
      usePromptStore.setState({ active: null, current: null, queue: [] });
    });

    afterEach(() => {
      delete window.__RQ_ANALYTICS_E2E__;
      vi.unstubAllGlobals();
    });

    it("shows once on a first landing visit and never after dismissal", async () => {
      const { unmount } = render(<AppProviders>{null}</AppProviders>);
      const notice = await screen.findByTestId("analytics-notice");
      fireEvent.click(within(notice).getByRole("button"));
      expect(screen.queryByTestId("analytics-notice")).toBeNull();
      expect(localStorage.getItem(ANALYTICS_NOTICE_DISMISSED_KEY)).toBe("1");
      unmount();

      render(<AppProviders>{null}</AppProviders>);
      await waitFor(() => expect(initAnalytics).toHaveBeenCalled());
      expect(screen.queryByTestId("analytics-notice")).toBeNull();
    });

    it("shows on /app even in the first session", async () => {
      mockPathname.value = "/app";
      render(<AppProviders>{null}</AppProviders>);
      expect(await screen.findByTestId("analytics-notice")).toBeInTheDocument();
    });

    it("stays hidden when Do Not Track is on", async () => {
      vi.stubGlobal("navigator", { ...navigator, doNotTrack: "1" });
      render(<AppProviders>{null}</AppProviders>);
      await waitFor(() => expect(initAnalytics).toHaveBeenCalled());
      expect(screen.queryByTestId("analytics-notice")).toBeNull();
    });

    it("stays hidden when the environment disables analytics", async () => {
      delete window.__RQ_ANALYTICS_E2E__;
      render(<AppProviders>{null}</AppProviders>);
      await waitFor(() => expect(initAnalytics).toHaveBeenCalled());
      expect(screen.queryByTestId("analytics-notice")).toBeNull();
    });

    it("stays hidden on routes outside the landing page and the app", async () => {
      mockPathname.value = "/privacy";
      render(<AppProviders>{null}</AppProviders>);
      await waitFor(() => expect(initAnalytics).toHaveBeenCalled());
      expect(screen.queryByTestId("analytics-notice")).toBeNull();
    });
  });
});
