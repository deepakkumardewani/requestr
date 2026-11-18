/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSharePayload } from "@/lib/shareLink";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  MAIN_DEFAULT_SIZE,
  MAIN_MIN_SIZE,
  MainLayout,
  SIDEBAR_DEFAULT_SIZE,
  SIDEBAR_MAX_SIZE,
  SIDEBAR_MIN_SIZE,
} from "./MainLayout";

const panelProps: Array<Record<string, unknown>> = [];

const mocks = vi.hoisted(() => ({
  shortcuts: {} as Record<string, (...args: unknown[]) => void>,
  save: vi.fn(),
  handleCloseTab: vi.fn(),
  activeTab: null as Record<string, unknown> | null,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/components/ui/resizable", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/ui/resizable")
  >("@/components/ui/resizable");
  return {
    ...actual,
    ResizablePanel: (props: Record<string, unknown>) => {
      panelProps.push(props);
      return <actual.ResizablePanel {...(props as object)} />;
    },
  };
});

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/shareLink", () => ({
  fetchSharePayload: vi.fn(),
}));

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: (
    handlers: Record<string, (...args: unknown[]) => void>
  ) => {
    mocks.shortcuts = handlers;
  },
}));

vi.mock("@/hooks/useMethodTheme", () => ({
  useMethodTheme: () => {},
}));

vi.mock("@/hooks/useSaveRequest", () => ({
  useSaveRequest: () => ({ save: mocks.save, activeTab: mocks.activeTab }),
}));

vi.mock("@/hooks/useCloseTabGuard", () => ({
  useCloseTabGuard: () => ({
    handleCloseTab: mocks.handleCloseTab,
  }),
}));

vi.mock("@/components/common/CommandPalette", () => ({
  CommandPalette: () => <div data-testid="command-palette-mock" />,
}));

vi.mock("./KeyboardShortcutsModal", () => ({
  KeyboardShortcutsModal: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <button
      data-testid="shortcuts-modal-mock"
      data-open={String(open)}
      onClick={() => onOpenChange(true)}
    />
  ),
}));

vi.mock("@/components/collections/SaveRequestModal", () => ({
  SaveRequestModal: ({
    tab,
    onOpenChange,
  }: {
    tab: { name: string };
    onOpenChange: (open: boolean) => void;
  }) => (
    <button data-testid="save-modal-mock" onClick={() => onOpenChange(false)}>
      {tab.name}
    </button>
  ),
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
  useUIStore.setState({
    saveModalOpen: false,
    pendingBulkClose: null,
    isCreatingCollection: false,
    keyboardShortcutsOpen: false,
  });
  vi.clearAllMocks();
  panelProps.length = 0;
  mocks.activeTab = null;
  window.history.replaceState({}, "", "/");
});

describe("MainLayout", () => {
  it("renders desktop layout with resizable handle and left / right regions after mount", async () => {
    render(<MainLayout />);
    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="resizable-handle"]')
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

  it("bounds the sidebar to 240px minimum, 50% maximum and 20% default", async () => {
    render(<MainLayout />);
    await waitFor(() => expect(panelProps.length).toBeGreaterThanOrEqual(2));
    const [sidebar, main] = panelProps;
    expect(SIDEBAR_MIN_SIZE).toBe("240px");
    expect(SIDEBAR_MAX_SIZE).toBe("50%");
    expect(SIDEBAR_DEFAULT_SIZE).toBe("20%");
    expect(sidebar).toMatchObject({
      defaultSize: SIDEBAR_DEFAULT_SIZE,
      minSize: SIDEBAR_MIN_SIZE,
      maxSize: SIDEBAR_MAX_SIZE,
    });
    expect(main).toMatchObject({
      defaultSize: MAIN_DEFAULT_SIZE,
      minSize: MAIN_MIN_SIZE,
    });
    expect(MAIN_MIN_SIZE).toBe("50%");
  });

  it("wraps the left panel in a labelled navigation landmark", async () => {
    render(<MainLayout />);
    const nav = await screen.findByRole("navigation");
    expect(nav).toHaveAttribute("aria-label");
    expect(nav).toContainElement(screen.getByTestId("left-panel-mock"));
  });

  it("opens the save modal only for an http active tab", async () => {
    mocks.activeTab = { type: "http", method: "POST", name: "Save me" };
    useUIStore.setState({ saveModalOpen: true });
    render(<MainLayout />);
    expect(await screen.findByTestId("save-modal-mock")).toHaveTextContent(
      "Save me"
    );
    screen.getByTestId("save-modal-mock").click();
    await waitFor(() =>
      expect(useUIStore.getState().saveModalOpen).toBe(false)
    );
  });

  it("does not render the save modal when the active tab is not http", () => {
    mocks.activeTab = { type: "ws", name: "socket" };
    useUIStore.setState({ saveModalOpen: true });
    render(<MainLayout />);
    expect(screen.queryByTestId("save-modal-mock")).toBeNull();
  });

  it("passes the keyboard shortcuts modal state from the UI store", async () => {
    render(<MainLayout />);
    const modal = screen.getByTestId("shortcuts-modal-mock");
    expect(modal).toHaveAttribute("data-open", "false");
    modal.click();
    await waitFor(() =>
      expect(useUIStore.getState().keyboardShortcutsOpen).toBe(true)
    );
  });

  describe("keyboard shortcut handlers", () => {
    it("wires onSave to the save request hook", () => {
      render(<MainLayout />);
      mocks.shortcuts.onSave();
      expect(mocks.save).toHaveBeenCalledTimes(1);
    });

    it("closes the active tab through the close guard", () => {
      mocks.activeTab = { type: "http", method: "GET", name: "A" };
      render(<MainLayout />);
      mocks.shortcuts.onCloseTab();
      expect(mocks.handleCloseTab).toHaveBeenCalledWith(mocks.activeTab);
    });

    it("ignores close-tab when there is no active tab", () => {
      render(<MainLayout />);
      mocks.shortcuts.onCloseTab();
      expect(mocks.handleCloseTab).not.toHaveBeenCalled();
    });

    it("closes all tabs directly when none are dirty", () => {
      useTabsStore.getState().openTab({ type: "http", name: "clean" });
      expect(useTabsStore.getState().tabs).toHaveLength(1);
      render(<MainLayout />);
      mocks.shortcuts.onCloseAllTabs();
      expect(useTabsStore.getState().tabs).toHaveLength(0);
      expect(useUIStore.getState().pendingBulkClose).toBeNull();
    });

    it("requests bulk-close confirmation when a tab is dirty", () => {
      useTabsStore.getState().openTab({ type: "http", name: "dirty" });
      useTabsStore.setState((state) => ({
        tabs: state.tabs.map((t) => ({ ...t, isDirty: true })),
      }));
      render(<MainLayout />);
      mocks.shortcuts.onCloseAllTabs();
      expect(useUIStore.getState().pendingBulkClose).toEqual({ kind: "all" });
      expect(useTabsStore.getState().tabs).toHaveLength(1);
    });

    it("opens a new tab for onNewRequest", () => {
      render(<MainLayout />);
      mocks.shortcuts.onNewRequest({ type: "http", name: "fresh" });
      expect(useTabsStore.getState().tabs.map((t) => t.name)).toContain(
        "fresh"
      );
    });

    it("flags collection creation for onNewCollection", () => {
      render(<MainLayout />);
      mocks.shortcuts.onNewCollection();
      expect(useUIStore.getState().isCreatingCollection).toBe(true);
    });

    it.each([
      ["onManageEnvironments", "/environments"],
      ["onOpenSettings", "/settings"],
      ["onImportCollection", "/import"],
      ["onTransformPlayground", "/transform"],
      ["onCompareJson", "/json-compare"],
    ])("%s navigates to %s", (handler, path) => {
      render(<MainLayout />);
      mocks.shortcuts[handler]();
      expect(push).toHaveBeenCalledWith(path);
    });
  });

  describe("beforeunload guard", () => {
    function dispatchBeforeUnload() {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }

    it("prevents unload while a tab has unsaved changes", () => {
      useTabsStore.getState().openTab({ type: "http", name: "dirty" });
      useTabsStore.setState((state) => ({
        tabs: state.tabs.map((t) => ({ ...t, isDirty: true })),
      }));
      render(<MainLayout />);
      expect(dispatchBeforeUnload()).toBe(true);
    });

    it("does not prevent unload when all tabs are clean", () => {
      useTabsStore.getState().openTab({ type: "http", name: "clean" });
      render(<MainLayout />);
      expect(dispatchBeforeUnload()).toBe(false);
    });

    it("removes the listener on unmount", () => {
      useTabsStore.getState().openTab({ type: "http", name: "dirty" });
      useTabsStore.setState((state) => ({
        tabs: state.tabs.map((t) => ({ ...t, isDirty: true })),
      }));
      const { unmount } = render(<MainLayout />);
      unmount();
      expect(dispatchBeforeUnload()).toBe(false);
    });
  });

  describe("share link hydration", () => {
    const payload = {
      method: "PUT",
      url: "https://example.test/x",
      headers: [],
      params: [],
      body: { type: "none" },
      auth: { type: "none" },
    };

    it("opens a tab from a valid ?s= link and cleans the URL", async () => {
      vi.mocked(fetchSharePayload).mockResolvedValue(payload as never);
      window.history.replaceState({}, "", "/app?s=abc&keep=1#secret");
      render(<MainLayout />);
      await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledTimes(1));
      expect(fetchSharePayload).toHaveBeenCalledWith("abc");
      const names = useTabsStore.getState().tabs.map((t) => t.name);
      expect(names).toContain("PUT https://example.test/x");
      expect(window.location.search).toBe("?keep=1");
      expect(window.location.hash).toBe("");
    });

    it("falls back to a default name when the shared url is empty", async () => {
      vi.mocked(fetchSharePayload).mockResolvedValue({
        ...payload,
        url: "",
      } as never);
      window.history.replaceState({}, "", "/app?s=abc");
      render(<MainLayout />);
      await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
      expect(useTabsStore.getState().tabs.map((t) => t.name)).toContain(
        "PUT Shared Request"
      );
      expect(window.location.pathname + window.location.search).toBe("/app");
    });

    it("shows an error toast when the share payload cannot be fetched", async () => {
      vi.mocked(fetchSharePayload).mockResolvedValue(null as never);
      window.history.replaceState({}, "", "/app?s=missing");
      render(<MainLayout />);
      await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
      expect(useTabsStore.getState().tabs).toHaveLength(0);
      expect(window.location.search).toBe("");
    });

    it("drops the legacy ?r= param without fetching", () => {
      window.history.replaceState({}, "", "/app?r=old&keep=1");
      render(<MainLayout />);
      expect(window.location.search).toBe("?keep=1");
      expect(fetchSharePayload).not.toHaveBeenCalled();
    });

    it("drops a legacy ?r= param leaving a bare path when it is the only param", () => {
      window.history.replaceState({}, "", "/app?r=old");
      render(<MainLayout />);
      expect(window.location.pathname + window.location.search).toBe("/app");
    });

    it("leaves the URL untouched when no share params are present", () => {
      window.history.replaceState({}, "", "/app?other=1");
      render(<MainLayout />);
      expect(window.location.search).toBe("?other=1");
      expect(fetchSharePayload).not.toHaveBeenCalled();
    });
  });
});
