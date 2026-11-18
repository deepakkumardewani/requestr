/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJsonVisualizeStore } from "@/stores/useJsonVisualizeStore";
import { useUIStore } from "@/stores/useUIStore";
import { LeftPanel } from "./LeftPanel";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/link", () => ({
  default({
    children,
    href,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock("./SidebarMainTab", () => ({
  SidebarMainTab: ({
    isCreatingChain,
    onCreatingChainDone,
    onNewChain,
  }: {
    isCreatingChain: boolean;
    onCreatingChainDone: () => void;
    onNewChain: () => void;
  }) => (
    <div data-testid="sidebar-main-tab-mock">
      collections
      <span data-testid="creating-chain">{String(isCreatingChain)}</span>
      <button type="button" onClick={onNewChain}>
        start-chain
      </button>
      <button type="button" onClick={onCreatingChainDone}>
        finish-chain
      </button>
    </div>
  ),
}));

vi.mock("./SidebarSearch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./SidebarSearch")>();
  return {
    ...actual,
    SidebarSearchResults: ({
      query,
      onClose,
    }: {
      query: string;
      onClose: () => void;
    }) => (
      <div data-testid="search-results">
        results for {query}
        <button type="button" onClick={onClose}>
          close-results
        </button>
      </div>
    ),
  };
});

vi.mock("@/components/history/HistoryList", () => ({
  HistoryList: ({ filter }: { filter?: string }) => (
    <div data-testid="history-list">history{filter ? ` (${filter})` : ""}</div>
  ),
}));

vi.mock("@/components/hub/HubTab", () => ({
  HubTab: () => <div data-testid="hub-tab-mock">hub</div>,
}));

vi.mock("@/components/environment/EnvManagerDialog", () => ({
  EnvManagerDialog: () => null,
}));

vi.mock("@/components/import/ImportDialog", () => ({
  ImportDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <button type="button" data-testid="import-dialog" onClick={onClose}>
        import-open
      </button>
    ) : null,
}));

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
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
  useUIStore.setState({ isImportOpen: false });
  routerPush.mockClear();
  vi.clearAllMocks();
});

describe("LeftPanel", () => {
  it("renders app header and Collections / History / Hub tab affordances", () => {
    render(<LeftPanel />);
    expect(screen.getByText("Requestr")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-tab-collections")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-tab-history")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /api hub/i })).toBeInTheDocument();
  });

  it("logo is a keyboard-focusable link to the landing page with an accessible name", () => {
    render(<LeftPanel />);
    const link = screen.getByRole("link", { name: "Requestr home" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).not.toHaveAttribute("tabindex", "-1");
  });

  it("Settings control links to settings route", () => {
    render(<LeftPanel />);
    const settings = screen.getByTestId("sidebar-settings-btn");
    expect(settings.closest("a")).toHaveAttribute("href", "/settings");
  });

  it("no longer hosts the Relay toggle (it lives in the tab bar)", async () => {
    render(<LeftPanel />);
    await screen.findByTestId("sidebar-settings-btn");
    expect(screen.queryByTestId("relay-toggle")).not.toBeInTheDocument();
  });

  it("switches sidebar tab content between collections and history", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    expect(screen.getByTestId("sidebar-main-tab-mock")).toBeInTheDocument();

    await user.click(screen.getByTestId("sidebar-tab-history"));
    expect(screen.getByTestId("history-list")).toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-main-tab-mock"),
    ).not.toBeInTheDocument();
  });

  it("search input updates and passes filter to history when on history tab", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    await user.click(screen.getByTestId("sidebar-tab-history"));
    const search = screen.getByPlaceholderText("Search...");
    await user.type(search, "ping");
    expect(screen.getByTestId("history-list")).toHaveTextContent("ping");
  });

  it("shows cross-resource search results when query is set on collections tab", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    const search = screen.getByPlaceholderText("Search...");
    await user.type(search, "find-me");
    expect(screen.getByTestId("search-results")).toHaveTextContent("find-me");
  });

  it("closing the search results clears the query and restores the collections tab", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    await user.type(screen.getByPlaceholderText("Search..."), "abc");
    await user.click(screen.getByText("close-results"));
    expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
    expect(screen.getByTestId("sidebar-main-tab-mock")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search...")).toHaveValue("");
  });

  it("switches to the hub tab", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    await user.click(screen.getByRole("tab", { name: /api hub/i }));
    expect(screen.getByTestId("hub-tab-mock")).toBeInTheDocument();
  });

  it("toggles chain creation from the collections tab", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    expect(screen.getByTestId("creating-chain")).toHaveTextContent("false");
    await user.click(screen.getByText("start-chain"));
    expect(screen.getByTestId("creating-chain")).toHaveTextContent("true");
    await user.click(screen.getByText("finish-chain"));
    expect(screen.getByTestId("creating-chain")).toHaveTextContent("false");
  });

  it("opens and closes the import dialog through the UI store", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    expect(screen.queryByTestId("import-dialog")).not.toBeInTheDocument();
    act(() => useUIStore.getState().setIsImportOpen(true));
    await user.click(screen.getByTestId("import-dialog"));
    expect(useUIStore.getState().isImportOpen).toBe(false);
  });

  it("wires the create menu: New chain starts chain creation, Import opens the dialog", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    await user.click(screen.getByTestId("create-new-dropdown-trigger"));
    await user.click(await screen.findByTestId("create-chain-item"));
    expect(screen.getByTestId("creating-chain")).toHaveTextContent("true");

    await user.click(screen.getByTestId("create-new-dropdown-trigger"));
    await user.click(await screen.findByRole("menuitem", { name: /import/i }));
    expect(useUIStore.getState().isImportOpen).toBe(true);
  });

  it("clears the JSON visualizer state when opening it", async () => {
    const user = userEvent.setup();
    const clear = vi.spyOn(useJsonVisualizeStore.getState(), "clear");
    useJsonVisualizeStore.setState({ clear });
    render(<LeftPanel />);
    const visualize = document.querySelector(
      'a[href="/json-visualize"]',
    ) as HTMLElement;
    await user.click(visualize);
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
