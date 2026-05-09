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
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { CollectionModel, RequestModel } from "@/types";
import { CollectionTree } from "./CollectionTree";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function resetStores() {
  useCollectionsStore.setState({ collections: [], requests: [] });
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
  push.mockClear();
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("CollectionTree", () => {
  it("shows empty state when there are no collections", () => {
    render(<CollectionTree />);
    expect(screen.getByText("No collections yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new collection/i }),
    ).toBeInTheDocument();
  });

  it("reveals new collection input when New Collection is clicked", async () => {
    const user = userEvent.setup();
    render(<CollectionTree />);

    await user.click(screen.getByRole("button", { name: /new collection/i }));

    expect(screen.getByTestId("new-collection-name-input")).toBeInTheDocument();
  });

  it("creates a collection when Enter is pressed with a non-empty name", async () => {
    const user = userEvent.setup();
    useUIStore.setState({ isCreatingCollection: true });
    render(<CollectionTree />);

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

    render(<CollectionTree />);

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

    render(<CollectionTree />);

    await user.click(screen.getByTestId("collection-name-col-a"));

    expect(await screen.findByText("No requests yet")).toBeInTheDocument();
  });

  it("opens chain view via GitBranch button", async () => {
    const user = userEvent.setup();
    const col: CollectionModel = {
      id: "col-chain",
      name: "Chain",
      createdAt: 1,
      updatedAt: 1,
    };
    useCollectionsStore.setState({ collections: [col], requests: [] });

    render(<CollectionTree />);

    const moreBtn = screen.getByTestId("collection-more-btn-col-chain");
    await user.click(moreBtn);

    const chainViewItem = screen.getByRole("menuitem", { name: /chain view/i });
    await user.click(chainViewItem);

    expect(push).toHaveBeenCalledWith("/chain/col-chain");
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

    render(<CollectionTree />);

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

    render(<CollectionTree />);

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
});
