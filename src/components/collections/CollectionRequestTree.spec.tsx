/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useFolderExpandStore } from "@/stores/useFolderExpandStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { CollectionFolderModel, RequestModel } from "@/types";
import { CollectionRequestTree } from "./CollectionRequestTree";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function resetStores() {
  useCollectionsStore.setState({ collections: [], folders: [], requests: [] });
  useFolderExpandStore.setState({ collapsedFolderIds: [] });
  useSettingsStore.setState({ showHealthMonitor: false });
}

function folder(
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

function request(
  overrides: Partial<RequestModel> & { id: string },
): RequestModel {
  return {
    collectionId: "col-1",
    name: overrides.id,
    method: "GET",
    url: "https://api.example.com",
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

/** Mirrors the production parent: the tree is fed live from the real store. */
function ConnectedTree() {
  const folders = useCollectionsStore((s) => s.folders);
  const requests = useCollectionsStore((s) => s.requests);
  return (
    <CollectionRequestTree
      folders={folders}
      requests={requests}
      activeRequestId={null}
    />
  );
}

/** Seeds the real store and renders the tree from it. */
function renderTree(
  folders: CollectionFolderModel[],
  requests: RequestModel[],
) {
  useCollectionsStore.setState({
    collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
    folders,
    requests,
  });
  return render(<ConnectedTree />);
}

async function openFolderMenu(
  user: ReturnType<typeof userEvent.setup>,
  folderId: string,
) {
  await user.click(screen.getByTestId(`folder-more-btn-${folderId}`));
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("CollectionRequestTree rendering", () => {
  it("shows an empty message when there are no requests", () => {
    renderTree([folder({ id: "f1" })], []);

    expect(screen.getByText("No requests yet")).toBeInTheDocument();
  });

  it("renders a flat request list when there are no folders", () => {
    renderTree(
      [],
      [
        request({ id: "r1", name: "Second", createdAt: 2 }),
        request({ id: "r2", name: "First", createdAt: 1 }),
      ],
    );

    const items = screen.getAllByTestId("request-item");
    expect(items.map((el) => el.textContent)).toEqual([
      expect.stringContaining("First"),
      expect.stringContaining("Second"),
    ]);
  });

  it("renders nested folders with their requests and root requests", () => {
    renderTree(
      [
        folder({ id: "parent", name: "Parent" }),
        folder({ id: "child", name: "Child", parentFolderId: "parent" }),
      ],
      [
        request({ id: "r-root", name: "Root Req" }),
        request({ id: "r-parent", name: "Parent Req", folderId: "parent" }),
        request({ id: "r-child", name: "Child Req", folderId: "child" }),
      ],
    );

    expect(screen.getByTestId("folder-item-parent")).toBeInTheDocument();
    expect(screen.getByTestId("folder-item-child")).toBeInTheDocument();
    expect(screen.getByText("Root Req")).toBeInTheDocument();
    expect(screen.getByText("Parent Req")).toBeInTheDocument();
    expect(screen.getByText("Child Req")).toBeInTheDocument();
  });

  it("shows the total of direct and nested requests as the folder count", () => {
    renderTree(
      [
        folder({ id: "parent", name: "Parent" }),
        folder({ id: "child", name: "Child", parentFolderId: "parent" }),
        folder({ id: "grand", name: "Grand", parentFolderId: "child" }),
      ],
      [
        request({ id: "r1", folderId: "parent" }),
        request({ id: "r2", folderId: "child" }),
        request({ id: "r3", folderId: "grand" }),
        request({ id: "r4", folderId: "grand" }),
      ],
    );

    expect(screen.getByTestId("folder-item-parent")).toHaveTextContent("4");
    expect(screen.getByTestId("folder-item-child")).toHaveTextContent("3");
    expect(screen.getByTestId("folder-item-grand")).toHaveTextContent("2");
  });

  it("hides folder contents after the folder header is clicked", async () => {
    const user = userEvent.setup();
    renderTree(
      [folder({ id: "f1", name: "Docs" })],
      [request({ id: "r1", name: "Inside", folderId: "f1" })],
    );

    await user.click(screen.getByTestId("folder-item-f1"));

    expect(screen.queryByText("Inside")).not.toBeInTheDocument();
    expect(useFolderExpandStore.getState().collapsedFolderIds).toContain("f1");
  });
});

describe("CollectionRequestTree folder menu", () => {
  it("creates a subfolder inside the folder and starts renaming it", async () => {
    const user = userEvent.setup();
    renderTree(
      [folder({ id: "f1", name: "Parent" })],
      [request({ id: "r1", folderId: "f1" })],
    );

    await openFolderMenu(user, "f1");
    await user.click(screen.getByRole("menuitem", { name: /new folder/i }));

    const created = useCollectionsStore
      .getState()
      .folders.find((f) => f.parentFolderId === "f1");
    expect(created).toBeDefined();
    expect(created?.collectionId).toBe("col-1");
    expect(await screen.findByDisplayValue("New Folder")).toBeInTheDocument();
  });

  it("renames the folder when a new name is entered and confirmed", async () => {
    const user = userEvent.setup();
    renderTree(
      [folder({ id: "f1", name: "Old" })],
      [request({ id: "r1", folderId: "f1" })],
    );

    await openFolderMenu(user, "f1");
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));
    const input = await screen.findByDisplayValue("Old");
    await user.clear(input);
    await user.type(input, "Renamed{Enter}");

    await waitFor(() => {
      expect(
        useCollectionsStore.getState().folders.find((f) => f.id === "f1")?.name,
      ).toBe("Renamed");
    });
  });

  it("keeps the original name when the rename input is left blank", async () => {
    const user = userEvent.setup();
    renderTree(
      [folder({ id: "f1", name: "Keep Me" })],
      [request({ id: "r1", folderId: "f1" })],
    );

    await openFolderMenu(user, "f1");
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));
    const input = await screen.findByDisplayValue("Keep Me");
    await user.clear(input);
    await user.type(input, "   {Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
    expect(
      useCollectionsStore.getState().folders.find((f) => f.id === "f1")?.name,
    ).toBe("Keep Me");
  });

  it("leaves the name unchanged when rename is cancelled with Escape", async () => {
    const user = userEvent.setup();
    renderTree(
      [folder({ id: "f1", name: "Stay" })],
      [request({ id: "r1", folderId: "f1" })],
    );

    await openFolderMenu(user, "f1");
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));
    const input = await screen.findByDisplayValue("Stay");
    await user.type(input, "xyz{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
    expect(
      useCollectionsStore.getState().folders.find((f) => f.id === "f1")?.name,
    ).toBe("Stay");
  });

  it("expands a collapsed folder when a subfolder is created in it", async () => {
    const user = userEvent.setup();
    useFolderExpandStore.setState({ collapsedFolderIds: ["f1"] });
    renderTree(
      [folder({ id: "f1", name: "Parent" })],
      [request({ id: "r1", name: "Hidden", folderId: "f1" })],
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();

    await openFolderMenu(user, "f1");
    await user.click(screen.getByRole("menuitem", { name: /new folder/i }));

    expect(useFolderExpandStore.getState().collapsedFolderIds).not.toContain(
      "f1",
    );
  });

  it("duplicates the folder as a sibling", async () => {
    const user = userEvent.setup();
    renderTree(
      [folder({ id: "f1", name: "Orig" })],
      [request({ id: "r1", folderId: "f1" })],
    );

    await openFolderMenu(user, "f1");
    await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

    const folders = useCollectionsStore.getState().folders;
    expect(folders).toHaveLength(2);
    expect(folders.filter((f) => f.parentFolderId === null)).toHaveLength(2);
  });

  it("deletes the folder only after the confirmation is accepted", async () => {
    const user = userEvent.setup();
    renderTree(
      [folder({ id: "f1", name: "Doomed" })],
      [request({ id: "r1", folderId: "f1" })],
    );

    await openFolderMenu(user, "f1");
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    expect(useCollectionsStore.getState().folders).toHaveLength(1);
    await user.click(
      await screen.findByRole("button", { name: /^yes, delete$/i }),
    );

    await waitFor(() => {
      expect(useCollectionsStore.getState().folders).toHaveLength(0);
    });
  });

  it("keeps the folder when the delete confirmation is cancelled", async () => {
    const user = userEvent.setup();
    renderTree(
      [folder({ id: "f1", name: "Safe" })],
      [request({ id: "r1", folderId: "f1" })],
    );

    await openFolderMenu(user, "f1");
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));
    await user.click(await screen.findByRole("button", { name: /cancel/i }));

    expect(useCollectionsStore.getState().folders).toHaveLength(1);
  });
});
