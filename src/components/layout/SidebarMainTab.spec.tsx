/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  SIDEBAR_SECTIONS_STORAGE_KEY,
  SidebarMainTab,
} from "./SidebarMainTab";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("@/components/collections/CollectionTree", () => ({
  CollectionTree: () => <div data-testid="collection-tree-mock" />,
}));

vi.mock("@/components/chain/ChainList", () => ({
  ChainList: () => <div data-testid="chain-list-mock" />,
}));

function resetStores() {
  useUIStore.setState({
    commandPaletteOpen: false,
    mobileSidebarOpen: false,
    historyFilter: null,
    saveModalOpen: false,
    pendingCloseTabId: null,
    pendingBulkClose: null,
    isCreatingCollection: false,
    isCreatingEnv: false,
    envManagerOpen: false,
    envManagerFocusEnvId: null,
    keyboardShortcutsOpen: false,
  });
  useEnvironmentsStore.setState({
    environments: [],
    activeEnvId: null,
    hydrated: true,
  });
}

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("SidebarMainTab", () => {
  beforeEach(() => {
    resetStores();
  });

  it("renders Collections, Environments, and Chains section labels", () => {
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={vi.fn()}
      />,
    );
    expect(screen.getByText("Collections")).toBeInTheDocument();
    expect(screen.getByText("Environments")).toBeInTheDocument();
    expect(screen.getByText("Chains")).toBeInTheDocument();
  });

  it("embeds collection tree and chain list in their sections", () => {
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={vi.fn()}
      />,
    );
    expect(screen.getByTestId("collection-tree-mock")).toBeInTheDocument();
    expect(screen.getByTestId("chain-list-mock")).toBeInTheDocument();
  });

  it('clicking "Add collection" sets creating-collection flag in UI store', async () => {
    const user = userEvent.setup();
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /add collection/i }));
    expect(useUIStore.getState().isCreatingCollection).toBe(true);
  });

  it('clicking "Add environment" sets creating-env flag in UI store', async () => {
    const user = userEvent.setup();
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /add environment/i }));
    expect(useUIStore.getState().isCreatingEnv).toBe(true);
  });

  it('clicking "New chain" calls onNewChain', async () => {
    const user = userEvent.setup();
    const onNewChain = vi.fn();
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={onNewChain}
      />,
    );
    await user.click(screen.getByRole("button", { name: /new chain/i }));
    expect(onNewChain).toHaveBeenCalledTimes(1);
  });

  it("creates environment on Enter in new environment input", async () => {
    const user = userEvent.setup();
    useUIStore.setState({ isCreatingEnv: true });
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Environment name");
    await user.type(input, "Staging{Enter}");
    expect(
      useEnvironmentsStore
        .getState()
        .environments.some((e) => e.name === "Staging"),
    ).toBe(true);
    expect(useUIStore.getState().isCreatingEnv).toBe(false);
  });

  it("shows empty environments state when none exist and not creating", () => {
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={vi.fn()}
      />,
    );
    expect(screen.getByText("No environments")).toBeInTheDocument();
  });

  it("shows new environment input when creating env is set before render", () => {
    useUIStore.setState({ isCreatingEnv: true });
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Environment name")).toBeVisible();
  });

  describe("auto-expands a collapsed section when creation is triggered", () => {
    function renderTab(isCreatingChain = false) {
      return render(
        <SidebarMainTab
          isCreatingChain={isCreatingChain}
          onCreatingChainDone={vi.fn()}
          onNewChain={vi.fn()}
        />,
      );
    }

    function storedSections(): string[] {
      return JSON.parse(
        localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY) ?? "[]",
      );
    }

    beforeEach(() => {
      localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify([]));
    });

    afterEach(() => {
      localStorage.removeItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    });

    it("expands Collections when isCreatingCollection becomes true", () => {
      renderTab();
      expect(storedSections()).not.toContain("collections");
      act(() => useUIStore.setState({ isCreatingCollection: true }));
      expect(screen.getByTestId("collection-tree-mock")).toBeVisible();
      expect(storedSections()).toContain("collections");
    });

    it("expands Environments when isCreatingEnv becomes true", () => {
      renderTab();
      act(() => useUIStore.setState({ isCreatingEnv: true }));
      expect(screen.getByPlaceholderText("Environment name")).toBeVisible();
      expect(storedSections()).toContain("environments");
    });

    it("expands Chains when isCreatingChain becomes true", () => {
      const { rerender } = renderTab();
      expect(storedSections()).not.toContain("chains");
      rerender(
        <SidebarMainTab
          isCreatingChain
          onCreatingChainDone={vi.fn()}
          onNewChain={vi.fn()}
        />,
      );
      expect(screen.getByTestId("chain-list-mock")).toBeVisible();
      expect(storedSections()).toContain("chains");
    });
  });
});
