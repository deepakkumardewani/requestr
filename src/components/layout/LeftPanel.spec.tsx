/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  SidebarMainTab: () => (
    <div data-testid="sidebar-main-tab-mock">collections</div>
  ),
}));

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
  ImportDialog: () => null,
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

  it("Settings control links to settings route", () => {
    render(<LeftPanel />);
    const settings = screen.getByTestId("sidebar-settings-btn");
    expect(settings.closest("a")).toHaveAttribute("href", "/settings");
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
    expect(screen.getByText(/No results for .find-me/)).toBeInTheDocument();
  });
});
