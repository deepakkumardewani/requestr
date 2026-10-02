/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import type { CollectionModel, HistoryEntry, RequestModel } from "@/types";
import type { AddApiIntent, Chain } from "@/types/chain";
import { flattenPickerTree } from "@/lib/pickerTree";
import { ApiPickerDialog } from "./ApiPickerDialog";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
// Pass-through spy so tests can count flatten calls without changing behavior.
vi.mock("@/lib/pickerTree", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pickerTree")>();
  return { ...actual, flattenPickerTree: vi.fn(actual.flattenPickerTree) };
});

const CHAIN_ID = "chain-1";

function seedChain(overrides: Partial<Chain> = {}): Chain {
  return {
    id: CHAIN_ID,
    scope: "standalone",
    schemaVersion: 5,
    name: "Test chain",
    createdAt: 0,
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
    ...overrides,
  };
}

const chainState = () => useChainStore.getState().chains[CHAIN_ID];
const expandCollection = async () =>
  fireEvent.click(await screen.findByTestId("picker-header-collection:col-1"));

const COL: CollectionModel = {
  id: "col-1",
  name: "Main",
  createdAt: 1,
  updatedAt: 1,
};

const request: RequestModel = {
  id: "req-1",
  collectionId: COL.id,
  name: "List users",
  method: "GET",
  url: "https://api.test/users",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
};

function resetStores() {
  useCollectionsStore.setState({ collections: [], folders: [], requests: [], hydrated: true });
  useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() }, hydrated: true, history: {} });
  useUIStore.setState({ pickerTab: "collections" });
  localStorage.clear();
  useHistoryStore.setState({ entries: [] });
}

const VIEWPORT_HEIGHT = 400;

describe("ApiPickerDialog", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    // The virtualizer needs layout; give the scroll viewport a fixed size.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(VIEWPORT_HEIGHT);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts collapsed, selects on row click and adds only on footer Add", async () => {
    useCollectionsStore.setState({ collections: [COL], requests: [request] });
    const onClose = vi.fn();
    render(
      <ApiPickerDialog
        open
        onClose={onClose}
        chainId={CHAIN_ID}
       
        alreadyAddedIds={new Set()}
      />,
    );

    expect(await screen.findByTestId("picker-header-collection:col-1")).toBeTruthy();
    expect(screen.queryByTestId("picker-row-req-1")).toBeNull();
    await expandCollection();

    fireEvent.click(await screen.findByTestId("picker-row-req-1"));
    expect(chainState().nodeIds).toEqual([]);
    expect(screen.getByTestId("picker-selected-count").textContent).toBe("1 selected");

    fireEvent.click(screen.getByTestId("picker-add-selected"));
    expect(chainState().nodeIds).toEqual(["req-1"]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("adds nothing when dismissed without confirming", async () => {
    useCollectionsStore.setState({ collections: [COL], requests: [request] });
    const onClose = vi.fn();
    render(
      <ApiPickerDialog open onClose={onClose} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    await expandCollection();
    fireEvent.click(await screen.findByTestId("picker-row-req-1"));
    fireEvent.click(screen.getByTestId("picker-cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(chainState().nodeIds).toEqual([]);
  });

  it("hides the footer on the New request tab and shows filters on Collections and History", async () => {
    render(
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    expect(await screen.findByTestId("picker-footer")).toBeTruthy();
    expect(screen.getByTestId("picker-method-GET")).toBeTruthy();

    fireEvent.click(screen.getByTestId("picker-tab-history"));
    expect(await screen.findByTestId("picker-method-GET")).toBeTruthy();
    expect(screen.getByTestId("picker-footer")).toBeTruthy();

    fireEvent.click(screen.getByTestId("picker-tab-new"));
    await waitFor(() => expect(screen.queryByTestId("picker-footer")).toBeNull());
    expect(screen.queryByTestId("picker-method-GET")).toBeNull();
  });

  it("creates a request from the mounted New request tab and closes the dialog", async () => {
    const onClose = vi.fn();
    const onNodesAdded = vi.fn();
    render(
      <ApiPickerDialog
        open
        onClose={onClose}
        chainId={CHAIN_ID}
        alreadyAddedIds={new Set()}
        onNodesAdded={onNodesAdded}
      />,
    );
    fireEvent.click(await screen.findByTestId("picker-tab-new"));
    expect(await screen.findByTestId("picker-new-request")).toBeTruthy();

    fireEvent.change(screen.getByTestId("picker-new-url"), {
      target: { value: "https://api.test/created" },
    });
    fireEvent.click(screen.getByTestId("picker-new-request-submit"));

    // No collections are seeded, so the request is added to the chain only (an unsaved block).
    await waitFor(() => expect(chainState().blocks).toHaveLength(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNodesAdded).toHaveBeenCalledWith([chainState().blocks[0].id]);
  });

  it("submits the New request tab with Ctrl+Enter", async () => {
    const onClose = vi.fn();
    render(
      <ApiPickerDialog open onClose={onClose} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    fireEvent.click(await screen.findByTestId("picker-tab-new"));
    const url = await screen.findByTestId("picker-new-url");
    fireEvent.change(url, { target: { value: "https://api.test/keys" } });
    fireEvent.keyDown(url, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(chainState().blocks).toHaveLength(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the New request draft when switching tabs and back", async () => {
    render(
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    fireEvent.click(await screen.findByTestId("picker-tab-new"));
    fireEvent.change(await screen.findByTestId("picker-new-url"), {
      target: { value: "https://api.test/draft" },
    });

    fireEvent.click(screen.getByTestId("picker-tab-history"));
    await waitFor(() => expect(screen.queryByTestId("picker-new-url")).toBeNull());
    fireEvent.click(screen.getByTestId("picker-tab-new"));

    const url = (await screen.findByTestId("picker-new-url")) as HTMLInputElement;
    expect(url.value).toBe("https://api.test/draft");
  });

  it("filters the tree by search query and shows the no-results state", async () => {
    useCollectionsStore.setState({ collections: [COL], requests: [request] });
    render(
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    const input = await screen.findByTestId("picker-search");
    fireEvent.change(input, { target: { value: "users" } });
    expect(await screen.findByTestId("picker-row-req-1")).toBeTruthy();

    fireEvent.change(input, { target: { value: "zzz-nothing" } });
    expect(await screen.findByTestId("picker-no-results")).toBeTruthy();
  });

  it("filters by method chip with counts and clears it", async () => {
    useCollectionsStore.setState({
      collections: [COL],
      requests: [request, { ...request, id: "req-2", name: "Create", method: "POST" }],
    });
    render(
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    await expandCollection();
    expect((await screen.findByTestId("picker-method-POST")).textContent).toContain("1");
    fireEvent.click(screen.getByTestId("picker-method-POST"));
    await waitFor(() => expect(screen.queryByTestId("picker-row-req-1")).toBeNull());
    expect(screen.getByTestId("picker-row-req-2")).toBeTruthy();
    fireEvent.click(screen.getByTestId("picker-filter-clear"));
    expect(await screen.findByTestId("picker-row-req-1")).toBeTruthy();
  });

  it("marks requests already in the chain and does not add them", async () => {
    useCollectionsStore.setState({ collections: [COL], requests: [request] });
    render(
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set(["req-1"])} />,
    );
    await expandCollection();
    expect(await screen.findByText("In chain")).toBeTruthy();
    fireEvent.click(screen.getByTestId("picker-row-req-1"));
    expect((screen.getByTestId("picker-add-selected") as HTMLButtonElement).disabled).toBe(true);
  });

  it("reports the added ids so the canvas can fit them, only on confirm", async () => {
    useCollectionsStore.setState({
      collections: [COL],
      requests: [request, { ...request, id: "req-2", name: "Get user" }],
    });
    const onNodesAdded = vi.fn();
    render(
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} onNodesAdded={onNodesAdded} />,
    );
    await expandCollection();
    fireEvent.click(await screen.findByTestId("picker-row-req-1"));
    fireEvent.click(screen.getByTestId("picker-row-req-2"));
    expect(onNodesAdded).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("picker-add-selected"));
    expect(onNodesAdded).toHaveBeenCalledWith(["req-1", "req-2"]);
  });

  it("closes and asks the canvas to show an in-chain request", async () => {
    useCollectionsStore.setState({ collections: [COL], requests: [request] });
    const onClose = vi.fn();
    const onShowOnCanvas = vi.fn();
    render(
      <ApiPickerDialog open onClose={onClose} chainId={CHAIN_ID} alreadyAddedIds={new Set(["req-1"])} onShowOnCanvas={onShowOnCanvas} />,
    );
    await expandCollection();
    fireEvent.click(await screen.findByTestId("picker-show-on-canvas-req-1"));
    expect(onShowOnCanvas).toHaveBeenCalledWith("req-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("adds a multi-selection as one undoable step", async () => {
    useCollectionsStore.setState({
      collections: [COL],
      requests: [request, { ...request, id: "req-2", name: "Get user" }],
    });
    render(
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    await expandCollection();
    fireEvent.click(await screen.findByTestId("picker-row-req-1"));
    fireEvent.click(screen.getByTestId("picker-row-req-2"));
    fireEvent.click(screen.getByTestId("picker-add-selected"));

    expect(chainState().nodeIds).toEqual(["req-1", "req-2"]);
    useChainStore.getState().undo(CHAIN_ID);
    expect(chainState().nodeIds).toEqual([]);
  });

  it("focuses the search input when the dialog opens", async () => {
    render(
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    const input = await screen.findByTestId("picker-search");
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("calls onClose when the dialog requests close", async () => {
    useCollectionsStore.setState({ collections: [COL], requests: [request] });
    const onClose = vi.fn();

    render(
      <ApiPickerDialog
        open
        onClose={onClose}
        chainId={CHAIN_ID}
       
        alreadyAddedIds={new Set()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Add API Request")).toBeTruthy();
    });

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("adds a history-type node when a history row is selected and confirmed", async () => {
    const tab = {
      tabId: "tab-1",
      requestId: null as string | null,
      name: "H",
      isDirty: false,
      type: "http" as const,
      method: "GET" as const,
      url: "https://hist.example/path",
      headers: [],
      params: [],
      auth: { type: "none" as const },
      body: { type: "none" as const, content: "" },
      preScript: "",
      postScript: "",
    };
    const entry: HistoryEntry = {
      id: "h1",
      method: "GET",
      url: "https://hist.example/path",
      status: 200,
      duration: 10,
      size: 1,
      timestamp: Date.now(),
      request: tab,
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "",
        duration: 10,
        size: 1,
        url: "https://hist.example/path",
        method: "GET",
        timestamp: Date.now(),
      },
    };

    useHistoryStore.setState({ entries: [entry] });
    const onClose = vi.fn();

    render(
      <ApiPickerDialog
        open
        onClose={onClose}
        chainId={CHAIN_ID}
        alreadyAddedIds={new Set()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^history$/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("tab", { name: /^history$/i }));

    await waitFor(() => {
      expect(screen.getByText("https://hist.example/path")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("picker-row-h1"));
    fireEvent.click(screen.getByTestId("picker-add-selected"));

    const blocks = useChainStore.getState().chains[CHAIN_ID].blocks;
    expect(blocks).toContainEqual(
      expect.objectContaining({
        type: "history",
        historyEntryId: "h1",
        method: "GET",
        url: "https://hist.example/path",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  describe("shell", () => {
    const LONG_URL = `https://api.test/${"x".repeat(400)}`;

    function renderShell(props: Partial<React.ComponentProps<typeof ApiPickerDialog>> = {}) {
      return render(
        <ApiPickerDialog
          open
          onClose={vi.fn()}
          chainId={CHAIN_ID}
         
          alreadyAddedIds={new Set()}
          {...props}
        />,
      );
    }

    it("renders three labelled tabs with stable test ids and a description", async () => {
      renderShell();

      for (const [id, label] of [
        ["collections", "Collections"],
        ["history", "History"],
        ["new", "New request"],
      ] as const) {
        const tab = await screen.findByTestId(`picker-tab-${id}`);
        expect(tab.textContent).toBe(label);
        expect(tab.className).not.toMatch(/\bh-(10|12)\b/);
      }
      const dialog = screen.getByTestId("api-picker-dialog");
      expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
      expect(document.getElementById(dialog.getAttribute("aria-describedby") ?? "")?.textContent).toMatch(
        /Pick requests/,
      );
    });

    it("persists the selected tab in the UI store and restores it on reopen", async () => {
      const view = renderShell();
      fireEvent.click(await screen.findByTestId("picker-tab-new"));

      expect(useUIStore.getState().pickerTab).toBe("new");
      expect(localStorage.getItem("rq_chain_picker_tab")).toBe("new");
      expect(screen.getByTestId("picker-panel-new")).toBeTruthy();

      view.unmount();
      renderShell();
      expect(
        (await screen.findByTestId("picker-tab-new")).getAttribute("aria-selected"),
      ).toBe("true");
    });

    it("switches tabs with the arrow keys", async () => {
      renderShell();
      const collectionsTab = await screen.findByTestId("picker-tab-collections");
      collectionsTab.focus();

      fireEvent.keyDown(collectionsTab, { key: "ArrowRight", code: "ArrowRight" });

      await waitFor(() => {
        expect(useUIStore.getState().pickerTab).toBe("history");
      });
    });

    it("shows skeleton rows while collections hydrate", async () => {
      useCollectionsStore.setState({ collections: [], requests: [], hydrated: false });
      renderShell();

      expect(await screen.findByTestId("picker-skeleton")).toBeTruthy();
      expect(screen.queryByText("No collections yet")).toBeNull();
    });

    it("shows the empty state once hydrated with no collections", async () => {
      renderShell();
      expect(await screen.findByText("No collections yet")).toBeTruthy();
    });

    it("keeps long URLs inside a single vertical scroll region", async () => {
      useCollectionsStore.setState({
        collections: [COL],
        requests: [{ ...request, url: LONG_URL }],
      });
      renderShell();
      await expandCollection();

      const url = await screen.findByText(LONG_URL);
      expect(url.className).toContain("truncate");
      const region = screen.getByTestId("picker-tree");
      expect(region.contains(url)).toBe(true);
      expect(region).not.toBeNull();
      expect(region?.className).toContain("overflow-y-auto");
      expect(region?.className).toContain("overflow-x-hidden");
      expect(region?.className).toContain("min-w-0");
      expect(screen.getByTestId("api-picker-dialog").className).toContain("min-w-0");
      // Layout-free DOM reports 0; real widths are asserted in the Playwright QA spec.
      expect(region?.scrollWidth).toBeLessThanOrEqual(region?.clientWidth ?? 0);
      expect(document.querySelector('[data-slot="scroll-area"]')).toBeNull();
    });

    it("contains list render errors and retries by re-hydrating", async () => {
      const hydrate = vi.fn().mockResolvedValue(undefined);
      useCollectionsStore.setState({ hydrate, collections: [COL], requests: [request] });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      let shouldThrow = true;
      useHistoryStore.setState({
        entries: new Proxy([] as HistoryEntry[], {
          get(target, key, receiver) {
            if (key === "length" && shouldThrow) throw new Error("boom");
            return Reflect.get(target, key, receiver);
          },
        }),
      });
      useUIStore.setState({ pickerTab: "history" });
      renderShell();

      expect(await screen.findByTestId("picker-error")).toBeTruthy();
      shouldThrow = false;
      fireEvent.click(screen.getByTestId("picker-retry"));

      expect(hydrate).toHaveBeenCalledTimes(1);
      expect(await screen.findByText("No history yet")).toBeTruthy();
      consoleError.mockRestore();
    });

    it("resets nothing persisted but the tab when closed and reopened", async () => {
      useUIStore.setState({ pickerTab: "history" });
      const view = renderShell();
      view.rerender(
        <ApiPickerDialog
          open={false}
          onClose={vi.fn()}
          chainId={CHAIN_ID}
         
          alreadyAddedIds={new Set()}
        />,
      );
      expect(useUIStore.getState().pickerTab).toBe("history");
    });
  });

  describe("add intent", () => {
    const request2: RequestModel = { ...request, id: "req-2", name: "Get user" };

    async function renderWithIntent(intent: AddApiIntent | undefined) {
      useCollectionsStore.setState({
        collections: [COL],
        requests: [request, request2],
      });
      const props = {
        onClose: vi.fn(),
        chainId: CHAIN_ID,
        alreadyAddedIds: new Set<string>(),
      };
      const view = render(<ApiPickerDialog open intent={intent} {...props} />);
      await expandCollection();
      return { ...view, props };
    }

    const pick = async (...ids: string[]) => {
      for (const id of ids) fireEvent.click(await screen.findByTestId(`picker-row-${id}`));
      fireEvent.click(screen.getByTestId("picker-add-selected"));
    };

    it("joins the pending connection to the first added request only", async () => {
      await renderWithIntent({
        pendingConnection: { nodeId: "n1", handleId: "out" },
        position: { x: 10, y: 20 },
      });
      await pick("req-1", "req-2");

      expect(chainState().edges).toHaveLength(1);
      expect(chainState().edges[0]).toMatchObject({ sourceRequestId: "n1", targetRequestId: "req-1" });
      expect(chainState().nodePositions["req-1"]).toEqual({ x: 10, y: 20 });
      expect(chainState().nodePositions["req-2"].x).toBe(10);
    });

    it("places at a position intent", async () => {
      await renderWithIntent({ position: { x: 5, y: 7 } });
      await pick("req-1");
      expect(chainState().nodePositions["req-1"]).toEqual({ x: 5, y: 7 });
    });

    it("discards the pending connection when dismissed", async () => {
      const { props } = await renderWithIntent({ pendingConnection: { nodeId: "n1" } });
      fireEvent.click(await screen.findByTestId("picker-row-req-1"));
      fireEvent.click(screen.getByTestId("picker-cancel"));

      expect(props.onClose).toHaveBeenCalled();
      expect(chainState().edges).toEqual([]);
      expect(chainState().nodeIds).toEqual([]);
    });
  });
});

describe("ApiPickerDialog performance and accessibility", () => {
  const LARGE_REQUEST_COUNT = 1500;

  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(VIEWPORT_HEIGHT);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("flattens 1,500 requests once per input and re-scores on typing without rebuilding the tree", async () => {
    const requests = Array.from({ length: LARGE_REQUEST_COUNT }, (_, i) => ({
      ...request,
      id: `req-${i}`,
      name: `Request ${i}`,
    }));
    // The tree builder walks the source array with for..of once per (re)build.
    const originalIterator = requests[Symbol.iterator].bind(requests);
    const treeBuilds = vi.fn(originalIterator);
    Object.defineProperty(requests, Symbol.iterator, { value: treeBuilds });
    useCollectionsStore.setState({ collections: [COL], requests });

    render(<ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />);
    await screen.findByTestId("picker-header-collection:col-1");

    const flatten = vi.mocked(flattenPickerTree);
    expect(flatten).toHaveBeenCalledTimes(1);
    expect(treeBuilds).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByTestId("picker-search"), { target: { value: "Request 14" } });
    await waitFor(() => expect(flatten.mock.calls.at(-1)?.[3].filter).toBe("Request 14"));

    // Typing only re-scores: the filtered row list is derived from the memoized tree (treeBuilds
    // stays 1, source arrays unchanged). A filtered row list is new output, so one scoring call is
    // expected; nothing else may re-flatten.
    expect(flatten).toHaveBeenCalledTimes(2);
    expect(new Set(flatten.mock.calls.map((call) => call[2])).size).toBe(1);
    expect(treeBuilds).toHaveBeenCalledTimes(1);
  });

  it("labels the dialog with a title and description and exposes polite live regions", async () => {
    useCollectionsStore.setState({ collections: [COL], requests: [request] });
    render(<ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />);

    const dialog = await screen.findByTestId("api-picker-dialog");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(labelledBy && document.getElementById(labelledBy)?.textContent).toBe("Add API Request");
    expect(describedBy && document.getElementById(describedBy)?.textContent).toContain("Pick requests");

    const results = screen.getByTestId("picker-result-announcement");
    expect(results.getAttribute("role")).toBe("status");
    expect(results.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByTestId("picker-selected-count").getAttribute("aria-live")).toBe("polite");
  });
});
