/** @vitest-environment happy-dom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import { CreateNewDropdown } from "./CreateNewDropdown";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

const onNewChain = vi.fn();
const onImport = vi.fn();

async function openMenu() {
  const user = userEvent.setup();
  render(<CreateNewDropdown onNewChain={onNewChain} onImport={onImport} />);
  await user.click(screen.getByTestId("create-new-dropdown-trigger"));
  await screen.findByRole("menu");
  return user;
}

function lastTabType() {
  const { tabs } = useTabsStore.getState();
  return tabs[tabs.length - 1]?.type;
}

describe("CreateNewDropdown", () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null });
    useUIStore.setState({ isCreatingCollection: false, isCreatingEnv: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("labels the trigger and keeps the menu closed initially", () => {
    render(<CreateNewDropdown onNewChain={onNewChain} onImport={onImport} />);
    expect(screen.getByLabelText("Create new")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows Requests, Workspace, Import group labels in order", async () => {
    await openMenu();
    const labels = ["Requests", "Workspace", "Import"].map((name) =>
      screen.getAllByText(name)[0],
    );
    labels.slice(0, -1).forEach((el, i) => {
      expect(
        el.compareDocumentPosition(labels[i + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it("lists the items under each group in order", async () => {
    await openMenu();
    const names = screen
      .getAllByRole("menuitem")
      .map((el) => el.textContent?.trim());
    expect(names).toEqual([
      "HTTP",
      "GraphQL",
      "WebSocket",
      "Socket.IO",
      "Collection",
      "Environment",
      "Chain",
      "Import",
    ]);
  });

  it.each([
    ["HTTP", "http"],
    ["GraphQL", "graphql"],
    ["WebSocket", "websocket"],
    ["Socket.IO", "socketio"],
  ])("%s opens a %s tab", async (label, type) => {
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: label }));
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(lastTabType()).toBe(type);
  });

  it("Collection starts collection creation", async () => {
    const user = await openMenu();
    await user.click(screen.getByTestId("create-collection-item"));
    expect(useUIStore.getState().isCreatingCollection).toBe(true);
    expect(useUIStore.getState().isCreatingEnv).toBe(false);
  });

  it("Environment starts environment creation", async () => {
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Environment" }));
    expect(useUIStore.getState().isCreatingEnv).toBe(true);
    expect(useUIStore.getState().isCreatingCollection).toBe(false);
  });

  it("Chain calls onNewChain only", async () => {
    const user = await openMenu();
    await user.click(screen.getByTestId("create-chain-item"));
    expect(onNewChain).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalled();
  });

  it("Import calls onImport only", async () => {
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Import" }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onNewChain).not.toHaveBeenCalled();
    expect(within(document.body).queryByRole("menu")).not.toBeInTheDocument();
  });
});
