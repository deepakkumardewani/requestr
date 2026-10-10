/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HttpTab } from "@/types";
import { TabListDropdown } from "./TabListDropdown";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn(() => null) }));

const guard = vi.hoisted(() => ({
  closeAll: vi.fn(),
  closeTab: vi.fn(),
  useReal: false,
}));
const closeAllMock = guard.closeAll;

// Real guard is opt-in so the dirty -> pendingBulkClose path can be asserted end to end.
vi.mock("@/hooks/useCloseTabGuard", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/useCloseTabGuard")
  >("@/hooks/useCloseTabGuard");
  return {
    useCloseTabGuard: () =>
      guard.useReal
        ? actual.useCloseTabGuard()
        : { handleCloseTab: guard.closeTab, handleCloseAll: guard.closeAll },
  };
});

function httpTab(tabId: string, name: string, isDirty = false): HttpTab {
  return {
    tabId,
    requestId: null,
    name,
    isDirty,
    type: "http",
    url: "https://example.com",
    method: "GET",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
  };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("tabs-overflow-btn"));
  return screen.findByTestId("tabs-search-input");
}

beforeEach(() => {
  guard.closeAll.mockReset();
  guard.closeTab.mockReset();
  guard.useReal = false;
  useUIStore.setState({ pendingCloseTabId: null, pendingBulkClose: null });
  useTabsStore.setState({
    tabs: [httpTab("t1", "Alpha"), httpTab("t2", "Beta")],
    activeTabId: "t1",
  });
});

afterEach(cleanup);

describe("TabListDropdown search reset", () => {
  it("clears the search after selecting a tab", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);

    const input = await openMenu(user);
    await user.type(input, "bet");
    expect(screen.getAllByTestId("tab-list-item")).toHaveLength(1);

    await user.click(screen.getByTestId("tab-list-item"));
    expect(useTabsStore.getState().activeTabId).toBe("t2");

    expect(await openMenu(user)).toHaveValue("");
    expect(screen.getAllByTestId("tab-list-item")).toHaveLength(2);
  });

  it("clears the search after Close all", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);

    const input = await openMenu(user);
    await user.type(input, "alp");
    await user.click(screen.getByRole("button", { name: /close all/i }));
    expect(closeAllMock).toHaveBeenCalledTimes(1);

    expect(await openMenu(user)).toHaveValue("");
  });
});

describe("TabListDropdown list behavior", () => {
  it("shows the opened tab count in the header", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);
    await openMenu(user);
    expect(screen.getByText("Opened tabs · 2")).toBeInTheDocument();
  });

  it("filters tabs case-insensitively", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);
    await user.type(await openMenu(user), "BETA");
    const rows = screen.getAllByTestId("tab-list-item");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Beta");
  });

  it("shows every tab when the search is only whitespace", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);
    await user.type(await openMenu(user), "   ");
    expect(screen.getAllByTestId("tab-list-item")).toHaveLength(2);
  });

  it("matches unnamed tabs by the New Request fallback name", async () => {
    const user = userEvent.setup();
    useTabsStore.setState({ tabs: [httpTab("t1", "Alpha"), httpTab("t3", "")] });
    render(<TabListDropdown />);
    await user.type(await openMenu(user), "new req");
    const rows = screen.getAllByTestId("tab-list-item");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("New Request");
  });

  it("shows the empty message when no tab matches", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);
    await user.type(await openMenu(user), "zzz");
    expect(screen.getByText("No tabs found")).toBeInTheDocument();
    expect(screen.queryAllByTestId("tab-list-item")).toHaveLength(0);
  });

  it("activates the clicked tab and closes the menu", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);
    await openMenu(user);
    await user.click(screen.getByText("Beta"));
    expect(useTabsStore.getState().activeTabId).toBe("t2");
    await waitFor(() =>
      expect(screen.queryByTestId("tabs-search-input")).not.toBeInTheDocument(),
    );
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("activates the focused tab with the %s key", async (_label, key) => {
    const user = userEvent.setup();
    render(<TabListDropdown />);
    await openMenu(user);
    screen.getAllByTestId("tab-list-item")[1].focus();
    await user.keyboard(key);
    expect(useTabsStore.getState().activeTabId).toBe("t2");
  });

  it("highlights only the active tab row", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);
    await openMenu(user);
    const [active, inactive] = screen.getAllByTestId("tab-list-item");
    // Source exposes no testid/aria state for the highlight, so the class is the only signal.
    expect(active).toHaveClass("bg-muted/60");
    expect(inactive).not.toHaveClass("bg-muted/60");
  });

  it("shows the dirty dot only on unsaved tabs", async () => {
    const user = userEvent.setup();
    useTabsStore.setState({
      tabs: [httpTab("t1", "Alpha", true), httpTab("t2", "Beta")],
    });
    render(<TabListDropdown />);
    await openMenu(user);
    const [dirty, clean] = screen.getAllByTestId("tab-list-item");
    expect(dirty.querySelector(".bg-blue-400")).not.toBeNull();
    expect(clean.querySelector(".bg-blue-400")).toBeNull();
  });

  it("row close button closes that tab without selecting it", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: "Close Beta" }));
    expect(guard.closeTab).toHaveBeenCalledTimes(1);
    expect(guard.closeTab).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: "t2" }),
    );
    expect(useTabsStore.getState().activeTabId).toBe("t1");
    expect(screen.getByTestId("tabs-search-input")).toBeInTheDocument();
  });

  it("Close all with unsaved tabs requests bulk-close confirmation instead of closing", async () => {
    const user = userEvent.setup();
    guard.useReal = true;
    useTabsStore.setState({
      tabs: [httpTab("t1", "Alpha", true), httpTab("t2", "Beta")],
    });
    render(<TabListDropdown />);
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: /close all/i }));
    expect(useUIStore.getState().pendingBulkClose).toEqual({ kind: "all" });
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

  it("Close all with only clean tabs closes every tab", async () => {
    const user = userEvent.setup();
    guard.useReal = true;
    render(<TabListDropdown />);
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: /close all/i }));
    expect(useTabsStore.getState().tabs).toHaveLength(0);
    expect(useUIStore.getState().pendingBulkClose).toBeNull();
  });

  it("clears the search when the menu is dismissed with Escape", async () => {
    const user = userEvent.setup();
    render(<TabListDropdown />);
    await user.type(await openMenu(user), "alp");
    await user.keyboard("{Escape}");
    expect(await openMenu(user)).toHaveValue("");
  });
});
