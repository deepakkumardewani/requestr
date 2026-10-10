/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TAB_TYPES } from "@/lib/constants";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import { CreateNewDropdown } from "./CreateNewDropdown";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useUIStore.setState({ isCreatingCollection: false, isCreatingEnv: false });
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("create-new-dropdown-trigger"));
}

function renderDropdown() {
  const onNewChain = vi.fn();
  const onImport = vi.fn();
  render(<CreateNewDropdown onNewChain={onNewChain} onImport={onImport} />);
  return { onNewChain, onImport };
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("CreateNewDropdown", () => {
  it("does not show menu items until the trigger is clicked", () => {
    renderDropdown();

    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it.each([
    ["HTTP", TAB_TYPES.HTTP],
    ["GraphQL", TAB_TYPES.GRAPHQL],
    ["WebSocket", TAB_TYPES.WEBSOCKET],
    ["Socket.IO", TAB_TYPES.SOCKETIO],
  ])("opens a %s tab when its item is chosen", async (label, tabType) => {
    const user = userEvent.setup();
    renderDropdown();

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: label }));

    const { tabs } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].type).toBe(tabType);
  });

  it("starts collection creation when the Collection item is chosen", async () => {
    const user = userEvent.setup();
    renderDropdown();

    await openMenu(user);
    await user.click(screen.getByTestId("create-collection-item"));

    expect(useUIStore.getState().isCreatingCollection).toBe(true);
    expect(useUIStore.getState().isCreatingEnv).toBe(false);
  });

  it("starts environment creation when the Environment item is chosen", async () => {
    const user = userEvent.setup();
    renderDropdown();

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Environment" }));

    expect(useUIStore.getState().isCreatingEnv).toBe(true);
    expect(useUIStore.getState().isCreatingCollection).toBe(false);
  });

  it("calls onNewChain without opening a tab when the Chain item is chosen", async () => {
    const user = userEvent.setup();
    const { onNewChain, onImport } = renderDropdown();

    await openMenu(user);
    await user.click(screen.getByTestId("create-chain-item"));

    expect(onNewChain).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalled();
    expect(useTabsStore.getState().tabs).toHaveLength(0);
  });

  it("calls onImport when the Import item is chosen", async () => {
    const user = userEvent.setup();
    const { onNewChain, onImport } = renderDropdown();

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Import" }));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onNewChain).not.toHaveBeenCalled();
  });
});
