/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useFolderExpandStore } from "@/stores/useFolderExpandStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
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

function renderTab() {
  return render(
    <SidebarMainTab
      isCreatingChain={false}
      onCreatingChainDone={vi.fn()}
      onNewChain={vi.fn()}
    />,
  );
}

const ENV_A = {
  id: "env-a",
  name: "Staging",
  variables: [],
  createdAt: 1,
  updatedAt: 1,
};
const ENV_B = { ...ENV_A, id: "env-b", name: "Prod" };

function resetStores() {
  useCollectionsStore.setState({ collections: [], folders: [], requests: [] });
  useFolderExpandStore.setState({ collapsedFolderIds: [] });
  useSettingsStore.setState({ pinnedRequestIds: [] });
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

  it("section headers pair a right chevron (closed) with a down chevron (open)", () => {
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={vi.fn()}
      />,
    );
    const trigger = screen
      .getByText("Collections")
      .closest('[data-slot="accordion-trigger"]');
    const right = trigger?.querySelector("svg.lucide-chevron-right");
    const down = trigger?.querySelector("svg.lucide-chevron-down");
    expect(right?.getAttribute("class")).toContain(
      "group-aria-expanded/accordion-trigger:hidden",
    );
    expect(down?.getAttribute("class")).toContain(
      "group-aria-expanded/accordion-trigger:inline",
    );
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

  describe("environment list", () => {
    beforeEach(() => {
      useEnvironmentsStore.setState({
        environments: [ENV_A, ENV_B],
        activeEnvId: "env-a",
        hydrated: true,
      });
    });

    it("marks the active environment and toggles it off when clicked again", async () => {
      const user = userEvent.setup();
      renderTab();
      expect(screen.getByText("active")).toBeInTheDocument();

      await user.click(screen.getByText("Staging"));

      expect(useEnvironmentsStore.getState().activeEnvId).toBeNull();
      expect(useUIStore.getState().envManagerOpen).toBe(true);
      expect(useUIStore.getState().envManagerFocusEnvId).toBe("env-a");
    });

    it("activates a different environment when it is clicked", async () => {
      const user = userEvent.setup();
      renderTab();

      await user.click(screen.getByText("Prod"));

      expect(useEnvironmentsStore.getState().activeEnvId).toBe("env-b");
      expect(useUIStore.getState().envManagerFocusEnvId).toBe("env-b");
    });

    it("opens the manager for an environment from its dropdown without activating it", async () => {
      const user = userEvent.setup();
      renderTab();
      const row = screen.getByText("Prod").closest("div") as HTMLElement;

      await user.click(row.querySelector("button") as HTMLElement);
      await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

      expect(useUIStore.getState().envManagerFocusEnvId).toBe("env-b");
      expect(useEnvironmentsStore.getState().activeEnvId).toBe("env-a");
    });

    it("deletes an environment from its dropdown after confirming and clears the active one", async () => {
      const user = userEvent.setup();
      renderTab();
      const row = screen.getByText("Staging").closest("div") as HTMLElement;

      await user.click(row.querySelector("button") as HTMLElement);
      await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
      expect(await screen.findByText("Delete Environment")).toBeInTheDocument();
      expect(useEnvironmentsStore.getState().environments).toHaveLength(2);

      await user.click(
        screen.getByRole("button", { name: /yes, delete environment/i }),
      );

      await waitFor(() => {
        expect(useEnvironmentsStore.getState().environments).toHaveLength(1);
      });
      expect(useEnvironmentsStore.getState().activeEnvId).toBeNull();
    });

    it("keeps the environment when deletion is dismissed", async () => {
      const user = userEvent.setup();
      renderTab();
      fireEvent.contextMenu(screen.getByText("Prod"));

      fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
      expect(await screen.findByText("Delete Environment")).toBeInTheDocument();
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Delete Environment")).not.toBeInTheDocument();
      });
      expect(useEnvironmentsStore.getState().environments).toHaveLength(2);
    });

    it("opens the manager from the context menu rename item", async () => {
      renderTab();
      fireEvent.contextMenu(screen.getByText("Prod"));

      fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));

      expect(useUIStore.getState().envManagerFocusEnvId).toBe("env-b");
    });

    it("deletes a non-active environment via the context menu and keeps the active one", async () => {
      renderTab();
      fireEvent.contextMenu(screen.getByText("Prod"));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

      fireEvent.click(
        await screen.findByRole("button", { name: /yes, delete environment/i }),
      );

      await waitFor(() => {
        expect(
          useEnvironmentsStore.getState().environments.map((e) => e.id),
        ).toEqual(["env-a"]);
      });
      expect(useEnvironmentsStore.getState().activeEnvId).toBe("env-a");
    });
  });

  describe("new environment input", () => {
    beforeEach(() => {
      useUIStore.setState({ isCreatingEnv: true });
    });

    it("ignores Enter on a blank name", () => {
      renderTab();
      fireEvent.keyDown(screen.getByPlaceholderText("Environment name"), {
        key: "Enter",
      });
      expect(useEnvironmentsStore.getState().environments).toHaveLength(0);
      expect(useUIStore.getState().isCreatingEnv).toBe(true);
    });

    it("cancels on Escape and on blur", () => {
      renderTab();
      fireEvent.keyDown(screen.getByPlaceholderText("Environment name"), {
        key: "Escape",
      });
      expect(useUIStore.getState().isCreatingEnv).toBe(false);

      act(() => useUIStore.setState({ isCreatingEnv: true }));
      fireEvent.blur(screen.getByPlaceholderText("Environment name"));
      expect(useUIStore.getState().isCreatingEnv).toBe(false);
    });

    it("focuses the input after the accordion animation delay", () => {
      vi.useFakeTimers();
      try {
        renderTab();
        act(() => {
          vi.advanceTimersByTime(150);
        });
        expect(screen.getByPlaceholderText("Environment name")).toHaveFocus();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("renders nothing for environments until they are hydrated", () => {
    useEnvironmentsStore.setState({ hydrated: false });
    renderTab();
    expect(screen.queryByText("No environments")).not.toBeInTheDocument();
  });

  describe("pinned section", () => {
    const pinned = {
      id: "req-p",
      collectionId: "c",
      name: "Pinned One",
      method: "GET" as const,
      url: "https://x.test",
      params: [],
      headers: [],
      auth: { type: "none" as const },
      body: { type: "none" as const, content: "" },
      preScript: "",
      postScript: "",
      createdAt: 1,
      updatedAt: 1,
    };

    it("is hidden when nothing is pinned", () => {
      renderTab();
      expect(screen.queryByText("Pinned")).not.toBeInTheDocument();
    });

    it("lists pinned requests and skips ids that no longer exist", () => {
      useCollectionsStore.setState({ requests: [pinned] });
      useSettingsStore.setState({ pinnedRequestIds: ["gone", "req-p"] });
      renderTab();

      expect(screen.getByText("Pinned")).toBeInTheDocument();
      expect(screen.getByText("Pinned One")).toBeInTheDocument();
    });

    it("marks the pinned request of the active tab as active", async () => {
      const { useTabsStore } = await import("@/stores/useTabsStore");
      useCollectionsStore.setState({ requests: [pinned] });
      useSettingsStore.setState({ pinnedRequestIds: ["req-p"] });
      useTabsStore.setState({
        tabs: [{ tabId: "t1", type: "http", requestId: "req-p" } as never],
        activeTabId: "t1",
      });
      renderTab();
      expect(screen.getByTestId("request-item").className).toContain(
        "border-l-theme-accent",
      );
      useTabsStore.setState({ tabs: [], activeTabId: null });
    });
  });

  describe("expand/collapse all folders", () => {
    const folders = [
      { id: "f1", collectionId: "c", name: "A", parentFolderId: null, order: 0 },
      { id: "f2", collectionId: "c", name: "B", parentFolderId: null, order: 1 },
    ];

    it("is absent when there are no folders", () => {
      renderTab();
      expect(
        screen.queryByTestId("toggle-all-folders-btn"),
      ).not.toBeInTheDocument();
    });

    it("offers collapse when all are expanded and expand once some are collapsed", async () => {
      const user = userEvent.setup();
      useCollectionsStore.setState({ folders });
      renderTab();

      const btn = screen.getByTestId("toggle-all-folders-btn");
      expect(btn).toHaveAttribute("aria-label", "Collapse all folders");
      await user.click(btn);
      expect(useFolderExpandStore.getState().collapsedFolderIds).toEqual(
        expect.arrayContaining(["f1", "f2"]),
      );

      const after = screen.getByTestId("toggle-all-folders-btn");
      expect(after).toHaveAttribute("aria-label", "Expand all folders");
      await user.click(after);
      expect(useFolderExpandStore.getState().collapsedFolderIds).toEqual([]);
    });
  });

  describe("section persistence", () => {
    beforeEach(() => {
      localStorage.removeItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    });

    afterEach(() => {
      localStorage.removeItem(SIDEBAR_SECTIONS_STORAGE_KEY);
      vi.restoreAllMocks();
    });

    it("persists open sections when a header is toggled", async () => {
      const user = userEvent.setup();
      renderTab();
      await user.click(screen.getByText("Chains"));
      const stored = JSON.parse(
        localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY) ?? "[]",
      );
      expect(stored).not.toContain("chains");
      expect(stored).toContain("collections");
    });

    it("falls back to every section open when the stored value is corrupt", () => {
      localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, "{not json");
      renderTab();
      expect(screen.getByTestId("collection-tree-mock")).toBeVisible();
      expect(screen.getByTestId("chain-list-mock")).toBeVisible();
    });

    it("warns instead of throwing when storage rejects the write", async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
      try {
        renderTab();

        await user.click(screen.getByText("Chains"));

        expect(warn).toHaveBeenCalledWith(
          "Failed to persist sidebar open sections",
          expect.any(Error),
        );
      } finally {
        setItem.mockRestore();
        warn.mockRestore();
      }
    });
  });
});
