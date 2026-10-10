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
import type { HttpTab } from "@/types";
import { SaveRequestModal } from "./SaveRequestModal";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function resetStores() {
  useCollectionsStore.setState({ collections: [], requests: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
}

function seedTab(): HttpTab {
  useTabsStore.getState().openTab({
    type: "http",
    name: "Untitled",
    method: "GET",
    url: "https://save.test/api",
    isDirty: true,
  });
  return useTabsStore.getState().tabs[0] as HttpTab;
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("SaveRequestModal", () => {
  it("shows collection picker and request name when collections exist", () => {
    useCollectionsStore.setState({
      collections: [
        { id: "c1", name: "Alpha", createdAt: 1, updatedAt: 1 },
        { id: "c2", name: "Beta", createdAt: 1, updatedAt: 1 },
      ],
      requests: [],
    });
    const tab = seedTab();

    render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

    expect(screen.getByTestId("save-request-modal")).toBeInTheDocument();
    expect(screen.getByTestId("collection-picker")).toBeInTheDocument();
    expect(screen.getByTestId("collection-picker-item-c1")).toBeInTheDocument();
    expect(screen.getByTestId("save-request-name-input")).toHaveValue(
      "Untitled",
    );
  });

  it("saves request into selected collection and updates tab", async () => {
    const user = userEvent.setup();
    useCollectionsStore.setState({
      collections: [{ id: "c-save", name: "Main", createdAt: 1, updatedAt: 1 }],
      requests: [],
    });
    const tab = seedTab();

    const onOpenChange = vi.fn();
    render(<SaveRequestModal open onOpenChange={onOpenChange} tab={tab} />);

    await user.click(screen.getByTestId("collection-picker-item-c-save"));
    fireEvent.change(screen.getByTestId("save-request-name-input"), {
      target: { value: "Saved Name" },
    });
    fireEvent.click(screen.getByTestId("save-modal-save-btn"));

    await waitFor(() => {
      const reqs = useCollectionsStore.getState().requests;
      expect(reqs).toHaveLength(1);
      expect(reqs[0].name).toBe("Saved Name");
      expect(reqs[0].collectionId).toBe("c-save");
    });

    const updated = useTabsStore.getState().tabs[0] as HttpTab;
    expect(updated.requestId).not.toBeNull();
    expect(updated.isDirty).toBe(false);
    expect(updated.name).toBe("Saved Name");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("creates new collection when saving from empty collection flow", async () => {
    const user = userEvent.setup();
    useCollectionsStore.setState({ collections: [], requests: [] });
    const tab = seedTab();

    render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

    const nameInput = screen.getByTestId("save-new-collection-name-input");
    await user.type(nameInput, "Fresh Coll");

    fireEvent.click(screen.getByTestId("save-modal-save-btn"));

    await waitFor(() => {
      expect(useCollectionsStore.getState().collections).toHaveLength(1);
      expect(useCollectionsStore.getState().collections[0].name).toBe(
        "Fresh Coll",
      );
      expect(useCollectionsStore.getState().requests).toHaveLength(1);
    });
  });

  it("switches to new-collection UI via link when collections exist", async () => {
    const user = userEvent.setup();
    useCollectionsStore.setState({
      collections: [{ id: "cx", name: "HasOne", createdAt: 1, updatedAt: 1 }],
      requests: [],
    });
    const tab = seedTab();

    render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

    await user.click(screen.getByTestId("create-new-collection-link"));

    expect(
      screen.getByTestId("save-new-collection-name-input"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("save-modal-save-btn")).toBeDisabled();

    await user.type(
      screen.getByTestId("save-new-collection-name-input"),
      "NewCol",
    );

    expect(screen.getByTestId("save-modal-save-btn")).not.toBeDisabled();
  });

  it("cancel closes via callback without saving", async () => {
    const user = userEvent.setup();
    useCollectionsStore.setState({
      collections: [{ id: "c1", name: "Main", createdAt: 1, updatedAt: 1 }],
      requests: [],
    });
    const tab = seedTab();
    const onOpenChange = vi.fn();

    render(<SaveRequestModal open onOpenChange={onOpenChange} tab={tab} />);

    await user.click(screen.getByTestId("save-modal-cancel-btn"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(useCollectionsStore.getState().requests).toHaveLength(0);
  });

  describe("collection choice", () => {
    const twoCollections = [
      { id: "c1", name: "Alpha", createdAt: 1, updatedAt: 1 },
      { id: "c2", name: "Beta", createdAt: 1, updatedAt: 1 },
    ];

    it("saves into the first collection by default when none is clicked", async () => {
      useCollectionsStore.setState({ collections: twoCollections, requests: [] });
      const tab = seedTab();
      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

      fireEvent.click(screen.getByTestId("save-modal-save-btn"));

      await waitFor(() => {
        expect(useCollectionsStore.getState().requests[0].collectionId).toBe("c1");
      });
    });

    it("saves into the collection the user picked instead of the default", async () => {
      const user = userEvent.setup();
      useCollectionsStore.setState({ collections: twoCollections, requests: [] });
      const tab = seedTab();
      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

      await user.click(screen.getByTestId("collection-picker-item-c2"));
      fireEvent.click(screen.getByTestId("save-modal-save-btn"));

      await waitFor(() => {
        const reqs = useCollectionsStore.getState().requests;
        expect(reqs).toHaveLength(1);
        expect(reqs[0].collectionId).toBe("c2");
      });
    });

    it("highlights only the currently selected collection item", async () => {
      const user = userEvent.setup();
      useCollectionsStore.setState({ collections: twoCollections, requests: [] });
      const tab = seedTab();
      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);
      const first = screen.getByTestId("collection-picker-item-c1");
      const second = screen.getByTestId("collection-picker-item-c2");
      const firstClassBefore = first.className;

      await user.click(second);

      expect(first.className).not.toBe(firstClassBefore);
      expect(second.className).toBe(firstClassBefore);
    });

    it("returns to the picker via the select-existing link and saves into the picked collection", async () => {
      const user = userEvent.setup();
      useCollectionsStore.setState({ collections: twoCollections, requests: [] });
      const tab = seedTab();
      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

      await user.click(screen.getByTestId("create-new-collection-link"));
      await user.type(screen.getByTestId("save-new-collection-name-input"), "Typed");
      await user.click(screen.getByTestId("select-existing-collection-link"));
      await user.click(screen.getByTestId("collection-picker-item-c2"));
      fireEvent.click(screen.getByTestId("save-modal-save-btn"));

      await waitFor(() => {
        expect(useCollectionsStore.getState().requests[0].collectionId).toBe("c2");
      });
      expect(useCollectionsStore.getState().collections).toHaveLength(2);
    });

    it("does not offer the select-existing link when no collections exist", () => {
      const tab = seedTab();

      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

      expect(
        screen.queryByTestId("select-existing-collection-link")
      ).not.toBeInTheDocument();
    });
  });

  describe("request name validation", () => {
    function seedOneCollection() {
      useCollectionsStore.setState({
        collections: [{ id: "c1", name: "Main", createdAt: 1, updatedAt: 1 }],
        requests: [],
      });
    }

    it("falls back to the tab name when the name field is emptied", async () => {
      const user = userEvent.setup();
      seedOneCollection();
      const tab = seedTab();
      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

      await user.clear(screen.getByTestId("save-request-name-input"));
      fireEvent.click(screen.getByTestId("save-modal-save-btn"));

      await waitFor(() => {
        expect(useCollectionsStore.getState().requests[0].name).toBe("Untitled");
      });
      expect((useTabsStore.getState().tabs[0] as HttpTab).name).toBe("Untitled");
    });

    it("falls back to the tab name when the name is only whitespace", async () => {
      const user = userEvent.setup();
      seedOneCollection();
      const tab = seedTab();
      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

      await user.clear(screen.getByTestId("save-request-name-input"));
      await user.type(screen.getByTestId("save-request-name-input"), "   ");
      fireEvent.click(screen.getByTestId("save-modal-save-btn"));

      await waitFor(() => {
        expect(useCollectionsStore.getState().requests[0].name).toBe("Untitled");
      });
    });

    it("trims surrounding whitespace from the saved name", async () => {
      const user = userEvent.setup();
      seedOneCollection();
      const tab = seedTab();
      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

      await user.clear(screen.getByTestId("save-request-name-input"));
      await user.type(screen.getByTestId("save-request-name-input"), "  Padded  ");
      fireEvent.click(screen.getByTestId("save-modal-save-btn"));

      await waitFor(() => {
        expect(useCollectionsStore.getState().requests[0].name).toBe("Padded");
      });
    });

    it("keeps Save disabled for a blank new-collection name", async () => {
      const user = userEvent.setup();
      const tab = seedTab();
      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

      await user.type(screen.getByTestId("save-new-collection-name-input"), "   ");

      expect(screen.getByTestId("save-modal-save-btn")).toBeDisabled();
      expect(useCollectionsStore.getState().requests).toHaveLength(0);
    });
  });

  describe("duplicate names", () => {
    it("allows saving a second request with the same name into the same collection", async () => {
      useCollectionsStore.setState({
        collections: [{ id: "c1", name: "Main", createdAt: 1, updatedAt: 1 }],
        requests: [],
      });
      const tab = seedTab();
      const { unmount } = render(
        <SaveRequestModal open onOpenChange={() => {}} tab={tab} />
      );
      fireEvent.click(screen.getByTestId("save-modal-save-btn"));
      await waitFor(() => {
        expect(useCollectionsStore.getState().requests).toHaveLength(1);
      });
      unmount();

      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);
      fireEvent.click(screen.getByTestId("save-modal-save-btn"));

      await waitFor(() => {
        expect(useCollectionsStore.getState().requests).toHaveLength(2);
      });
      const [first, second] = useCollectionsStore.getState().requests;
      expect(first.name).toBe(second.name);
      expect(first.id).not.toBe(second.id);
    });

    it("allows creating a new collection whose name matches an existing one", async () => {
      const user = userEvent.setup();
      useCollectionsStore.setState({
        collections: [{ id: "c1", name: "Main", createdAt: 1, updatedAt: 1 }],
        requests: [],
      });
      const tab = seedTab();
      render(<SaveRequestModal open onOpenChange={() => {}} tab={tab} />);

      await user.click(screen.getByTestId("create-new-collection-link"));
      await user.type(screen.getByTestId("save-new-collection-name-input"), "Main");
      fireEvent.click(screen.getByTestId("save-modal-save-btn"));

      await waitFor(() => {
        const { collections, requests } = useCollectionsStore.getState();
        expect(collections.filter((c) => c.name === "Main")).toHaveLength(2);
        expect(requests[0].collectionId).not.toBe("c1");
      });
    });
  });
});
