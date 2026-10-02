/** @vitest-environment happy-dom */
import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import { PICKER_PAGE_SIZE } from "@/lib/pickerNav";
import { flattenPickerTree } from "@/lib/pickerTree";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { CollectionModel, RequestModel } from "@/types";
import { PickerProvider, usePickerActions, usePickerExpanded, usePickerStore } from "./PickerContext";
import { PICKER_ROW_HEIGHT } from "./PickerRow";
import { PickerTree } from "./PickerTree";

const VIEWPORT_HEIGHT = 400;
const MAX_DOM_ROWS = 80;

// The virtualizer needs layout; a fixed-size scroll viewport keeps the DOM window real.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(VIEWPORT_HEIGHT);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const collection = (id: string): CollectionModel => ({ id, name: id, createdAt: 1, updatedAt: 1 });
const req = (id: string, collectionId: string, name = id): RequestModel => ({
  id,
  collectionId,
  name,
  method: "GET",
  url: `https://api.test/${id}`,
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

let actions: ReturnType<typeof usePickerActions>;
let store: ReturnType<typeof usePickerStore>;
function Capture() {
  actions = usePickerActions();
  store = usePickerStore();
  return null;
}

type SetupOptions = {
  collections: CollectionModel[];
  requests: RequestModel[];
  expandAll?: boolean;
  inChain?: string[];
};

function Harness(props: {
  collections: CollectionModel[];
  requests: RequestModel[];
  initialExpanded: ReadonlySet<string>;
  inChainIds: ReadonlySet<string>;
  onAddIds: (ids: string[]) => void;
  onShowOnCanvas: (id: string) => void;
}) {
  const expanded = usePickerExpanded();
  const { setExpanded } = usePickerActions();
  // Seed once; later collapses must stick.
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed on mount only
  useEffect(() => setExpanded(props.initialExpanded), []);
  const rows = flattenPickerTree(props.collections, [], props.requests, { expanded });
  return (
    <PickerTree
      rows={rows}
      inChainIds={props.inChainIds}
      onAddIds={props.onAddIds}
      onShowOnCanvas={props.onShowOnCanvas}
    />
  );
}

function setup({ collections, requests, expandAll = true, inChain = [] }: SetupOptions) {
  const onAddIds = vi.fn();
  const onShowOnCanvas = vi.fn();
  render(
    <PickerProvider>
      <Capture />
      <Harness
        collections={collections}
        requests={requests}
        initialExpanded={new Set(expandAll ? collections.map((c) => c.id) : [])}
        inChainIds={new Set(inChain)}
        onAddIds={onAddIds}
        onShowOnCanvas={onShowOnCanvas}
      />
    </PickerProvider>,
  );
  return { onAddIds, onShowOnCanvas };
}

const tree = () => screen.getByTestId("picker-tree");
const key = (k: string, init: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(tree(), { key: k, ...init });
const active = () => tree().getAttribute("aria-activedescendant");
const domRows = () => tree().querySelectorAll('[role="option"], [role="treeitem"]').length;

const many = (n: number) => Array.from({ length: n }, (_, i) => req(`r${i}`, "c1"));

describe("PickerTree", () => {
  it("exposes a tree with the first row active and fixed-height rows", () => {
    setup({ collections: [collection("c1")], requests: many(3) });
    expect(tree().getAttribute("role")).toBe("tree");
    expect(active()).toContain("collection:c1");
    expect(screen.getByTestId("picker-row-r0")).toBeTruthy();
    expect(PICKER_ROW_HEIGHT).toBe(36);
  });

  it.each([148, 600])("renders fewer than %i DOM rows for %i requests", (n) => {
    setup({ collections: [collection("c1")], requests: many(n) });
    expect(domRows()).toBeGreaterThan(0);
    expect(domRows()).toBeLessThan(MAX_DOM_ROWS);
  });

  it("expands 600 requests on Right without rendering them all", () => {
    setup({ collections: [collection("c1")], requests: many(600), expandAll: false });
    expect(domRows()).toBe(1);
    key("ArrowRight");
    expect(domRows()).toBeGreaterThan(1);
    expect(domRows()).toBeLessThan(MAX_DOM_ROWS);
  });

  it("moves the active row with Down/Up/End/Home", () => {
    setup({ collections: [collection("c1")], requests: many(3) });
    key("ArrowDown");
    expect(active()).toContain("r0");
    key("End");
    expect(active()).toContain("r2");
    key("ArrowUp");
    expect(active()).toContain("r1");
    key("Home");
    expect(active()).toContain("collection:c1");
  });

  it("pages the active row with PageDown/PageUp, clamping at the ends", () => {
    setup({ collections: [collection("c1")], requests: many(30) });
    key("PageDown");
    expect(active()).toContain(`r${PICKER_PAGE_SIZE - 1}`);
    key("PageDown");
    expect(active()).toContain(`r${PICKER_PAGE_SIZE * 2 - 1}`);
    key("PageUp");
    expect(active()).toContain(`r${PICKER_PAGE_SIZE - 1}`);
    key("PageUp");
    key("PageUp");
    expect(active()).toContain("collection:c1");
    key("End");
    key("PageDown");
    expect(active()).toContain("r29");
  });

  it("selects with Space and toggles it off again", () => {
    setup({ collections: [collection("c1")], requests: many(2) });
    key("ArrowDown");
    key(" ");
    expect(store.getState().selectedIds.has("r0")).toBe(true);
    key(" ");
    expect(store.getState().selectedIds.has("r0")).toBe(false);
  });

  it("extends a range with Shift+Arrow", () => {
    setup({ collections: [collection("c1")], requests: many(4) });
    key("ArrowDown");
    key("ArrowDown", { shiftKey: true });
    key("ArrowDown", { shiftKey: true });
    expect([...store.getState().selectedIds]).toEqual(expect.arrayContaining(["r0", "r1"]));
  });

  it("selects every visible request with Cmd+A, capped at the selection limit", () => {
    setup({ collections: [collection("c1")], requests: many(PICKER_SELECTION_CAP + 20) });
    key("a", { metaKey: true });
    expect(store.getState().selectedIds.size).toBe(PICKER_SELECTION_CAP);
    expect(screen.getAllByText(/up to 100 requests/).length).toBeGreaterThan(0);
  });

  it("adds a lone active row on Enter when nothing is selected, but toggles when something is", () => {
    const { onAddIds } = setup({ collections: [collection("c1")], requests: many(2) });
    key("ArrowDown");
    key("Enter");
    expect(onAddIds).toHaveBeenCalledWith(["r0"]);
    act(() => void actions.selectMany(["r1"]));
    onAddIds.mockClear();
    key("Enter");
    expect(onAddIds).not.toHaveBeenCalled();
    expect(store.getState().selectedIds.has("r0")).toBe(true);
  });

  it("never selects or adds an in-chain row and announces it", () => {
    const { onAddIds } = setup({ collections: [collection("c1")], requests: many(2), inChain: ["r0"] });
    key("ArrowDown");
    key("Enter");
    key(" ");
    expect(onAddIds).not.toHaveBeenCalled();
    expect(store.getState().selectedIds.size).toBe(0);
    expect(screen.getAllByText("Already in this chain").length).toBeGreaterThan(0);
  });

  it("collapses with Left and moves to the parent header from a request", () => {
    setup({ collections: [collection("c1")], requests: many(2) });
    key("ArrowDown");
    key("ArrowLeft");
    expect(active()).toContain("collection:c1");
    key("ArrowLeft");
    expect(domRows()).toBe(1);
  });

  it("pins the owning collection header once scrolled past it", () => {
    setup({ collections: [collection("c1")], requests: many(60) });
    expect(screen.queryByTestId("picker-sticky-header")).toBeNull();
    tree().scrollTop = PICKER_ROW_HEIGHT * 10;
    fireEvent.scroll(tree());
    expect(screen.getByTestId("picker-sticky-header").textContent).toContain("c1");
  });

  it("shows a non-expandable header for an empty collection", () => {
    setup({ collections: [collection("empty")], requests: [] });
    const header = screen.getByTestId("picker-header-collection:empty");
    expect(header.getAttribute("aria-expanded")).toBeNull();
    key("ArrowRight");
    expect(domRows()).toBe(1);
  });

  it("wires Show on canvas for an in-chain row", () => {
    const { onShowOnCanvas } = setup({ collections: [collection("c1")], requests: many(1), inChain: ["r0"] });
    fireEvent.click(screen.getByTestId("picker-show-on-canvas-r0"));
    expect(onShowOnCanvas).toHaveBeenCalledWith("r0");
  });
});

describe("PickerTree recents", () => {
  const requests = [req("a", "c1"), req("b", "c1")];
  const runOf = (id: string, timestamp: number) =>
    ({ id: `h-${id}`, timestamp, request: { requestId: id } }) as never;

  function renderRecents(inChain: string[] = []) {
    useCollectionsStore.setState({ collections: [collection("c1")], requests });
    useHistoryStore.setState({ entries: [runOf("a", 1), runOf("b", 2)] });
    function RecentHarness() {
      const rows = flattenPickerTree([collection("c1")], [], requests, { expanded: new Set() });
      return (
        <PickerTree
          rows={rows}
          inChainIds={new Set(inChain)}
          onAddIds={vi.fn()}
          onShowOnCanvas={vi.fn()}
          showRecents
        />
      );
    }
    render(
      <PickerProvider>
        <Capture />
        <RecentHarness />
      </PickerProvider>,
    );
  }

  it("lists recent saved requests above the tree, newest first", () => {
    renderRecents();
    const items = screen.getByTestId("picker-recent").querySelectorAll("button");
    expect([...items].map((b) => b.getAttribute("data-testid"))).toEqual(["picker-recent-b", "picker-recent-a"]);
  });

  it("selects through the shared selection and disables in-chain items", () => {
    renderRecents(["a"]);
    fireEvent.click(screen.getByTestId("picker-recent-b"));
    expect(store.getState().selectedIds.has("b")).toBe(true);
    expect((screen.getByTestId("picker-recent-a") as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides while searching or filtering", () => {
    renderRecents();
    act(() => actions.setQuery("x"));
    expect(screen.queryByTestId("picker-recent")).toBeNull();
    act(() => actions.setQuery(""));
    expect(screen.getByTestId("picker-recent")).toBeTruthy();
    act(() => actions.toggleMethodFilter("GET"));
    expect(screen.queryByTestId("picker-recent")).toBeNull();
  });

  it("is hidden when there is no history", () => {
    renderRecents();
    act(() => useHistoryStore.setState({ entries: [] }));
    expect(screen.queryByTestId("picker-recent")).toBeNull();
  });
});
