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
import { useFolderExpandStore } from "@/stores/useFolderExpandStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { CollectionModel, RequestModel } from "@/types";
import { CollectionTree } from "./CollectionTree";

function renderCollectionTree() {
  return render(<CollectionTree />);
}

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

const { downloadPostmanCollection } = vi.hoisted(() => ({
  downloadPostmanCollection: vi.fn(),
}));

vi.mock("@/lib/postmanExporter", () => ({ downloadPostmanCollection }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function resetStores() {
  useCollectionsStore.setState({
    collections: [],
    requests: [],
    folders: [],
    hydrated: true,
  });
  useFolderExpandStore.setState({
    collapsedFolderIds: [],
    openCollectionIds: [],
  });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useUIStore.setState({
    isCreatingCollection: false,
    envManagerOpen: false,
    envManagerFocusEnvId: null,
  });
}

beforeEach(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  resetStores();
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("CollectionTree", () => {
  it("shows empty state when there are no collections", () => {
    renderCollectionTree();
    expect(screen.getByText("No collections yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new collection/i }),
    ).toBeInTheDocument();
  });

  it("reveals new collection input when New Collection is clicked", async () => {
    const user = userEvent.setup();
    renderCollectionTree();

    await user.click(screen.getByRole("button", { name: /new collection/i }));

    expect(screen.getByTestId("new-collection-name-input")).toBeInTheDocument();
  });

  it("creates a collection when Enter is pressed with a non-empty name", async () => {
    const user = userEvent.setup();
    useUIStore.setState({ isCreatingCollection: true });
    renderCollectionTree();

    const input = screen.getByTestId("new-collection-name-input");
    await user.type(input, "My API{Enter}");

    await waitFor(() => {
      expect(useCollectionsStore.getState().collections).toHaveLength(1);
      expect(useCollectionsStore.getState().collections[0].name).toBe("My API");
    });
    expect(useUIStore.getState().isCreatingCollection).toBe(false);
  });

  it("renders collections with names and request counts", () => {
    const col: CollectionModel = {
      id: "col-1",
      name: "Prod",
      createdAt: 1,
      updatedAt: 1,
    };
    const req: RequestModel = {
      id: "req-1",
      collectionId: "col-1",
      name: "Health",
      method: "GET",
      url: "https://x.test",
      params: [],
      headers: [],
      auth: { type: "none" },
      body: { type: "none", content: "" },
      preScript: "",
      postScript: "",
      createdAt: 1,
      updatedAt: 1,
    };
    useCollectionsStore.setState({ collections: [col], requests: [req] });

    renderCollectionTree();

    expect(screen.getByTestId("collection-name-col-1")).toHaveTextContent(
      "Prod",
    );
    expect(screen.getByTestId("collection-item-col-1")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("expands accordion to show requests or empty hint", async () => {
    const user = userEvent.setup();
    const col: CollectionModel = {
      id: "col-a",
      name: "EmptyCol",
      createdAt: 1,
      updatedAt: 1,
    };
    useCollectionsStore.setState({ collections: [col], requests: [] });

    renderCollectionTree();

    await user.click(screen.getByTestId("collection-name-col-a"));

    expect(await screen.findByText("No requests yet")).toBeInTheDocument();
  });

  it("opens rename flow from collection dropdown and commits on blur", async () => {
    const user = userEvent.setup();
    const col: CollectionModel = {
      id: "col-r",
      name: "RenameMe",
      createdAt: 1,
      updatedAt: 1,
    };
    useCollectionsStore.setState({ collections: [col], requests: [] });

    renderCollectionTree();

    await user.click(screen.getByTestId("collection-more-btn-col-r"));
    await user.click(screen.getByTestId("collection-rename-btn"));

    const renameInput = screen.getByTestId("collection-rename-input");
    fireEvent.change(renameInput, { target: { value: "Renamed" } });
    fireEvent.blur(renameInput);

    await waitFor(() => {
      expect(useCollectionsStore.getState().collections[0].name).toBe(
        "Renamed",
      );
    });
  });

  it("opens delete confirmation from dropdown", async () => {
    const user = userEvent.setup();
    const col: CollectionModel = {
      id: "col-del",
      name: "DeleteMe",
      createdAt: 1,
      updatedAt: 1,
    };
    useCollectionsStore.setState({ collections: [col], requests: [] });

    renderCollectionTree();

    await user.click(screen.getByTestId("collection-more-btn-col-del"));
    await user.click(screen.getByTestId("collection-delete-btn"));

    expect(screen.getByText("Delete Collection")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /yes, delete collection/i }),
    );

    await waitFor(() => {
      expect(useCollectionsStore.getState().collections).toHaveLength(0);
    });
  });

  describe("collection rows", () => {
    const col: CollectionModel = {
      id: "col-x",
      name: "Alpha",
      createdAt: 1,
      updatedAt: 1,
    };
    const folder = {
      id: "fold-1",
      collectionId: "col-x",
      name: "Auth",
      parentFolderId: null,
      order: 0,
    };
    const req: RequestModel = {
      id: "req-x",
      collectionId: "col-x",
      name: "Login",
      method: "POST",
      url: "https://x.test/login",
      params: [],
      headers: [],
      auth: { type: "none" },
      body: { type: "none", content: "" },
      preScript: "",
      postScript: "",
      createdAt: 1,
      updatedAt: 1,
    };

    function seed(withContent = true) {
      useCollectionsStore.setState({
        collections: [col],
        folders: withContent ? [folder] : [],
        requests: withContent ? [req] : [],
      });
    }

    function trigger() {
      return screen
        .getByTestId("collection-name-col-x")
        .closest('[data-slot="accordion-trigger"]') as HTMLElement;
    }

    it("pairs a right chevron and closed folder (collapsed) with a down chevron and open folder (expanded)", async () => {
      const user = userEvent.setup();
      seed();
      renderCollectionTree();

      const t = trigger();
      expect(t).toHaveAttribute("aria-expanded", "false");
      expect(
        t.querySelector("svg.lucide-chevron-right")?.getAttribute("class"),
      ).toContain("group-aria-expanded/accordion-trigger:hidden");
      expect(
        t.querySelector("svg.lucide-chevron-down")?.getAttribute("class"),
      ).toContain("group-aria-expanded/accordion-trigger:inline");
      expect(
        t.querySelector("svg.lucide-folder")?.getAttribute("class"),
      ).toContain("group-aria-expanded/accordion-trigger:hidden");
      expect(
        t.querySelector("svg.lucide-folder-open")?.getAttribute("class"),
      ).toContain("group-aria-expanded/accordion-trigger:block");

      await user.click(screen.getByTestId("collection-name-col-x"));
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
    });

    it("shows folders and requests of the collection once expanded", async () => {
      const user = userEvent.setup();
      seed();
      renderCollectionTree();

      await user.click(screen.getByTestId("collection-name-col-x"));

      expect(await screen.findByTestId("folder-item-fold-1")).toBeVisible();
      expect(screen.getByText("Login")).toBeInTheDocument();
    });

    it("marks the request of the active tab as active", async () => {
      const user = userEvent.setup();
      useCollectionsStore.setState({
        collections: [col],
        folders: [],
        requests: [req],
      });
      useTabsStore.setState({
        tabs: [
          {
            tabId: "tab-1",
            type: "http",
            requestId: "req-x",
          } as never,
        ],
        activeTabId: "tab-1",
      });
      renderCollectionTree();

      await user.click(screen.getByTestId("collection-name-col-x"));

      expect((await screen.findByTestId("request-item")).className).toContain(
        "border-l-theme-accent",
      );
    });

    it("creates a folder from the dropdown and starts renaming it", async () => {
      const user = userEvent.setup();
      seed(false);
      renderCollectionTree();

      await user.click(screen.getByTestId("collection-more-btn-col-x"));
      await user.click(
        await screen.findByRole("menuitem", { name: "New Folder" }),
      );

      const created = useCollectionsStore.getState().folders;
      expect(created).toHaveLength(1);
      expect(created[0].collectionId).toBe("col-x");
    });

    it("exports the collection with only its own folders and requests from the dropdown", async () => {
      const user = userEvent.setup();
      const otherFolder = { ...folder, id: "fold-2", collectionId: "other" };
      useCollectionsStore.setState({
        collections: [col],
        folders: [folder, otherFolder],
        requests: [req],
      });
      renderCollectionTree();

      await user.click(screen.getByTestId("collection-more-btn-col-x"));
      await user.click(
        await screen.findByRole("menuitem", { name: /export as postman/i }),
      );

      expect(downloadPostmanCollection).toHaveBeenCalledWith(
        col,
        [req],
        [folder],
      );
    });

    it("runs create-folder, export and delete from the context menu", async () => {
      seed();
      renderCollectionTree();
      const open = () => fireEvent.contextMenu(trigger());

      open();
      fireEvent.click(await screen.findByRole("menuitem", { name: "New Folder" }));
      await waitFor(() => {
        expect(useCollectionsStore.getState().folders).toHaveLength(2);
      });

      open();
      fireEvent.click(
        await screen.findByRole("menuitem", { name: /export as postman/i }),
      );
      expect(downloadPostmanCollection).toHaveBeenCalledTimes(1);

      open();
      fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
      expect(await screen.findByText("Delete Collection")).toBeInTheDocument();
    });

    it("starts renaming from the context menu with the current name", async () => {
      const user = userEvent.setup();
      seed(false);
      renderCollectionTree();

      await user.pointer({ keys: "[MouseRight]", target: trigger() });
      await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

      expect(screen.getByTestId("collection-rename-input")).toHaveValue("Alpha");
    });

    it("keeps the original name when the rename is blank and cancels on Escape", async () => {
      const user = userEvent.setup();
      seed(false);
      renderCollectionTree();

      await user.click(screen.getByTestId("collection-more-btn-col-x"));
      await user.click(screen.getByTestId("collection-rename-btn"));
      const input = screen.getByTestId("collection-rename-input");
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useCollectionsStore.getState().collections[0].name).toBe("Alpha");
      expect(
        screen.queryByTestId("collection-rename-input"),
      ).not.toBeInTheDocument();

      await user.click(screen.getByTestId("collection-more-btn-col-x"));
      await user.click(screen.getByTestId("collection-rename-btn"));
      const again = screen.getByTestId("collection-rename-input");
      fireEvent.change(again, { target: { value: "Zeta" } });
      fireEvent.keyDown(again, { key: "Escape" });

      expect(useCollectionsStore.getState().collections[0].name).toBe("Alpha");
    });

    it("renames on Enter with a new name", async () => {
      const user = userEvent.setup();
      seed(false);
      renderCollectionTree();

      await user.click(screen.getByTestId("collection-more-btn-col-x"));
      await user.click(screen.getByTestId("collection-rename-btn"));
      const input = screen.getByTestId("collection-rename-input");
      fireEvent.change(input, { target: { value: "  Beta " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useCollectionsStore.getState().collections[0].name).toBe("Beta");
    });

    it("deletes nothing when the confirmation is dismissed", async () => {
      const user = userEvent.setup();
      seed(false);
      renderCollectionTree();

      await user.click(screen.getByTestId("collection-more-btn-col-x"));
      await user.click(screen.getByTestId("collection-delete-btn"));
      expect(await screen.findByText("Delete Collection")).toBeInTheDocument();
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Delete Collection")).not.toBeInTheDocument();
      });
      expect(useCollectionsStore.getState().collections).toHaveLength(1);
    });

    it("creates a collection from the input above the list and cancels on Escape or blur", async () => {
      const user = userEvent.setup();
      seed(false);
      useUIStore.setState({ isCreatingCollection: true });
      renderCollectionTree();

      const input = screen.getByTestId("new-collection-name-input");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(useCollectionsStore.getState().collections).toHaveLength(1);

      await user.type(input, "Gamma{Enter}");
      expect(useCollectionsStore.getState().collections).toHaveLength(2);
      expect(useUIStore.getState().isCreatingCollection).toBe(false);

      useUIStore.setState({ isCreatingCollection: true });
      fireEvent.keyDown(await screen.findByTestId("new-collection-name-input"), {
        key: "Escape",
      });
      expect(useUIStore.getState().isCreatingCollection).toBe(false);

      useUIStore.setState({ isCreatingCollection: true });
      fireEvent.blur(await screen.findByTestId("new-collection-name-input"));
      expect(useUIStore.getState().isCreatingCollection).toBe(false);
    });
  });

  describe("empty and loading states", () => {
    it("renders nothing while hydrating with no collections", () => {
      useCollectionsStore.setState({ hydrated: false });
      const { container } = renderCollectionTree();
      expect(container).toBeEmptyDOMElement();
    });

    it("opens the import dialog flag from the empty state", async () => {
      const user = userEvent.setup();
      renderCollectionTree();
      await user.click(screen.getByRole("button", { name: "Import" }));
      expect(useUIStore.getState().isImportOpen).toBe(true);
    });

    it("hides the action buttons and handles Escape/blur/empty Enter while creating", async () => {
      useUIStore.setState({ isCreatingCollection: true });
      renderCollectionTree();
      expect(
        screen.queryByRole("button", { name: /new collection/i }),
      ).not.toBeInTheDocument();

      const input = screen.getByTestId("new-collection-name-input");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(useCollectionsStore.getState().collections).toHaveLength(0);

      fireEvent.keyDown(input, { key: "Escape" });
      expect(useUIStore.getState().isCreatingCollection).toBe(false);

      useUIStore.setState({ isCreatingCollection: true });
      fireEvent.blur(await screen.findByTestId("new-collection-name-input"));
      expect(useUIStore.getState().isCreatingCollection).toBe(false);
    });

    it("focuses the new-collection input after the accordion animation delay", () => {
      vi.useFakeTimers();
      try {
        useUIStore.setState({ isCreatingCollection: true });
        renderCollectionTree();
        act(() => {
          vi.advanceTimersByTime(150);
        });
        expect(screen.getByTestId("new-collection-name-input")).toHaveFocus();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
