/** @vitest-environment happy-dom */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HttpTab } from "@/types";
import { MainLayout } from "./MainLayout";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/shareLink", () => ({
  fetchSharePayload: vi.fn(),
}));

const shortcuts = vi.hoisted(() => ({
  handlers: {} as {
    onCloseTab?: () => void;
    onCloseAllTabs?: () => void;
  },
  activeTab: null as unknown,
  handleCloseTab: vi.fn(),
}));

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: (handlers: typeof shortcuts.handlers) => {
    shortcuts.handlers = handlers;
  },
}));

vi.mock("@/hooks/useMethodTheme", () => ({
  useMethodTheme: () => {},
}));

vi.mock("@/hooks/useSaveRequest", () => ({
  useSaveRequest: () => ({ save: vi.fn(), activeTab: shortcuts.activeTab }),
}));

vi.mock("@/hooks/useCloseTabGuard", () => ({
  useCloseTabGuard: () => ({
    handleCloseTab: shortcuts.handleCloseTab,
  }),
}));

vi.mock("@/components/common/CommandPalette", () => ({
  CommandPalette: () => <div data-testid="command-palette-mock" />,
}));

vi.mock("./KeyboardShortcutsModal", () => ({
  KeyboardShortcutsModal: () => null,
}));

vi.mock("./LeftPanel", () => ({
  LeftPanel: () => <aside data-testid="left-panel-mock" />,
}));

vi.mock("./RightPanel", () => ({
  RightPanel: () => <div data-testid="right-panel-mock" />,
}));

vi.mock("./MobileDesktopNotice", () => ({
  MobileDesktopNotice: () => null,
}));

beforeEach(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useUIStore.setState({ pendingBulkClose: null });
  shortcuts.activeTab = null;
  vi.clearAllMocks();
});

describe("MainLayout", () => {
  it("renders desktop layout with resizable handle and left / right regions after mount", async () => {
    render(<MainLayout />);
    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="resizable-handle"]'),
      ).toBeTruthy();
    });
    expect(screen.getByTestId("desktop-layout")).toBeInTheDocument();
    expect(screen.getByTestId("left-panel-mock")).toBeInTheDocument();
    expect(screen.getByTestId("right-panel-mock")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "app-main");
  });

  it("mounts command palette for global access", async () => {
    render(<MainLayout />);
    await waitFor(() => {
      expect(screen.getByTestId("command-palette-mock")).toBeInTheDocument();
    });
  });

  function seedTab(isDirty: boolean): HttpTab {
    useTabsStore.getState().openTab({ type: "http", name: "T", isDirty });
    const { tabs } = useTabsStore.getState();
    return tabs[tabs.length - 1] as HttpTab;
  }

  describe("close shortcuts", () => {
    it("close-active-tab shortcut delegates the active tab to the close guard", () => {
      const active = seedTab(false);
      shortcuts.activeTab = active;
      render(<MainLayout />);

      act(() => shortcuts.handlers.onCloseTab?.());

      expect(shortcuts.handleCloseTab).toHaveBeenCalledWith(active);
    });

    it("close-active-tab shortcut does nothing when no tab is active", () => {
      render(<MainLayout />);

      act(() => shortcuts.handlers.onCloseTab?.());

      expect(shortcuts.handleCloseTab).not.toHaveBeenCalled();
    });

    it("close-all shortcut closes every tab immediately when none are dirty", () => {
      seedTab(false);
      seedTab(false);
      render(<MainLayout />);

      act(() => shortcuts.handlers.onCloseAllTabs?.());

      expect(useTabsStore.getState().tabs).toHaveLength(0);
      expect(useUIStore.getState().pendingBulkClose).toBeNull();
    });

    it("close-all shortcut asks for confirmation and keeps tabs when any tab is dirty", () => {
      seedTab(false);
      seedTab(true);
      render(<MainLayout />);

      act(() => shortcuts.handlers.onCloseAllTabs?.());

      expect(useTabsStore.getState().tabs).toHaveLength(2);
      expect(useUIStore.getState().pendingBulkClose).toEqual({ kind: "all" });
    });
  });

  describe("beforeunload guard", () => {
    function dispatchBeforeUnload() {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event;
    }

    it("blocks page unload when a tab has unsaved changes", () => {
      seedTab(true);
      render(<MainLayout />);

      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    });

    it("allows page unload when no tab is dirty", () => {
      seedTab(false);
      render(<MainLayout />);

      expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    });

    it("stops blocking unload once the dirty tab is saved", () => {
      const tab = seedTab(true);
      render(<MainLayout />);

      act(() =>
        useTabsStore.getState().updateTabState(tab.tabId, { isDirty: false }),
      );

      expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    });

    it("removes the unload listener when the layout unmounts", () => {
      seedTab(true);
      const { unmount } = render(<MainLayout />);

      unmount();

      expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    });
  });
});
