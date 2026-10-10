/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
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
  ImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog-mock" /> : null,
}));

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

beforeEach(() => {
  useUIStore.setState({ isImportOpen: false });
  useCollectionsStore.setState({ collections: [], requests: [] });
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

  it("shows cross-resource search results for a matching request on the collections tab", async () => {
    const user = userEvent.setup();
    useCollectionsStore.setState({
      collections: [
        { id: "c1", name: "Billing", createdAt: 0, updatedAt: 0 },
      ],
      requests: [
        {
          id: "r1",
          collectionId: "c1",
          name: "find-me invoice",
          method: "GET",
          url: "https://api.example.com/invoices",
          params: [],
          headers: [],
          auth: { type: "none" },
          body: { type: "none", content: "" },
          preScript: "",
          postScript: "",
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    });
    render(<LeftPanel />);

    await user.type(screen.getByPlaceholderText("Search..."), "find-me");

    expect(screen.getByText("find-me invoice")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-main-tab-mock"),
    ).not.toBeInTheDocument();
  });

  it("shows the no-results state when the query matches nothing", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    await user.type(screen.getByPlaceholderText("Search..."), "find-me");
    expect(screen.getByText(/No results for .find-me/)).toBeInTheDocument();
  });

  it("restores the collections tab content when the search is cleared", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    await user.type(screen.getByPlaceholderText("Search..."), "zzz");

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByTestId("sidebar-main-tab-mock")).toBeInTheDocument();
  });

  it("opens the import dialog from the create-new menu", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);
    expect(screen.queryByTestId("import-dialog-mock")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("create-new-dropdown-trigger"));
    await user.click(await screen.findByRole("menuitem", { name: /import/i }));

    expect(await screen.findByTestId("import-dialog-mock")).toBeInTheDocument();
    expect(useUIStore.getState().isImportOpen).toBe(true);
  });

  it("renders HubTab when the API Hub tab is selected", async () => {
    const user = userEvent.setup();
    render(<LeftPanel />);

    await user.click(screen.getByRole("tab", { name: /api hub/i }));

    expect(screen.getByTestId("hub-tab-mock")).toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-main-tab-mock"),
    ).not.toBeInTheDocument();
  });

  it("links the Transform Playground button to /transform", () => {
    render(<LeftPanel />);
    const link = screen.getByLabelText("Transform Playground").closest("a");
    expect(link).toHaveAttribute("href", "/transform");
  });

  it("links the JSON Compare button to /json-compare", () => {
    render(<LeftPanel />);
    expect(
      screen.getByLabelText("JSON Compare").closest("a")?.getAttribute("href"),
    ).toBe("/json-compare");
  });

  it("links the JSON Visualize button to /json-visualize and resets its store on click", async () => {
    const user = userEvent.setup();
    useJsonVisualizeStore.setState({ inputBody: '{"a":1}', format: "yaml" });
    render(<LeftPanel />);
    const visualize = screen.getByLabelText("JSON Visualize");
    expect(visualize.closest("a")?.getAttribute("href")).toBe(
      "/json-visualize",
    );

    await user.click(visualize as HTMLElement);

    expect(useJsonVisualizeStore.getState().inputBody).toBe("");
    expect(useJsonVisualizeStore.getState().format).toBe("json");
  });
});
