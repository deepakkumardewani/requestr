/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type {
  CollectionModel,
  EnvironmentModel,
  RequestModel,
} from "@/types";
import type { Chain } from "@/types/chain";
import { SidebarSearchInput, SidebarSearchResults } from "./SidebarSearch";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

function makeRequest(overrides: Partial<RequestModel>): RequestModel {
  return {
    id: "req-1",
    collectionId: "col-1",
    name: "Get Users",
    method: "GET",
    url: "https://api.example.com/users",
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const collection: CollectionModel = {
  id: "col-1",
  name: "Payments API",
  createdAt: 0,
  updatedAt: 0,
};

function makeEnv(id: string, name: string): EnvironmentModel {
  return { id, name, variables: [], createdAt: 0, updatedAt: 0 };
}

function makeChain(id: string, name: string, scope: Chain["scope"]): Chain {
  return {
    id,
    scope,
    schemaVersion: 5,
    name,
    createdAt: 0,
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
  } as Chain;
}

beforeEach(() => {
  useCollectionsStore.setState({ collections: [collection], requests: [] });
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
  useChainStore.setState({ chains: {} });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useUIStore.setState({ envManagerOpen: false, envManagerFocusEnvId: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SidebarSearchResults", () => {
  it("matches requests by name", () => {
    useCollectionsStore.setState({
      requests: [
        makeRequest({ id: "a", name: "Get Users" }),
        makeRequest({ id: "b", name: "Create Order", url: "https://x.io/o" }),
      ],
    });
    render(<SidebarSearchResults query="users" onClose={vi.fn()} />);
    expect(screen.getByText("Get Users")).toBeInTheDocument();
    expect(screen.queryByText("Create Order")).not.toBeInTheDocument();
  });

  it("matches requests by URL when the name does not match", () => {
    useCollectionsStore.setState({
      requests: [
        makeRequest({ id: "a", name: "Alpha", url: "https://api.dev/billing" }),
        makeRequest({ id: "b", name: "Beta", url: "https://api.dev/other" }),
      ],
    });
    render(<SidebarSearchResults query="billing" onClose={vi.fn()} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("matches case-insensitively on name and URL", () => {
    useCollectionsStore.setState({
      requests: [
        makeRequest({ id: "a", name: "Get Users", url: "https://A.io/ZED" }),
      ],
    });
    const { rerender } = render(
      <SidebarSearchResults query="GET USERS" onClose={vi.fn()} />,
    );
    expect(screen.getByText("Get Users")).toBeInTheDocument();
    rerender(<SidebarSearchResults query="zed" onClose={vi.fn()} />);
    expect(screen.getByText("Get Users")).toBeInTheDocument();
  });

  it("shows the owning collection name under a request result", () => {
    useCollectionsStore.setState({ requests: [makeRequest({})] });
    render(<SidebarSearchResults query="users" onClose={vi.fn()} />);
    expect(screen.getByText("Payments API")).toBeInTheDocument();
  });

  it("matches environments by name", () => {
    useEnvironmentsStore.setState({
      environments: [makeEnv("e1", "Staging"), makeEnv("e2", "Production")],
    });
    render(<SidebarSearchResults query="stag" onClose={vi.fn()} />);
    expect(screen.getByText("Staging")).toBeInTheDocument();
    expect(screen.queryByText("Production")).not.toBeInTheDocument();
  });

  it("matches only standalone chains, ignoring collection-scoped ones", () => {
    useChainStore.setState({
      chains: {
        c1: makeChain("c1", "Checkout flow", "standalone"),
        c2: makeChain("c2", "Checkout hidden", "collection"),
      },
    });
    render(<SidebarSearchResults query="checkout" onClose={vi.fn()} />);
    expect(screen.getByText("Checkout flow")).toBeInTheDocument();
    expect(screen.queryByText("Checkout hidden")).not.toBeInTheDocument();
  });

  it("groups results under Requests, Environments and Chains headings", () => {
    useCollectionsStore.setState({
      requests: [makeRequest({ name: "Shared req" })],
    });
    useEnvironmentsStore.setState({ environments: [makeEnv("e1", "Shared env")] });
    useChainStore.setState({
      chains: { c1: makeChain("c1", "Shared chain", "standalone") },
    });
    render(<SidebarSearchResults query="shared" onClose={vi.fn()} />);
    expect(screen.getByText("Requests")).toBeInTheDocument();
    expect(screen.getByText("Environments")).toBeInTheDocument();
    expect(screen.getByText("Chains")).toBeInTheDocument();
  });

  it("omits headings for groups with no matches", () => {
    useEnvironmentsStore.setState({ environments: [makeEnv("e1", "Staging")] });
    render(<SidebarSearchResults query="stag" onClose={vi.fn()} />);
    expect(screen.queryByText("Requests")).not.toBeInTheDocument();
    expect(screen.queryByText("Chains")).not.toBeInTheDocument();
  });

  it("shows the empty state with the query when nothing matches", () => {
    render(<SidebarSearchResults query="zzz" onClose={vi.fn()} />);
    expect(screen.getByText(/No results for .zzz/)).toBeInTheDocument();
  });

  it("opens a new tab for a request without an open tab and closes the search", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    useCollectionsStore.setState({
      requests: [makeRequest({ id: "r9", name: "Get Users", method: "POST" })],
    });
    render(<SidebarSearchResults query="users" onClose={onClose} />);

    await user.click(screen.getByText("Get Users"));

    const { tabs, activeTabId } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({
      requestId: "r9",
      name: "Get Users",
      method: "POST",
    });
    expect(activeTabId).toBe(tabs[0].tabId);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reuses the existing tab instead of opening a duplicate", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    useCollectionsStore.setState({
      requests: [makeRequest({ id: "r9", name: "Get Users" })],
    });
    useTabsStore.getState().openTab({ type: "http", requestId: "r9" });
    useTabsStore.getState().openTab({ type: "http", requestId: "other" });
    const [first, second] = useTabsStore.getState().tabs;
    expect(useTabsStore.getState().activeTabId).toBe(second.tabId);
    render(<SidebarSearchResults query="users" onClose={onClose} />);

    await user.click(screen.getByText("Get Users"));

    const state = useTabsStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(first.tabId);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens the environment manager focused on the clicked environment", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    useEnvironmentsStore.setState({ environments: [makeEnv("e7", "Staging")] });
    render(<SidebarSearchResults query="stag" onClose={onClose} />);

    await user.click(screen.getByText("Staging"));

    expect(useUIStore.getState().envManagerOpen).toBe(true);
    expect(useUIStore.getState().envManagerFocusEnvId).toBe("e7");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates to the chain page when a chain result is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    useChainStore.setState({
      chains: { c1: makeChain("c1", "Checkout flow", "standalone") },
    });
    render(<SidebarSearchResults query="checkout" onClose={onClose} />);

    await user.click(screen.getByText("Checkout flow"));

    expect(routerPush).toHaveBeenCalledWith("/chain/c1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("SidebarSearchInput", () => {
  function Harness({ initial = "" }: { initial?: string }) {
    const [query, setQuery] = useState(initial);
    return (
      <>
        <SidebarSearchInput query={query} onQueryChange={setQuery} />
        <output data-testid="query-value">{query}</output>
      </>
    );
  }

  it("hides the clear button while the query is empty", () => {
    render(<Harness />);
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });

  it("reports typed text through onQueryChange", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByPlaceholderText("Search..."), "abc");
    expect(screen.getByTestId("query-value")).toHaveTextContent("abc");
  });

  it("clears the query when the clear button is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness initial="abc" />);

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByTestId("query-value")).toBeEmptyDOMElement();
    expect(screen.getByPlaceholderText("Search...")).toHaveValue("");
  });
});
