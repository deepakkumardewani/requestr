/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useRelayRecentStore } from "@/stores/useRelayRecentStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import {
  Command,
  CommandList,
} from "@/components/ui/command";
import { RelayLauncher } from "./RelayLauncher";
import { RelayPickerRow } from "./RelayPickerRow";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 264 });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 320 });
  // cmdk calls scrollIntoView in happy-dom, which doesn't exist
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  useRelayStore.setState({ attachedItems: [] });
  useRelayRecentStore.setState({ items: [] });
  useCollectionsStore.setState({ collections: [], requests: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null } as never);
});

function seedWorkspace() {
  const base = {
    collectionId: "c1",
    method: "GET",
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
  };
  useCollectionsStore.setState({
    collections: [
      { id: "c1", name: "Payments", createdAt: 0, updatedAt: 0 },
      { id: "c2", name: "Auth", createdAt: 0, updatedAt: 0 },
    ],
    requests: [
      { ...base, id: "r1", name: "Get users", url: "https://api.test/users" },
      { ...base, id: "r2", name: "Get orders", url: "https://api.test/orders" },
      { ...base, id: "r3", name: "Create payment", url: "https://api.test/payments" },
    ],
  } as never);
}

type LauncherSetupOptions = {
  recents?: Array<{ kind: "request" | "chain"; id: string; name: string }>;
  activeTab?: { tabId: string; name: string };
  attached?: Array<{ kind: "request"; id: string; label: string }>;
};

function setup(options: LauncherSetupOptions = {}) {
  const { recents = [], activeTab, attached = [] } = options;
  const onClose = vi.fn();
  const onSelectChip = vi.fn();
  const onPasteCurl = vi.fn();
  const onRunCommand = vi.fn();
  const triggerRef = createRef<HTMLButtonElement>();

  if (activeTab) {
    useTabsStore.setState({
      tabs: [{ tabId: activeTab.tabId, name: activeTab.name, url: "", method: "GET", requestId: "r1" }],
      activeTabId: activeTab.tabId,
    } as never);
  }

  if (recents.length > 0) {
    useRelayRecentStore.setState({ items: recents });
  }

  if (attached.length > 0) {
    useRelayStore.setState({ attachedItems: attached });
  }

  seedWorkspace();

  render(
    <div>
      <button ref={triggerRef} data-testid="trigger">
        +
      </button>
      <RelayLauncher
        triggerRef={triggerRef}
        onClose={onClose}
        onSelectChip={onSelectChip}
        onPasteCurl={onPasteCurl}
        onRunCommand={onRunCommand}
      />
    </div>,
  );

  const launcher = screen.getByTestId("relay-launcher");
  const input = screen.getByTestId("relay-launcher-search") as HTMLInputElement;

  return {
    launcher,
    input,
    onClose,
    onSelectChip,
    onPasteCurl,
    onRunCommand,
    triggerRef,
  };
}

describe("RelayPickerRow", () => {
  const renderPickerRow = (
    item: Parameters<typeof RelayPickerRow>[0]["item"],
    index: number = 0,
    count: number = 1,
    valuesHidden: boolean = false,
    onSelect: (item: any) => void = vi.fn(),
  ) => {
    return render(
      <Command>
        <CommandList>
          <RelayPickerRow
            item={item}
            index={index}
            count={count}
            valuesHidden={valuesHidden}
            style={{}}
            onSelect={onSelect}
          />
        </CommandList>
      </Command>,
    );
  };

  it("renders a picker row with kind label and item label", () => {
    const onSelect = vi.fn();
    const item = { kind: "request" as const, id: "r1", label: "Get users", detail: "GET /users" };
    renderPickerRow(item, 0, 3, false, onSelect);
    const row = screen.getByTestId("relay-picker-row");
    expect(row).toHaveAttribute("data-kind", "request");
    expect(row).toHaveTextContent("Get users");
    expect(row).toHaveTextContent("GET /users");
  });

  it("renders without detail when not provided", () => {
    const onSelect = vi.fn();
    const item = { kind: "chain" as const, id: "c1", label: "My chain" };
    renderPickerRow(item, 1, 2, false, onSelect);
    expect(screen.getByTestId("relay-picker-row")).toHaveTextContent("My chain");
  });

  it("shows the values hidden note for environment when valuesHidden is true", () => {
    const onSelect = vi.fn();
    const item = { kind: "environment" as const, id: "e1", label: "Production" };
    renderPickerRow(item, 0, 1, true, onSelect);
    expect(screen.getByTestId("relay-picker-values-hidden")).toBeInTheDocument();
    expect(screen.getByTestId("relay-picker-values-hidden")).toHaveTextContent("valuesHidden");
  });

  it("does not show values hidden note for non-environment kinds", () => {
    const onSelect = vi.fn();
    const item = { kind: "request" as const, id: "r1", label: "Get users" };
    renderPickerRow(item, 0, 1, true, onSelect);
    expect(screen.queryByTestId("relay-picker-values-hidden")).toBeNull();
  });

  it("sets aria-posinset and aria-setsize correctly", () => {
    const onSelect = vi.fn();
    const item = { kind: "request" as const, id: "r1", label: "Get users" };
    renderPickerRow(item, 2, 5, false, onSelect);
    const row = screen.getByTestId("relay-picker-row");
    expect(row).toHaveAttribute("aria-posinset", "3");
    expect(row).toHaveAttribute("aria-setsize", "5");
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    const item = { kind: "collection" as const, id: "c1", label: "Payments API" };
    renderPickerRow(item, 0, 1, false, onSelect);
    fireEvent.click(screen.getByTestId("relay-picker-row"));
    expect(onSelect).toHaveBeenCalledWith(item);
  });
});

describe("RelayLauncher", () => {
  describe("root view", () => {
    it("renders with data-view='root' and shows sections in order", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const launcher = screen.getByTestId("relay-launcher");
      expect(launcher).toHaveAttribute("data-view", "root");
      expect(screen.getByTestId("relay-launcher-section-attach")).toBeInTheDocument();
      expect(screen.getByTestId("relay-launcher-section-actions")).toBeInTheDocument();
      const sections = screen.getAllByTestId(/relay-launcher-section-/);
      expect(sections.map((s) => s.getAttribute("data-testid"))).toEqual([
        "relay-launcher-section-attach",
        "relay-launcher-section-actions",
      ]);
    });

    it("shows Recent section when there are recents", () => {
      setup({ recents: [{ kind: "request", id: "r1", name: "Get users" }] });
      expect(screen.getByTestId("relay-launcher-section-recent")).toBeInTheDocument();
    });

    it("omits Recent section when empty", () => {
      setup();
      expect(screen.queryByTestId("relay-launcher-section-recent")).toBeNull();
    });

    it("renders launcher rows with icon, name and description", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const rows = screen.getAllByTestId("relay-launcher-row");
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => {
        expect(row).toHaveAttribute("data-row");
        expect(row).toHaveAttribute("data-section");
      });
    });

    it("disables currentTab row when there is no active tab", () => {
      setup();
      const currentTabRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:currentTab",
      );
      expect(currentTabRow).toHaveAttribute("aria-disabled", "true");
    });

    it("enables currentTab row when there is an active tab", () => {
      setup({ activeTab: { tabId: "t1", name: "Active Tab" } });
      const currentTabRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:currentTab",
      );
      expect(currentTabRow).not.toHaveAttribute("aria-disabled", "true");
    });

    it("shows no-results message when filtering yields nothing", () => {
      const { input } = setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      fireEvent.change(input, { target: { value: "zzzzzzzz" } });
      expect(screen.getByTestId("relay-launcher-empty")).toBeInTheDocument();
    });

    it("filters rows by name and description", () => {
      const { input } = setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      fireEvent.change(input, { target: { value: "import" } });
      expect(screen.queryByTestId("relay-launcher-empty")).toBeNull();
      const rows = screen.queryAllByTestId("relay-launcher-row");
      expect(rows.length).toBeGreaterThan(0);
    });

    it("focuses the search box on open", () => {
      const { input } = setup();
      expect(document.activeElement).toBe(input);
    });

    it("focuses the search box when stepping back from a list", () => {
      const { input } = setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      expect(screen.getByTestId("relay-launcher")).toHaveAttribute("data-view", "list");
      const backButton = screen.getByTestId("relay-launcher-back");
      fireEvent.click(backButton);
      expect(document.activeElement).toBe(input);
      expect(screen.getByTestId("relay-launcher")).toHaveAttribute("data-view", "root");
    });

    it("closes on Escape and calls onClose(true) to restore focus", () => {
      const { launcher, onClose } = setup();
      const commandDiv = launcher.querySelector("[cmdk-root]") as HTMLElement;
      fireEvent.keyDown(commandDiv || launcher, { key: "Escape" });
      expect(onClose).toHaveBeenCalledWith(true);
    });

    it("ignores Escape when isComposing is true", () => {
      const { input, onClose } = setup();
      // When isComposing is true (during IME composition), Escape should not close
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      // Set isComposing on the native event
      Object.defineProperty(event, "isComposing", { value: true, writable: true });
      input.dispatchEvent(event);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("ignores non-Escape keys in handleCommandKeyDown", () => {
      const { launcher, onClose } = setup();
      const commandDiv = launcher.querySelector("[cmdk-root]") as HTMLElement;
      fireEvent.keyDown(commandDiv || launcher, { key: "a" });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes on outside click and calls onClose(false)", () => {
      const { onClose } = setup();
      fireEvent.pointerDown(document.body);
      expect(onClose).toHaveBeenCalledWith(false);
    });

    it("does not close on click inside the launcher", () => {
      const { onClose } = setup();
      const input = screen.getByTestId("relay-launcher-search");
      fireEvent.pointerDown(input);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not close on click on the trigger button", () => {
      const { triggerRef, onClose } = setup();
      fireEvent.pointerDown(triggerRef.current!);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("makes no fetch calls when rendering and filtering", () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const { input } = setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      fireEvent.change(input, { target: { value: "import" } });
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("shows action rows for slash commands", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const actionSection = screen.getByTestId("relay-launcher-section-actions");
      expect(actionSection.querySelectorAll("[data-testid='relay-launcher-row']").length).toBeGreaterThan(0);
    });
  });

  describe("list view (Request)", () => {
    it("enters list view when clicking a list-attach row", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      expect(screen.getByTestId("relay-launcher")).toHaveAttribute("data-view", "list");
      expect(screen.queryByTestId("relay-launcher-list")).toBeNull();
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
    });

    it("shows back button in list view", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      expect(screen.getByTestId("relay-launcher-back")).toBeInTheDocument();
    });

    it("back button returns to root and clears the query", () => {
      const { launcher, input } = setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      fireEvent.change(input, { target: { value: "get" } });
      expect(input.value).toBe("get");
      const backButton = screen.getByTestId("relay-launcher-back");
      fireEvent.click(backButton);
      expect(screen.getByTestId("relay-launcher")).toHaveAttribute("data-view", "root");
      expect(input.value).toBe("");
    });

    it("shows the list heading from the translated label", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      const heading = screen.getByText("launcher.attach.request.label");
      expect(heading).toBeInTheDocument();
    });

    it("moves the selected mention option with ArrowDown and gives it a DOM id", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      const input = screen.getByTestId("relay-launcher-search");
      expect(input).toHaveAttribute("role", "combobox");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      const selected = screen
        .getAllByTestId("relay-mention-option")
        .find((option) => option.getAttribute("aria-selected") === "true");
      expect(selected).toBeDefined();
      expect(selected!.id).not.toBe("");
      expect(selected).toHaveAttribute("aria-posinset", "2");
    });

    it("pressing Escape in list view returns to root when MentionMenu handles it", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      expect(screen.getByTestId("relay-launcher")).toHaveAttribute("data-view", "list");
      const input = screen.getByTestId("relay-launcher-search");
      fireEvent.keyDown(input, { key: "Escape" });
      expect(screen.getByTestId("relay-launcher")).toHaveAttribute("data-view", "root");
    });

    it("focuses search box after entering list view", () => {
      const { input } = setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      expect(document.activeElement).toBe(input);
    });
  });

  describe("selecting items", () => {
    it("selecting a recent item calls onSelectChip", () => {
      const { onSelectChip } = setup({
        recents: [{ kind: "request", id: "r1", name: "Get users" }],
      });
      const rows = screen.getAllByTestId("relay-launcher-row");
      const recentRow = rows.find((row) => row.getAttribute("data-section") === "recent");
      expect(recentRow).toBeInTheDocument();
      fireEvent.click(recentRow!);
      expect(onSelectChip).toHaveBeenCalledWith({
        kind: "request",
        id: "r1",
        label: "Get users",
      });
    });

    it("selecting currentTab calls onSelectChip with tab info", () => {
      const { onSelectChip } = setup({ activeTab: { tabId: "t1", name: "Current Request" } });
      const currentTabRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:currentTab",
      );
      fireEvent.click(currentTabRow!);
      expect(onSelectChip).toHaveBeenCalledWith({
        kind: "tab",
        id: "t1",
        label: "Current Request",
      });
    });

    it("selecting pasteCurl calls onPasteCurl", () => {
      const { onPasteCurl } = setup();
      const pasteCurlRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:pasteCurl",
      );
      fireEvent.click(pasteCurlRow!);
      expect(onPasteCurl).toHaveBeenCalledTimes(1);
    });

    it("selecting an action row calls onRunCommand", () => {
      const { onRunCommand } = setup();
      const actionRows = screen.getAllByTestId("relay-launcher-row").filter(
        (row) => row.getAttribute("data-section") === "actions",
      );
      expect(actionRows.length).toBeGreaterThan(0);
      fireEvent.click(actionRows[0]);
      expect(onRunCommand).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));
    });

    it("filtering across sections shows matches from multiple kinds", () => {
      const { input } = setup({
        activeTab: { tabId: "t1", name: "Tab 1" },
        recents: [{ kind: "request", id: "r-run", name: "Run report" }],
      });
      fireEvent.change(input, { target: { value: "run" } });
      const filteredRows = screen.queryAllByTestId("relay-launcher-row");
      expect(filteredRows.length).toBeGreaterThan(0);
      // Check that there are matches from different sections (recent and actions both contain "run")
      const sections = new Set(filteredRows.map((row) => row.getAttribute("data-section")));
      expect(sections.size).toBeGreaterThanOrEqual(2);
    });

    it("pressing Enter on a Request row enters the list", () => {
      const { input, launcher } = setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      // Verify the request row is in the root view
      const rows = screen.getAllByTestId("relay-launcher-row");
      const requestRow = rows.find((row) => row.getAttribute("data-row") === "attach:request");
      expect(requestRow).toBeInTheDocument();
      // Navigate to the request row via keyboard and press Enter
      fireEvent.keyDown(input, { key: "ArrowDown" });
      // Keep pressing until the request row has data-selected=true
      let selected = launcher.querySelector("[data-row='attach:request'][data-selected='true']");
      let attempts = 0;
      while (!selected && attempts < 10) {
        fireEvent.keyDown(input, { key: "ArrowDown" });
        selected = launcher.querySelector("[data-row='attach:request'][data-selected='true']");
        attempts++;
      }
      expect(selected).toBeInTheDocument();
      // Press Enter to open the request list
      fireEvent.keyDown(input, { key: "Enter" });
      expect(screen.getByTestId("relay-launcher")).toHaveAttribute("data-view", "list");
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
    });

  });

  describe("inside composer integration", () => {
    it("prevents default on mouseDown in the launcher to keep focus from leaving", () => {
      const { launcher } = setup();
      const list = launcher.querySelector("[cmdk-list]") as HTMLElement;
      const mouseEvent = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      list.dispatchEvent(mouseEvent);
      expect(mouseEvent.defaultPrevented).toBe(true);
    });
  });

  describe("RelayPickerRow", () => {
    it("renders mention options with a valid kind in the request list", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      const options = screen.queryAllByTestId("relay-mention-option");
      expect(options.length).toBeGreaterThan(0);
      options.forEach((option) => {
        expect(["request", "chain", "collection", "environment", "tab"]).toContain(
          option.getAttribute("data-kind"),
        );
      });
    });

    it("sets aria-posinset and aria-setsize on mention options", () => {
      setup({ activeTab: { tabId: "t1", name: "Tab 1" } });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      const options = screen.queryAllByTestId("relay-mention-option");
      expect(options.length).toBeGreaterThan(0);
      options.forEach((option, index) => {
        expect(option).toHaveAttribute("aria-posinset", String(index + 1));
        expect(option).toHaveAttribute("aria-setsize", String(options.length));
      });
    });

    it("selecting a mention option calls onSelectChip", () => {
      const { onSelectChip } = setup({
        activeTab: { tabId: "t1", name: "Tab 1" },
        recents: [{ kind: "request", id: "r1", name: "Get users" }],
      });
      const requestRow = screen.getAllByTestId("relay-launcher-row").find(
        (row) => row.getAttribute("data-row") === "attach:request",
      );
      fireEvent.click(requestRow!);
      expect(screen.getByTestId("relay-launcher")).toHaveAttribute("data-view", "list");
      const mentionOptions = screen.queryAllByTestId("relay-mention-option");
      expect(mentionOptions.length).toBeGreaterThan(0);
      fireEvent.click(mentionOptions[0]);
      expect(onSelectChip).toHaveBeenCalled();
    });
  });
});
