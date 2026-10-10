/** @vitest-environment happy-dom */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useFolderExpandStore } from "@/stores/useFolderExpandStore";
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
    const collectionsPanel = screen
      .getByTestId("collection-tree-mock")
      .closest('[data-slot="accordion-content"]');
    const chainsPanel = screen
      .getByTestId("chain-list-mock")
      .closest('[data-slot="accordion-content"]');

    expect(collectionsPanel).not.toBeNull();
    expect(chainsPanel).not.toBeNull();
    expect(collectionsPanel).not.toBe(chainsPanel);
    expect(collectionsPanel).toBeVisible();
    expect(chainsPanel).toBeVisible();
    expect(collectionsPanel).not.toContainElement(
      screen.getByTestId("chain-list-mock"),
    );
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

  it("rejects a duplicate environment name with an inline error and does not save", async () => {
    const user = userEvent.setup();
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e1",
          name: "Staging",
          variables: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      hydrated: true,
    });
    useUIStore.setState({ isCreatingEnv: true });
    render(
      <SidebarMainTab
        isCreatingChain={false}
        onCreatingChainDone={vi.fn()}
        onNewChain={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Environment name");
    await user.type(input, "  staging {Enter}");

    expect(screen.getByTestId("env-create-name-error")).toBeInTheDocument();
    expect(useEnvironmentsStore.getState().environments).toHaveLength(1);
    expect(useUIStore.getState().isCreatingEnv).toBe(true);
  });

  it("clears the duplicate-name error when the user edits the name", async () => {
    const user = userEvent.setup();
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e1",
          name: "Staging",
          variables: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      hydrated: true,
    });
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
    await user.type(input, "2{Enter}");

    expect(screen.queryByTestId("env-create-name-error")).toBeNull();
    expect(
      useEnvironmentsStore.getState().environments.map((e) => e.name),
    ).toEqual(["Staging", "Staging2"]);
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

  describe("environments section", () => {
    function seedEnvs(activeEnvId: string | null = null) {
      const env = (id: string, name: string) => ({
        id,
        name,
        variables: [],
        createdAt: 1,
        updatedAt: 1,
      });
      useEnvironmentsStore.setState({
        environments: [env("e-dev", "Dev"), env("e-prod", "Prod")],
        activeEnvId,
        hydrated: true,
      });
    }

    function renderTab() {
      return render(
        <SidebarMainTab
          isCreatingChain={false}
          onCreatingChainDone={vi.fn()}
          onNewChain={vi.fn()}
        />,
      );
    }

    function rowFor(name: string): HTMLElement {
      const row = screen.getByText(name).closest("div.group");
      if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`);
      return row;
    }

    async function openDeleteDialog(
      user: ReturnType<typeof userEvent.setup>,
      name: string,
    ) {
      await user.click(within(rowFor(name)).getByRole("button"));
      await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
    }

    it("hides the empty state and lists every environment when some exist", () => {
      seedEnvs();
      renderTab();

      expect(screen.queryByText("No environments")).toBeNull();
      expect(screen.getByText("Dev")).toBeInTheDocument();
      expect(screen.getByText("Prod")).toBeInTheDocument();
    });

    it("shows the Active badge only on the active environment", () => {
      seedEnvs("e-prod");
      renderTab();

      expect(within(rowFor("Prod")).getByText("active")).toBeInTheDocument();
      expect(within(rowFor("Dev")).queryByText("active")).toBeNull();
    });

    it("clicking an inactive environment activates it and opens the manager on it", async () => {
      const user = userEvent.setup();
      seedEnvs();
      renderTab();

      await user.click(screen.getByText("Dev"));

      expect(useEnvironmentsStore.getState().activeEnvId).toBe("e-dev");
      expect(useUIStore.getState().envManagerOpen).toBe(true);
      expect(useUIStore.getState().envManagerFocusEnvId).toBe("e-dev");
    });

    it("clicking the already-active environment deactivates it", async () => {
      const user = userEvent.setup();
      seedEnvs("e-dev");
      renderTab();

      await user.click(screen.getByText("Dev"));

      expect(useEnvironmentsStore.getState().activeEnvId).toBeNull();
    });

    it("deletes an environment after confirming", async () => {
      const user = userEvent.setup();
      seedEnvs("e-dev");
      renderTab();

      await openDeleteDialog(user, "Prod");
      await user.click(
        await screen.findByRole("button", { name: /yes, delete environment/i }),
      );

      expect(
        useEnvironmentsStore.getState().environments.map((e) => e.id),
      ).toEqual(["e-dev"]);
      expect(useEnvironmentsStore.getState().activeEnvId).toBe("e-dev");
    });

    it("keeps the environment when the delete dialog is cancelled", async () => {
      const user = userEvent.setup();
      seedEnvs("e-dev");
      renderTab();

      await openDeleteDialog(user, "Prod");
      await user.click(await screen.findByRole("button", { name: /cancel/i }));

      expect(useEnvironmentsStore.getState().environments).toHaveLength(2);
      expect(screen.getByText("Prod")).toBeInTheDocument();
    });

    it("deleting the active environment clears the active selection", async () => {
      const user = userEvent.setup();
      seedEnvs("e-dev");
      renderTab();

      await openDeleteDialog(user, "Dev");
      await user.click(
        await screen.findByRole("button", { name: /yes, delete environment/i }),
      );

      expect(useEnvironmentsStore.getState().activeEnvId).toBeNull();
      expect(
        useEnvironmentsStore.getState().environments.map((e) => e.id),
      ).toEqual(["e-prod"]);
    });

    it("pressing Enter on a whitespace-only name creates an environment with the default name", async () => {
      const user = userEvent.setup();
      useUIStore.setState({ isCreatingEnv: true });
      renderTab();

      await user.type(screen.getByPlaceholderText("Environment name"), "   {Enter}");

      expect(
        useEnvironmentsStore.getState().environments.map((e) => e.name),
      ).toEqual(["New Environment"]);
      expect(useUIStore.getState().isCreatingEnv).toBe(false);
    });

    it("pressing Escape in the new-environment input cancels creation", async () => {
      const user = userEvent.setup();
      useUIStore.setState({ isCreatingEnv: true });
      renderTab();

      await user.type(screen.getByPlaceholderText("Environment name"), "Temp{Escape}");

      expect(useEnvironmentsStore.getState().environments).toHaveLength(0);
      expect(useUIStore.getState().isCreatingEnv).toBe(false);
    });

    it("trims surrounding whitespace from the created environment name", async () => {
      const user = userEvent.setup();
      useUIStore.setState({ isCreatingEnv: true });
      renderTab();

      await user.type(screen.getByPlaceholderText("Environment name"), "  QA  {Enter}");

      expect(
        useEnvironmentsStore.getState().environments.map((e) => e.name),
      ).toEqual(["QA"]);
    });
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
  describe("open-section persistence", () => {
    function renderTab() {
      return render(
        <SidebarMainTab
          isCreatingChain={false}
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

    const spies: MockInstance[] = [];

    afterEach(() => {
      for (const spy of spies.splice(0)) spy.mockRestore();
      localStorage.removeItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    });

    it("opens every section by default when nothing is stored", () => {
      renderTab();
      expect(screen.getByTestId("collection-tree-mock")).toBeVisible();
      expect(screen.getByTestId("chain-list-mock")).toBeVisible();
      expect(screen.getByText("No environments")).toBeVisible();
    });

    it("restores only the stored open sections", () => {
      localStorage.setItem(
        SIDEBAR_SECTIONS_STORAGE_KEY,
        JSON.stringify(["collections"]),
      );
      renderTab();

      expect(screen.getByTestId("collection-tree-mock")).toBeVisible();
      expect(screen.queryByTestId("chain-list-mock")).toBeNull();
      expect(screen.queryByText("No environments")).toBeNull();
    });

    it("falls back to all sections open when the stored value is corrupt JSON", () => {
      localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, "{not-json");
      renderTab();

      expect(screen.getByTestId("collection-tree-mock")).toBeVisible();
      expect(screen.getByTestId("chain-list-mock")).toBeVisible();
    });

    it("falls back to all sections open when reading storage throws", () => {
      spies.push(
        vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
          throw new Error("SecurityError");
        }),
      );
      renderTab();

      expect(screen.getByTestId("collection-tree-mock")).toBeVisible();
      expect(screen.getByTestId("chain-list-mock")).toBeVisible();
    });

    it("persists the remaining open sections after the user collapses one", async () => {
      const user = userEvent.setup();
      renderTab();

      await user.click(screen.getByText("Chains"));

      expect(storedSections()).toEqual([
        "pinned",
        "collections",
        "environments",
      ]);
      expect(screen.queryByTestId("chain-list-mock")).toBeNull();
    });

    it("warns and keeps the section toggle working when persisting fails", async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      spies.push(
        warn,
        vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
          throw new Error("QuotaExceededError");
        }),
      );
      renderTab();

      await user.click(screen.getByText("Chains"));

      expect(warn).toHaveBeenCalledWith(
        "Failed to persist sidebar open sections",
        expect.any(Error),
      );
      expect(screen.queryByTestId("chain-list-mock")).toBeNull();
    });
  });

  describe("expand/collapse all folders button", () => {
    const folder = (id: string) =>
      ({ id, name: id }) as unknown as ReturnType<
        typeof useCollectionsStore.getState
      >["folders"][number];

    function renderTab() {
      return render(
        <SidebarMainTab
          isCreatingChain={false}
          onCreatingChainDone={vi.fn()}
          onNewChain={vi.fn()}
        />,
      );
    }

    beforeEach(() => {
      useCollectionsStore.setState({ folders: [] });
      useFolderExpandStore.setState({ collapsedFolderIds: [] });
    });

    afterEach(() => {
      useCollectionsStore.setState({ folders: [] });
      useFolderExpandStore.setState({ collapsedFolderIds: [] });
      localStorage.removeItem("rq_collapsed_folders");
    });

    it("is hidden when there are no folders", () => {
      renderTab();
      expect(screen.queryByTestId("toggle-all-folders-btn")).toBeNull();
    });

    it("offers to collapse all when every folder is expanded", () => {
      useCollectionsStore.setState({ folders: [folder("f1"), folder("f2")] });
      renderTab();

      expect(screen.getByTestId("toggle-all-folders-btn")).toHaveAttribute(
        "aria-label",
        "Collapse all folders",
      );
    });

    it("offers to expand all when at least one folder is collapsed", () => {
      useCollectionsStore.setState({ folders: [folder("f1"), folder("f2")] });
      useFolderExpandStore.setState({ collapsedFolderIds: ["f2"] });
      renderTab();

      expect(screen.getByTestId("toggle-all-folders-btn")).toHaveAttribute(
        "aria-label",
        "Expand all folders",
      );
    });

    it("collapses every folder on click and flips the label to expand", async () => {
      const user = userEvent.setup();
      useCollectionsStore.setState({ folders: [folder("f1"), folder("f2")] });
      renderTab();

      await user.click(screen.getByTestId("toggle-all-folders-btn"));

      expect([...useFolderExpandStore.getState().collapsedFolderIds].sort()).toEqual([
        "f1",
        "f2",
      ]);
      expect(screen.getByTestId("toggle-all-folders-btn")).toHaveAttribute(
        "aria-label",
        "Expand all folders",
      );
    });

    it("expands every folder on click when some are collapsed", async () => {
      const user = userEvent.setup();
      useCollectionsStore.setState({ folders: [folder("f1"), folder("f2")] });
      useFolderExpandStore.setState({ collapsedFolderIds: ["f1"] });
      renderTab();

      await user.click(screen.getByTestId("toggle-all-folders-btn"));

      expect(useFolderExpandStore.getState().collapsedFolderIds).toEqual([]);
    });

    it("does not toggle the Collections section when the button is clicked", async () => {
      const user = userEvent.setup();
      useCollectionsStore.setState({ folders: [folder("f1")] });
      renderTab();

      await user.click(screen.getByTestId("toggle-all-folders-btn"));

      expect(screen.getByTestId("collection-tree-mock")).toBeVisible();
    });
  });
});
