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
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { GraphQLTab, HttpTab, TabState, WebSocketTab } from "@/types";
import { TabContextMenu } from "./TabContextMenu";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useUIStore.setState({ pendingCloseTabId: null, pendingBulkClose: null });
}

function seedHttpTab(overrides: Partial<HttpTab> = {}) {
  useTabsStore
    .getState()
    .openTab({ type: "http", name: "My Request", ...overrides });
  const { tabs } = useTabsStore.getState();
  return tabs[tabs.length - 1] as HttpTab;
}

function renderOpenMenu(tab: HttpTab) {
  render(
    <ContextMenu open>
      <ContextMenuTrigger>
        <button type="button">Tab surface</button>
      </ContextMenuTrigger>
      <TabContextMenu tab={tab} />
    </ContextMenu>,
  );
}

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("TabContextMenu", () => {
  beforeEach(() => {
    resetStores();
  });

  it("Duplicate Tab adds a second tab with same HTTP fields", async () => {
    const user = userEvent.setup();
    const tab = seedHttpTab({ url: "https://dup.test", name: "Original" });
    renderOpenMenu(tab);

    await user.click(
      await screen.findByRole("menuitem", { name: /duplicate tab/i }),
    );
    const { tabs } = useTabsStore.getState();
    expect(tabs.length).toBe(2);
    const clone = tabs.find((t) => t.tabId !== tab.tabId) as HttpTab;
    expect(clone.type).toBe("http");
    expect(clone.url).toBe("https://dup.test");
    expect(clone.name).toBe("Original");
    expect(clone.isDirty).toBe(false);
  });

  it("Close Tab defers to guard when tab is dirty", () => {
    const tab = seedHttpTab({ isDirty: true });
    renderOpenMenu(tab);
    fireEvent.click(screen.getByRole("menuitem", { name: /^close tab$/i }));
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useUIStore.getState().pendingCloseTabId).toBe(tab.tabId);
  });

  it("Close Other Tabs is disabled when only one tab exists", () => {
    const tab = seedHttpTab();
    renderOpenMenu(tab);
    expect(
      screen.getByRole("menuitem", { name: /close other tabs/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("Close Other Tabs with two clean tabs keeps the tab the menu was opened for", async () => {
    const user = userEvent.setup();
    seedHttpTab({ name: "First" });
    const second = seedHttpTab({ name: "Second" });
    renderOpenMenu(second);

    await user.click(
      screen.getByRole("menuitem", { name: /close other tabs/i }),
    );
    const { tabs } = useTabsStore.getState();
    expect(tabs.length).toBe(1);
    expect(tabs[0]?.tabId).toBe(second.tabId);
  });

  it("Rename updates tab name after committing blur", async () => {
    const user = userEvent.setup();
    const tab = seedHttpTab({ name: "Old" });
    renderOpenMenu(tab);

    await user.click(screen.getByRole("menuitem", { name: /^rename$/i }));
    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.blur(input);

    await waitFor(() => {
      const t = useTabsStore.getState().tabs[0] as HttpTab;
      expect(t.name).toBe("Renamed");
    });
  });

  describe("Rename", () => {
    async function startRename(tab: HttpTab) {
      const user = userEvent.setup();
      renderOpenMenu(tab);
      await user.click(screen.getByRole("menuitem", { name: /^rename$/i }));
      return { user, input: await screen.findByRole("textbox") };
    }

    it("Escape cancels the rename and keeps the original name", async () => {
      const tab = seedHttpTab({ name: "Old" });
      const { input } = await startRename(tab);

      fireEvent.change(input, { target: { value: "Discarded" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(screen.queryByRole("textbox")).toBeNull();
      expect((useTabsStore.getState().tabs[0] as HttpTab).name).toBe("Old");
    });

    it("an empty name is ignored and the original name is kept", async () => {
      const tab = seedHttpTab({ name: "Old" });
      const { input } = await startRename(tab);

      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect((useTabsStore.getState().tabs[0] as HttpTab).name).toBe("Old");
      expect(screen.queryByRole("textbox")).toBeNull();
    });

    it("Enter commits the trimmed name without marking a clean tab dirty", async () => {
      const tab = seedHttpTab({ name: "Old" });
      const { input } = await startRename(tab);

      fireEvent.change(input, { target: { value: "  Fresh  " } });
      fireEvent.keyDown(input, { key: "Enter" });

      const updated = useTabsStore.getState().tabs[0] as HttpTab;
      expect(updated.name).toBe("Fresh");
      expect(updated.isDirty).toBe(false);
    });
  });

  describe("Set Label", () => {
    async function openLabelDialog(tab: HttpTab) {
      const user = userEvent.setup();
      renderOpenMenu(tab);
      await user.click(screen.getByRole("menuitem", { name: /set label/i }));
      await screen.findByText("Color");
      return user;
    }

    it("Apply stores the chosen color and group on the tab", async () => {
      const tab = seedHttpTab();
      const user = await openLabelDialog(tab);

      await user.click(screen.getByTitle("Red"));
      await user.type(screen.getByPlaceholderText(/auth, admin/i), "Admin");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      const updated = useTabsStore.getState().tabs[0] as HttpTab;
      expect(updated.color).toBe("#ef4444");
      expect(updated.group).toBe("Admin");
    });

    it("Clear removes an existing color and group from the tab", async () => {
      const tab = seedHttpTab();
      useTabsStore.getState().setTabLabel(tab.tabId, "Auth", "#3b82f6");
      const labelled = useTabsStore.getState().tabs[0] as HttpTab;
      const user = await openLabelDialog(labelled);

      await user.click(screen.getByRole("button", { name: "Clear" }));

      const updated = useTabsStore.getState().tabs[0] as HttpTab;
      expect(updated.color).toBeUndefined();
      expect(updated.group).toBeUndefined();
    });

    it("Cancel leaves the tab label unchanged", async () => {
      const tab = seedHttpTab();
      const user = await openLabelDialog(tab);

      await user.click(screen.getByTitle("Green"));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect((useTabsStore.getState().tabs[0] as HttpTab).color).toBeUndefined();
    });

    it("hides the Clear button when the tab has no label yet", async () => {
      const tab = seedHttpTab();
      await openLabelDialog(tab);

      expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    });
  });

  describe("Delete", () => {
    async function clickDelete(tab: HttpTab) {
      const user = userEvent.setup();
      renderOpenMenu(tab);
      await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));
      await screen.findByText("Delete the request?");
      return user;
    }

    it("asks for confirmation naming the request and keeps the tab until confirmed", async () => {
      const tab = seedHttpTab({ name: "Doomed" });
      await clickDelete(tab);

      expect(screen.getByText(/"Doomed" will be permanently deleted/)).toBeInTheDocument();
      expect(useTabsStore.getState().tabs).toHaveLength(1);
    });

    it("confirming removes the tab", async () => {
      const tab = seedHttpTab();
      const user = await clickDelete(tab);

      await user.click(screen.getByRole("button", { name: /yes, delete/i }));

      expect(useTabsStore.getState().tabs).toHaveLength(0);
    });

    it("cancelling keeps the tab", async () => {
      const tab = seedHttpTab();
      const user = await clickDelete(tab);

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(useTabsStore.getState().tabs).toHaveLength(1);
    });
  });

  describe("Duplicate Tab for non-HTTP tabs", () => {
    function renderForLastTab() {
      const { tabs } = useTabsStore.getState();
      const tab = tabs[tabs.length - 1] as TabState;
      render(
        <ContextMenu open>
          <ContextMenuTrigger>
            <button type="button">Tab surface</button>
          </ContextMenuTrigger>
          <TabContextMenu tab={tab} />
        </ContextMenu>,
      );
      return tab;
    }

    it("duplicates a GraphQL tab with its query, variables and operation name", async () => {
      const user = userEvent.setup();
      useTabsStore.getState().openTab({
        type: "graphql",
        name: "Users Query",
        url: "https://gql.test",
        query: "query Users { users { id } }",
        variables: '{"limit":1}',
        operationName: "Users",
      });
      const original = renderForLastTab();

      await user.click(screen.getByRole("menuitem", { name: /duplicate tab/i }));

      const { tabs } = useTabsStore.getState();
      expect(tabs).toHaveLength(2);
      const clone = tabs.find((t) => t.tabId !== original.tabId) as GraphQLTab;
      expect(clone.type).toBe("graphql");
      expect(clone.url).toBe("https://gql.test");
      expect(clone.query).toBe("query Users { users { id } }");
      expect(clone.variables).toBe('{"limit":1}');
      expect(clone.operationName).toBe("Users");
      expect(clone.isDirty).toBe(false);
    });

    it("duplicates a WebSocket tab with an empty message log", async () => {
      const user = userEvent.setup();
      useTabsStore.getState().openTab({
        type: "websocket",
        name: "Live Feed",
        url: "wss://ws.test",
        messageLog: [
          { id: "m1", direction: "sent", data: "hi", timestamp: 1 },
        ] as WebSocketTab["messageLog"],
      });
      const original = renderForLastTab();

      await user.click(screen.getByRole("menuitem", { name: /duplicate tab/i }));

      const { tabs } = useTabsStore.getState();
      expect(tabs).toHaveLength(2);
      const clone = tabs.find((t) => t.tabId !== original.tabId) as WebSocketTab;
      expect(clone.type).toBe("websocket");
      expect(clone.url).toBe("wss://ws.test");
      expect(clone.messageLog).toEqual([]);
    });
  });
});
