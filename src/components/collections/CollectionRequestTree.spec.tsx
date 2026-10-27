/** @vitest-environment happy-dom */

import {
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
import type { CollectionFolderModel, RequestModel } from "@/types";
import { CollectionRequestTree } from "./CollectionRequestTree";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeFolder(
  overrides: Partial<CollectionFolderModel> & { id: string },
): CollectionFolderModel {
  return {
    collectionId: "col-1",
    name: overrides.id,
    parentFolderId: null,
    order: 0,
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<RequestModel> & { id: string },
): RequestModel {
  return {
    collectionId: "col-1",
    name: overrides.id,
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
    ...overrides,
  };
}

const parent = makeFolder({ id: "f-parent", name: "Parent", order: 0 });
const child = makeFolder({
  id: "f-child",
  name: "Child",
  parentFolderId: "f-parent",
  order: 0,
});
const rootReq = makeRequest({ id: "r-root", name: "RootReq", createdAt: 5 });
const parentReq = makeRequest({
  id: "r-parent",
  name: "ParentReq",
  folderId: "f-parent",
});
const childReq = makeRequest({
  id: "r-child",
  name: "ChildReq",
  folderId: "f-child",
});

function seedStore(
  folders: CollectionFolderModel[],
  requests: RequestModel[],
) {
  useCollectionsStore.setState({
    collections: [],
    folders,
    requests,
    hydrated: true,
  });
}

function renderTree(
  folders: CollectionFolderModel[],
  requests: RequestModel[],
  extra: Partial<React.ComponentProps<typeof CollectionRequestTree>> = {},
) {
  seedStore(folders, requests);
  return render(
    <CollectionRequestTree
      folders={folders}
      requests={requests}
      activeRequestId={null}
      {...extra}
    />,
  );
}

function folderIcon(folderId: string) {
  const row = screen.getByTestId(`folder-item-${folderId}`);
  return {
    chevronRight: row.querySelector("svg.lucide-chevron-right"),
    chevronDown: row.querySelector("svg.lucide-chevron-down"),
    folder: row.querySelector("svg.lucide-folder"),
    folderOpen: row.querySelector("svg.lucide-folder-open"),
  };
}

beforeEach(() => {
  localStorage.clear();
  useFolderExpandStore.setState({ collapsedFolderIds: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
});

afterEach(() => {
  cleanup();
  useCollectionsStore.setState({
    collections: [],
    folders: [],
    requests: [],
  });
  vi.clearAllMocks();
});

describe("CollectionRequestTree", () => {
  it("shows an empty hint when there are no requests", () => {
    renderTree([], []);
    expect(screen.getByText("No requests yet")).toBeInTheDocument();
  });

  it("renders a flat list sorted by creation time when there are no folders", () => {
    const late = makeRequest({ id: "late", name: "Late", createdAt: 9 });
    const early = makeRequest({ id: "early", name: "Early", createdAt: 2 });
    renderTree([], [late, early]);
    const names = screen
      .getAllByText(/^(Late|Early)$/)
      .map((el) => el.textContent);
    expect(names).toEqual(["Early", "Late"]);
  });

  it("renders root folders with descendant request counts and root requests after them", () => {
    renderTree([parent, child], [rootReq, parentReq, childReq]);
    expect(screen.getByTestId("folder-item-f-parent")).toHaveTextContent(
      "Parent2",
    );
    expect(screen.getByTestId("folder-item-f-child")).toHaveTextContent(
      "Child1",
    );
    expect(screen.getByText("RootReq")).toBeInTheDocument();
  });

  it("shows ChevronDown and the open-folder icon while a folder is expanded", () => {
    renderTree([parent, child], [parentReq, childReq]);
    const parentIcons = folderIcon("f-parent");
    expect(parentIcons.chevronDown).not.toBeNull();
    expect(parentIcons.chevronRight).toBeNull();
    expect(parentIcons.folderOpen).not.toBeNull();
    expect(parentIcons.folder).toBeNull();
    expect(screen.getByText("ParentReq")).toBeInTheDocument();
    expect(screen.getByTestId("folder-item-f-child")).toBeInTheDocument();
  });

  it("swaps to ChevronRight and the closed-folder icon on toggle and hides children", async () => {
    const user = userEvent.setup();
    renderTree([parent, child], [parentReq, childReq]);

    await user.click(screen.getByTestId("folder-item-f-parent"));

    const icons = folderIcon("f-parent");
    expect(icons.chevronRight).not.toBeNull();
    expect(icons.chevronDown).toBeNull();
    expect(icons.folder).not.toBeNull();
    expect(icons.folderOpen).toBeNull();
    expect(screen.queryByText("ParentReq")).not.toBeInTheDocument();
    expect(screen.queryByTestId("folder-item-f-child")).not.toBeInTheDocument();
  });

  it("swaps the icon of a nested subfolder independently of its parent", async () => {
    const user = userEvent.setup();
    renderTree([parent, child], [parentReq, childReq]);

    await user.click(screen.getByTestId("folder-item-f-child"));

    const childIcons = folderIcon("f-child");
    expect(childIcons.chevronRight).not.toBeNull();
    expect(childIcons.folder).not.toBeNull();
    expect(folderIcon("f-parent").folderOpen).not.toBeNull();
    expect(screen.queryByText("ChildReq")).not.toBeInTheDocument();
    expect(screen.getByText("ParentReq")).toBeInTheDocument();
  });

  it("toggles with Enter and Space but ignores other keys", () => {
    renderTree([parent], [parentReq]);
    const row = screen.getByTestId("folder-item-f-parent");

    fireEvent.keyDown(row, { key: "a" });
    expect(folderIcon("f-parent").folderOpen).not.toBeNull();

    fireEvent.keyDown(row, { key: "Enter" });
    expect(folderIcon("f-parent").folder).not.toBeNull();

    fireEvent.keyDown(row, { key: " " });
    expect(folderIcon("f-parent").folderOpen).not.toBeNull();
  });

  it("starts a folder collapsed when the persisted store says so", () => {
    useFolderExpandStore.setState({ collapsedFolderIds: ["f-parent"] });
    renderTree([parent], [parentReq]);
    expect(folderIcon("f-parent").chevronRight).not.toBeNull();
    expect(screen.queryByText("ParentReq")).not.toBeInTheDocument();
  });

  it("renames a folder via the dropdown and commits on Enter", async () => {
    const user = userEvent.setup();
    renderTree([parent], [parentReq]);

    await user.click(screen.getByTestId("folder-more-btn-f-parent"));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

    const input = screen.getByDisplayValue("Parent");
    fireEvent.change(input, { target: { value: "  Renamed  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(
        useCollectionsStore.getState().folders.find((f) => f.id === "f-parent")
          ?.name,
      ).toBe("Renamed");
    });
    expect(screen.queryByDisplayValue("Renamed")).not.toBeInTheDocument();
  });

  it("keeps the original name when the rename is blank, committing on blur", () => {
    renderTree([parent], [parentReq], {
      renamingFolderId: "f-parent",
      onStartRename: vi.fn(),
      onRenamingDone: vi.fn(),
    });
    const input = screen.getByDisplayValue("Parent");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    expect(
      useCollectionsStore.getState().folders.find((f) => f.id === "f-parent")
        ?.name,
    ).toBe("Parent");
  });

  it("cancels rename on Escape without changing the name", () => {
    const onRenamingDone = vi.fn();
    renderTree([parent], [parentReq], {
      renamingFolderId: "f-parent",
      onStartRename: vi.fn(),
      onRenamingDone,
    });
    const input = screen.getByDisplayValue("Parent");
    fireEvent.change(input, { target: { value: "Nope" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onRenamingDone).toHaveBeenCalledTimes(1);
    expect(
      useCollectionsStore.getState().folders.find((f) => f.id === "f-parent")
        ?.name,
    ).toBe("Parent");
  });

  it("does not toggle the folder when the rename input is clicked", async () => {
    const user = userEvent.setup();
    renderTree([parent], [parentReq]);
    await user.click(screen.getByTestId("folder-more-btn-f-parent"));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

    await user.click(screen.getByDisplayValue("Parent"));

    expect(folderIcon("f-parent").folderOpen).not.toBeNull();
  });

  it("creates a subfolder from the dropdown, starts its rename and expands a collapsed parent", async () => {
    const user = userEvent.setup();
    useFolderExpandStore.setState({ collapsedFolderIds: ["f-parent"] });
    renderTree([parent], [parentReq]);

    await user.click(screen.getByTestId("folder-more-btn-f-parent"));
    await user.click(
      await screen.findByRole("menuitem", { name: "New Folder" }),
    );

    const folders = useCollectionsStore.getState().folders;
    const created = folders.find((f) => f.parentFolderId === "f-parent");
    expect(created).toBeDefined();
    expect(
      useFolderExpandStore.getState().collapsedFolderIds,
    ).not.toContain("f-parent");
  });

  it("creates a subfolder from the context menu", async () => {
    renderTree([parent], [parentReq]);
    fireEvent.contextMenu(screen.getByTestId("folder-item-f-parent"));

    fireEvent.click(await screen.findByRole("menuitem", { name: "New Folder" }));

    await waitFor(() => {
      expect(
        useCollectionsStore
          .getState()
          .folders.some((f) => f.parentFolderId === "f-parent"),
      ).toBe(true);
    });
  });

  it("duplicates a folder from the dropdown", async () => {
    const user = userEvent.setup();
    renderTree([parent], [parentReq]);

    await user.click(screen.getByTestId("folder-more-btn-f-parent"));
    await user.click(await screen.findByRole("menuitem", { name: "Duplicate" }));

    expect(useCollectionsStore.getState().folders).toHaveLength(2);
  });

  it("duplicates a folder from the context menu", async () => {
    renderTree([parent], [parentReq]);
    fireEvent.contextMenu(screen.getByTestId("folder-item-f-parent"));

    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));

    await waitFor(() => {
      expect(useCollectionsStore.getState().folders).toHaveLength(2);
    });
  });

  it("requests rename of the folder from the context menu", async () => {
    const onStartRename = vi.fn();
    renderTree([parent], [parentReq], {
      onStartRename,
      onRenamingDone: vi.fn(),
    });
    fireEvent.contextMenu(screen.getByTestId("folder-item-f-parent"));

    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));

    expect(onStartRename).toHaveBeenCalledWith("f-parent");
  });

  it("confirms before deleting a folder from the dropdown", async () => {
    const user = userEvent.setup();
    renderTree([parent], [parentReq]);

    await user.click(screen.getByTestId("folder-more-btn-f-parent"));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(await screen.findByText("Delete folder?")).toBeInTheDocument();
    expect(useCollectionsStore.getState().folders).toHaveLength(1);

    const confirm = screen
      .getAllByRole("button")
      .find((b) => /delete/i.test(b.textContent ?? "") && b.closest("[role=alertdialog],[role=dialog]"));
    expect(confirm).toBeDefined();
    fireEvent.click(confirm as HTMLElement);

    await waitFor(() => {
      expect(useCollectionsStore.getState().folders).toHaveLength(0);
    });
  });

  it("opens the delete confirmation from the context menu", async () => {
    renderTree([parent], [parentReq]);
    fireEvent.contextMenu(screen.getByTestId("folder-item-f-parent"));

    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(await screen.findByText("Delete folder?")).toBeInTheDocument();
  });

  it("uses internal rename state when no external handlers are provided", async () => {
    const user = userEvent.setup();
    renderTree([parent], [parentReq]);
    expect(screen.queryByDisplayValue("Parent")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("folder-more-btn-f-parent"));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

    expect(screen.getByDisplayValue("Parent")).toBeInTheDocument();
  });
});
