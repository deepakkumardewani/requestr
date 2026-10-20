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

vi.mock("@/components/relay/RelayToggleButton", () => ({
  RelayToggleButton: () => <button type="button" data-testid="relay-toggle" />,
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

type ResizeEntries = Array<Partial<ResizeObserverEntry>>;

let resizeCallback: ((entries: ResizeEntries) => void) | null = null;

beforeEach(() => {
  resizeCallback = null;
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = (entries) =>
        callback(entries as ResizeObserverEntry[], this as unknown as ResizeObserver);
    }
    observe() {
      // Trigger callback immediately to simulate resize
      if (resizeCallback) {
        resizeCallback([]);
      }
    }
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
  it("renders the Relay toggle with zero tabs, right of where the tab list sits", async () => {
    render(<TabBar />);
    expect(await screen.findByTestId("relay-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-list-dropdown")).not.toBeInTheDocument();
  });

  it("renders the Relay toggle immediately after the tab-list dropdown when tabs exist", async () => {
    seedTabs([{ name: "Alpha" }]);
    render(<TabBar />);
    const toggle = await screen.findByTestId("relay-toggle");
    expect(toggle.previousElementSibling).toBe(
      screen.getByTestId("tab-list-dropdown"),
    );
  });

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

  it("handles overflow detection with ResizeObserver", () => {
    seedTabs([{ name: "Tab" }]);
    const observeMock = vi.fn();
    globalThis.ResizeObserver = class {
      observe = observeMock;
      unobserve() {}
      disconnect() {}
    };

    render(<TabBar />);
    expect(observeMock).toHaveBeenCalled();
  });


  it("cancels the close-tab dialog and keeps the tab", () => {
    seedTabs([{ name: "Dirty", isDirty: true }]);
    const tabId = useTabsStore.getState().tabs[0].tabId;
    render(<TabBar />);
    fireEvent.click(screen.getByLabelText(/close dirty tab/i));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(useTabsStore.getState().tabs[0].tabId).toBe(tabId);
  });

  it("closes all tabs when all are clean", () => {
    seedTabs([{ name: "Clean" }]);
    const { tabs } = useTabsStore.getState();
    useUIStore.setState({ pendingBulkClose: { kind: "all" } });
    render(<TabBar />);

    fireEvent.click(screen.getByRole("button", { name: /^close all$/i }));

    expect(useTabsStore.getState().tabs).toHaveLength(0);
    expect(useUIStore.getState().pendingBulkClose).toBeNull();
  });

  it("handles tab reordering via drag and drop", async () => {
    seedTabs([{ name: "First" }, { name: "Second" }, { name: "Third" }]);
    const [first, second, third] = useTabsStore.getState().tabs;
    useTabsStore.setState({ activeTabId: first.tabId });
    render(<TabBar />);

    const tabs = screen.getAllByTestId("tab");
    const firstTabEl = tabs[0];
    const thirdTabEl = tabs[2];

    // Simulate drag start on first tab
    fireEvent.dragStart(firstTabEl.parentElement!, {
      dataTransfer: { effectAllowed: "move", setDragImage: vi.fn() },
    });

    // Simulate drag over third tab
    fireEvent.dragOver(thirdTabEl.parentElement!, {
      dataTransfer: { dropEffect: "move" },
    });

    // Simulate drop on third tab
    fireEvent.drop(thirdTabEl.parentElement!, {
      dataTransfer: { dropEffect: "move" },
    });

    // Check that tabs were reordered
    const updatedTabs = useTabsStore.getState().tabs;
    expect(updatedTabs[0].tabId).not.toBe(first.tabId);
  });

  it("shows new tab button when not overflowing", () => {
    seedTabs([{ name: "One" }]);
    render(<TabBar />);
    const newTabBtns = screen.getAllByTestId("new-tab-btn");
    expect(newTabBtns.length).toBeGreaterThan(0);
  });

  it("moves the new tab button from the scroll area to the fixed actions when overflowing and can click it", async () => {
    const user = userEvent.setup();
    seedTabs([{ name: "One" }, { name: "Two" }, { name: "Three" }]);
    const { container } = render(<TabBar />);

    const scrollEl = container.querySelector(
      ".flex.items-center.overflow-x-auto",
    ) as HTMLElement;

    // Not overflowing yet: the single "+" lives inside the scroll area
    expect(scrollEl).toContainElement(screen.getByTestId("new-tab-btn"));

    // Stub scrollWidth > clientWidth to trigger overflow

    Object.defineProperty(scrollEl, "scrollWidth", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(scrollEl, "clientWidth", {
      configurable: true,
      value: 500,
    });

    // Manually trigger ResizeObserver callback to check overflow
    if (resizeCallback) {
      resizeCallback([{ target: scrollEl }]);
    }

    // Overflow moves the only "+" out of the scroll area into the fixed
    // actions block that also holds the Relay toggle.
    await waitFor(() => {
      expect(scrollEl).not.toContainElement(screen.getByTestId("new-tab-btn"));
    });
    const newTabBtn = screen.getByTestId("new-tab-btn");
    expect(screen.getAllByTestId("new-tab-btn")).toHaveLength(1);
    expect(newTabBtn).toHaveAttribute("aria-label");
    // The toggle is a lazily loaded chunk, so wait for it to mount
    expect(newTabBtn.closest("div.shrink-0")).toContainElement(
      await screen.findByTestId("relay-toggle"),
    );

    // Click the button to open a new tab
    await user.click(newTabBtn);
    expect(useTabsStore.getState().tabs.length).toBe(4);
  });

  it("renders group separator between tabs with different groups", () => {
    seedTabs([{ name: "Group A" }, { name: "Group B" }]);
    const [tabA, tabB] = useTabsStore.getState().tabs;
    tabA.group = "requests";
    tabB.group = "flows";
    useTabsStore.setState({ tabs: [tabA, tabB] });

    const { container } = render(<TabBar />);
    const separator = container.querySelector(".h-5.w-px.shrink-0.bg-border");
    expect(separator).toBeInTheDocument();
  });

  it("does not render group separator between first tab and second tab with same group", () => {
    seedTabs([{ name: "First" }, { name: "Second" }]);
    const [tabA, tabB] = useTabsStore.getState().tabs;
    tabA.group = "requests";
    tabB.group = "requests";
    useTabsStore.setState({ tabs: [tabA, tabB] });

    const { container } = render(<TabBar />);
    const separator = container.querySelector(".h-5.w-px.shrink-0.bg-border");
    expect(separator).not.toBeInTheDocument();
  });

  it("prevents default on drag over and shows drop target indicator", async () => {
    seedTabs([{ name: "First" }, { name: "Second" }]);
    const { container } = render(<TabBar />);

    const tabs = screen.getAllByTestId("tab");
    const firstTabEl = tabs[0];

    const dragOverEvent = new DragEvent("dragover", {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(dragOverEvent, "preventDefault");

    fireEvent(firstTabEl.parentElement!, dragOverEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("clears drag state on drag leave", async () => {
    seedTabs([{ name: "First" }, { name: "Second" }]);
    const { container } = render(<TabBar />);

    const tabs = screen.getAllByTestId("tab");
    const firstTabEl = tabs[0];

    // Drag over to set dragOverIndex
    fireEvent.dragOver(firstTabEl.parentElement!, {
      dataTransfer: { dropEffect: "move" },
    });

    // Then drag leave
    fireEvent.dragLeave(firstTabEl.parentElement!);

    // dragOverIndex should be cleared (component re-renders)
    const indicator = container.querySelector(".w-0.5.bg-theme-accent");
    expect(indicator).not.toBeInTheDocument();
  });

  it("clears drag state on drag end", async () => {
    seedTabs([{ name: "First" }, { name: "Second" }]);
    render(<TabBar />);

    const tabs = screen.getAllByTestId("tab");
    const firstTabEl = tabs[0];

    fireEvent.dragStart(firstTabEl.parentElement!, {
      dataTransfer: { effectAllowed: "move", setDragImage: vi.fn() },
    });

    fireEvent.dragEnd(firstTabEl.parentElement!);

    // Should not have drag-related visual state
    const tabs2 = screen.getAllByTestId("tab");
    expect(tabs2.length).toBe(2);
  });

  it("does not reorder when dragging to same index", async () => {
    seedTabs([{ name: "First" }, { name: "Second" }]);
    const [first] = useTabsStore.getState().tabs;
    const reorderSpy = vi.spyOn(useTabsStore.getState(), "reorderTabs");

    render(<TabBar />);

    const tabs = screen.getAllByTestId("tab");
    const firstTabEl = tabs[0];

    fireEvent.dragStart(firstTabEl.parentElement!, {
      dataTransfer: { effectAllowed: "move", setDragImage: vi.fn() },
    });

    fireEvent.dragOver(firstTabEl.parentElement!, {
      dataTransfer: { dropEffect: "move" },
    });

    fireEvent.drop(firstTabEl.parentElement!, {
      dataTransfer: { dropEffect: "move" },
    });

    expect(reorderSpy).not.toHaveBeenCalled();
  });

  it("calculates dirty count for close-other-tabs (keep one)", () => {
    seedTabs([
      { name: "Keep", isDirty: false },
      { name: "Close A", isDirty: true },
    ]);
    const [keep, closeA] = useTabsStore.getState().tabs;
    useUIStore.setState({
      pendingBulkClose: { kind: "others", keepTabId: keep.tabId },
    });

    render(<TabBar />);

    expect(screen.getByTestId("bulk-close-dialog")).toBeInTheDocument();
  });

  it("calculates dirty count for close-other-tabs (multiple)", () => {
    seedTabs([
      { name: "Keep", isDirty: false },
      { name: "Close A", isDirty: true },
      { name: "Close B", isDirty: true },
    ]);
    const [keep] = useTabsStore.getState().tabs;
    useUIStore.setState({
      pendingBulkClose: { kind: "others", keepTabId: keep.tabId },
    });

    render(<TabBar />);

    expect(screen.getByTestId("bulk-close-dialog")).toBeInTheDocument();
  });

  it("closes other tabs when confirmed", () => {
    seedTabs([
      { name: "Keep", isDirty: false },
      { name: "Close A", isDirty: false },
    ]);
    const [keep, closeA] = useTabsStore.getState().tabs;
    useUIStore.setState({
      pendingBulkClose: { kind: "others", keepTabId: keep.tabId },
    });

    render(<TabBar />);

    fireEvent.click(screen.getByRole("button", { name: /^close all$/i }));

    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].tabId).toBe(keep.tabId);
  });

  it("dismisses close-other-tabs dialog when clicking outside or cancel", async () => {
    seedTabs([{ name: "Tab" }]);
    useUIStore.setState({
      pendingBulkClose: { kind: "all" },
    });

    render(<TabBar />);

    expect(screen.getByTestId("bulk-close-dialog")).toBeInTheDocument();

    // Simulate onOpenChange with open=false (exercises line 284)
    useUIStore.setState({ pendingBulkClose: null });

    await waitFor(() => {
      expect(screen.queryByTestId("bulk-close-dialog")).not.toBeInTheDocument();
    });
  });

  it("dismisses single-tab close dialog when clicking outside or cancel", async () => {
    seedTabs([{ name: "Dirty", isDirty: true }]);
    const tabId = useTabsStore.getState().tabs[0].tabId;
    useUIStore.setState({ pendingCloseTabId: tabId });

    render(<TabBar />);

    expect(screen.getByTestId("close-tab-dialog")).toBeInTheDocument();

    // Simulate onOpenChange with open=false
    useUIStore.setState({ pendingCloseTabId: null });

    await waitFor(() => {
      expect(screen.queryByTestId("close-tab-dialog")).not.toBeInTheDocument();
    });
  });

  it("scrolls to new tab when added", async () => {
    seedTabs([{ name: "First" }]);
    const { container, rerender } = render(<TabBar />);

    const scrollEl = container.querySelector(
      ".flex.items-center.overflow-x-auto",
    ) as HTMLElement;
    const scrollToSpy = vi.spyOn(scrollEl, "scrollTo");

    // Add a new tab
    useTabsStore.getState().openTab({
      type: "http",
      name: "Second",
      isDirty: false,
    } as Partial<HttpTab>);

    // Re-render to trigger effect
    rerender(<TabBar />);

    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        left: expect.any(Number),
        behavior: "smooth",
      }),
    );
  });

  it("handles empty tabs list with no group separators", () => {
    render(<TabBar />);
    const separators = document.querySelectorAll(".h-5.w-px.shrink-0.bg-border");
    expect(separators).toHaveLength(0);
  });



  it("handles ResizeObserver with proper cleanup", () => {
    seedTabs([{ name: "Tab" }]);
    const disconnectSpy = vi.fn();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect = disconnectSpy;
    };

    const { unmount } = render(<TabBar />);
    unmount();

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it("closes bulk-close dialog via onOpenChange when Cancel is clicked", async () => {
    const user = userEvent.setup();
    seedTabs([{ name: "Tab" }]);
    useUIStore.setState({
      pendingBulkClose: { kind: "all" },
    });

    render(<TabBar />);

    expect(screen.getByTestId("bulk-close-dialog")).toBeInTheDocument();

    // Click the Cancel button to trigger onOpenChange(false)
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    // Verify pendingBulkClose is cleared and dialog is gone
    await waitFor(() => {
      expect(useUIStore.getState().pendingBulkClose).toBeNull();
      expect(screen.queryByTestId("bulk-close-dialog")).not.toBeInTheDocument();
    });
  });
});
