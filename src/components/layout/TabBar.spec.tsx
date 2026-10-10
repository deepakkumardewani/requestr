/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HttpTab } from "@/types";
import { TabBar } from "./TabBar";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/layout/TabListDropdown", () => ({
  TabListDropdown: () => <div data-testid="tab-list-dropdown" />,
}));

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useUIStore.setState({
    pendingCloseTabId: null,
    pendingBulkClose: null,
    saveModalOpen: false,
    commandPaletteOpen: false,
    keyboardShortcutsOpen: false,
  });
}

function seedTabs(items: Array<{ name: string; isDirty?: boolean }>) {
  items.forEach(({ name, isDirty }) => {
    useTabsStore.getState().openTab({
      type: "http",
      name,
      isDirty: isDirty ?? false,
    } as Partial<HttpTab>);
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

describe("TabBar", () => {
  it("renders tabs from the store with readable names", () => {
    seedTabs([{ name: "Alpha" }, { name: "Beta" }]);
    render(<TabBar />);
    const tabs = screen.getAllByTestId("tab");
    expect(tabs).toHaveLength(2);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("selecting a tab updates the active tab in the store", async () => {
    const user = userEvent.setup();
    seedTabs([{ name: "First" }, { name: "Second" }]);
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.setState({ activeTabId: a.tabId });
    render(<TabBar />);

    await user.click(screen.getByText("Second"));
    expect(useTabsStore.getState().activeTabId).toBe(b.tabId);
  });

  it("active tab shows accent underline region (active styling)", () => {
    seedTabs([{ name: "Only" }]);
    render(<TabBar />);
    const tabEl = screen.getByTestId("tab");
    const accent = tabEl.querySelector(".bg-method-accent");
    expect(accent).toBeTruthy();
  });

  it("closes a clean tab immediately without confirmation", () => {
    seedTabs([{ name: "Close me" }]);
    const tabId = useTabsStore.getState().tabs[0].tabId;
    render(<TabBar />);
    fireEvent.click(screen.getByLabelText(/close close me tab/i));
    expect(useTabsStore.getState().tabs).toHaveLength(0);
    expect(useTabsStore.getState().activeTabId).toBeNull();
    expect(useUIStore.getState().pendingCloseTabId).toBeNull();
    expect(tabId).toBeDefined();
  });

  it("opening close guard for dirty tab shows unsaved dialog", () => {
    seedTabs([{ name: "Dirty", isDirty: true }]);
    render(<TabBar />);
    fireEvent.click(screen.getByLabelText(/close dirty tab/i));
    expect(useUIStore.getState().pendingCloseTabId).toBe(
      useTabsStore.getState().tabs[0].tabId,
    );
    expect(screen.getByTestId("close-tab-dialog")).toBeVisible();
  });

  it("confirm close in dialog removes dirty tab", async () => {
    seedTabs([{ name: "Dirty", isDirty: true }]);
    const tabId = useTabsStore.getState().tabs[0].tabId;
    render(<TabBar />);
    fireEvent.click(screen.getByLabelText(/close dirty tab/i));
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => {
      expect(useTabsStore.getState().tabs).toHaveLength(0);
    });
    expect(useTabsStore.getState().activeTabId).toBeNull();
    expect(useUIStore.getState().pendingCloseTabId).toBeNull();
    expect(tabId).toBeDefined();
  });

  it("new tab button opens an additional tab when not overflowing", async () => {
    const user = userEvent.setup();
    seedTabs([{ name: "One" }]);
    render(<TabBar />);
    const newBtns = screen.getAllByTestId("new-tab-btn");
    await user.click(newBtns[0]!);
    expect(useTabsStore.getState().tabs.length).toBe(2);
  });

  it("renders tab bar root for layout tests", () => {
    seedTabs([{ name: "Single" }]);
    render(<TabBar />);
    expect(screen.getByTestId("tab-bar")).toBeInTheDocument();
  });
});

function dirtyTabIds() {
  return useTabsStore
    .getState()
    .tabs.filter((t) => t.isDirty)
    .map((t) => t.tabId);
}

describe("TabBar bulk-close dialog", () => {
  it("Close All confirmation closes every tab when kind is all", async () => {
    seedTabs([{ name: "A", isDirty: true }, { name: "B" }]);
    useUIStore.setState({ pendingBulkClose: { kind: "all" } });
    render(<TabBar />);

    fireEvent.click(screen.getByRole("button", { name: "Close All" }));

    await waitFor(() => expect(useTabsStore.getState().tabs).toHaveLength(0));
    expect(useUIStore.getState().pendingBulkClose).toBeNull();
  });

  it("confirmation for others keeps only the kept tab", async () => {
    seedTabs([{ name: "Keep" }, { name: "B", isDirty: true }, { name: "C" }]);
    const keepTabId = useTabsStore.getState().tabs[0].tabId;
    useUIStore.setState({ pendingBulkClose: { kind: "others", keepTabId } });
    render(<TabBar />);

    fireEvent.click(screen.getByRole("button", { name: "Close All" }));

    await waitFor(() => expect(useTabsStore.getState().tabs).toHaveLength(1));
    expect(useTabsStore.getState().tabs[0].tabId).toBe(keepTabId);
    expect(useUIStore.getState().pendingBulkClose).toBeNull();
  });

  it("uses the singular message when exactly one tab is unsaved", () => {
    seedTabs([{ name: "A", isDirty: true }, { name: "B" }]);
    useUIStore.setState({ pendingBulkClose: { kind: "all" } });
    render(<TabBar />);

    expect(
      within(screen.getByTestId("bulk-close-dialog")).getByText(
        "1 tab has unsaved changes. Close anyway?",
      ),
    ).toBeInTheDocument();
  });

  it("uses the plural message with the count when several tabs are unsaved", () => {
    seedTabs([
      { name: "A", isDirty: true },
      { name: "B", isDirty: true },
      { name: "C", isDirty: true },
    ]);
    useUIStore.setState({ pendingBulkClose: { kind: "all" } });
    render(<TabBar />);

    expect(
      within(screen.getByTestId("bulk-close-dialog")).getByText(
        "3 tabs have unsaved changes. Close anyway?",
      ),
    ).toBeInTheDocument();
  });

  it("for others, the count excludes the kept dirty tab", () => {
    seedTabs([
      { name: "Keep", isDirty: true },
      { name: "B", isDirty: true },
      { name: "C" },
    ]);
    const keepTabId = useTabsStore.getState().tabs[0].tabId;
    useUIStore.setState({ pendingBulkClose: { kind: "others", keepTabId } });
    render(<TabBar />);

    expect(
      within(screen.getByTestId("bulk-close-dialog")).getByText(
        "1 tab has unsaved changes. Close anyway?",
      ),
    ).toBeInTheDocument();
  });

  it("Cancel keeps all tabs and clears the pending bulk close", async () => {
    seedTabs([{ name: "A", isDirty: true }, { name: "B" }]);
    useUIStore.setState({ pendingBulkClose: { kind: "all" } });
    render(<TabBar />);

    fireEvent.click(
      within(screen.getByTestId("bulk-close-dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    await waitFor(() =>
      expect(useUIStore.getState().pendingBulkClose).toBeNull(),
    );
    expect(useTabsStore.getState().tabs).toHaveLength(2);
    expect(dirtyTabIds()).toHaveLength(1);
  });
});

describe("TabBar single-close dialog", () => {
  it("Cancel keeps the dirty tab and clears pendingCloseTabId", async () => {
    seedTabs([{ name: "Dirty", isDirty: true }]);
    const tabId = useTabsStore.getState().tabs[0].tabId;
    useUIStore.setState({ pendingCloseTabId: tabId });
    render(<TabBar />);

    fireEvent.click(
      within(screen.getByTestId("close-tab-dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    await waitFor(() =>
      expect(useUIStore.getState().pendingCloseTabId).toBeNull(),
    );
    expect(useTabsStore.getState().tabs.map((t) => t.tabId)).toEqual([tabId]);
  });
});

describe("TabBar drag and drop", () => {
  const dataTransfer = () => ({
    effectAllowed: "",
    dropEffect: "",
    setDragImage: vi.fn(),
  });
  const names = () => useTabsStore.getState().tabs.map((t) => t.name);
  let originalReorder: ReturnType<typeof useTabsStore.getState>["reorderTabs"];
  let reorderSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalReorder = useTabsStore.getState().reorderTabs;
    reorderSpy = vi.fn(originalReorder);
    useTabsStore.setState({
      reorderTabs: reorderSpy as typeof originalReorder,
    });
    seedTabs([{ name: "A" }, { name: "B" }, { name: "C" }]);
  });

  afterEach(() => {
    useTabsStore.setState({ reorderTabs: originalReorder });
  });

  it("dropping a dragged tab on another reorders from source to target index", () => {
    render(<TabBar />);
    const [a, , c] = screen.getAllByTestId("tab");

    fireEvent.dragStart(a, { dataTransfer: dataTransfer() });
    fireEvent.drop(c, { dataTransfer: dataTransfer() });

    expect(reorderSpy).toHaveBeenCalledWith(0, 2);
    expect(names()).toEqual(["B", "C", "A"]);
  });

  it("dropping a tab on itself does not reorder", () => {
    render(<TabBar />);
    const [, b] = screen.getAllByTestId("tab");

    fireEvent.dragStart(b, { dataTransfer: dataTransfer() });
    fireEvent.drop(b, { dataTransfer: dataTransfer() });

    expect(reorderSpy).not.toHaveBeenCalled();
    expect(names()).toEqual(["A", "B", "C"]);
  });

  it("dragend discards the drag so a later drop does not reorder", () => {
    render(<TabBar />);
    const [a, b] = screen.getAllByTestId("tab");

    fireEvent.dragStart(a, { dataTransfer: dataTransfer() });
    fireEvent.dragEnd(a, { dataTransfer: dataTransfer() });
    fireEvent.drop(b, { dataTransfer: dataTransfer() });

    expect(reorderSpy).not.toHaveBeenCalled();
    expect(names()).toEqual(["A", "B", "C"]);
  });
});

describe("TabBar overflow", () => {
  const originalScrollTo = Element.prototype.scrollTo;
  let scrollWidth = 0;
  let clientWidth = 0;

  beforeEach(() => {
    scrollWidth = 100;
    clientWidth = 100;
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
      () => scrollWidth,
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => clientWidth,
    );
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollTo = originalScrollTo;
  });

  function isInsideTabList(el: HTMLElement) {
    const tabListContainer = screen
      .getAllByTestId("tab")[0]
      .closest("[draggable=true]")?.parentElement;
    return !!tabListContainer?.contains(el);
  }

  it("keeps the new-tab button inline with the tabs when they fit", () => {
    seedTabs([{ name: "One" }]);
    render(<TabBar />);

    const btns = screen.getAllByTestId("new-tab-btn");
    expect(btns).toHaveLength(1);
    expect(isInsideTabList(btns[0])).toBe(true);
  });

  it("moves the new-tab button to the right actions when tabs overflow", async () => {
    scrollWidth = 500;
    seedTabs([{ name: "One" }]);
    render(<TabBar />);

    await waitFor(() => {
      const btns = screen.getAllByTestId("new-tab-btn");
      expect(btns).toHaveLength(1);
      expect(isInsideTabList(btns[0])).toBe(false);
    });
  });

  it("scrolls to the end when a tab is added", async () => {
    scrollWidth = 500;
    seedTabs([{ name: "One" }]);
    render(<TabBar />);
    const scrollTo = vi.mocked(Element.prototype.scrollTo);
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => {
      useTabsStore.getState().openTab({ type: "http", name: "Two" });
    });

    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({ left: 500, behavior: "smooth" }),
    );
  });

  it("does not scroll when a tab is removed", () => {
    seedTabs([{ name: "One" }, { name: "Two" }]);
    render(<TabBar />);
    const scrollTo = vi.mocked(Element.prototype.scrollTo);

    act(() => {
      useTabsStore.getState().closeTab(useTabsStore.getState().tabs[1].tabId);
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
