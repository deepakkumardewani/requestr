/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  PickerItem,
  PickerKind,
} from "@/hooks/useRelayPickerItems";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayPicker } from "./RelayPicker";

// The workspace index is covered by its own specs; here the hook is the data boundary.
const pickerState = vi.hoisted(() => ({
  items: [] as PickerItem[],
  truncated: false,
  calls: [] as Array<{ query: string; kind: PickerKind }>,
}));

vi.mock("@/hooks/useRelayPickerItems", () => ({
  useRelayPickerItems: (query: string, kind: PickerKind) => {
    pickerState.calls.push({ query, kind });
    const items =
      kind === "all"
        ? pickerState.items
        : pickerState.items.filter((item) => item.kind === kind);
    return { items, total: items.length, truncated: pickerState.truncated };
  },
}));

// @tanstack/react-virtual measures the scroll element; happy-dom has no layout.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: 264,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: 320,
  });
  // cmdk scrolls the highlighted row into view.
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  pickerState.items = [];
  pickerState.truncated = false;
  pickerState.calls = [];
  useRelayStore.setState({ shareValues: false });
});

const sample: PickerItem[] = [
  { kind: "request", id: "r1", label: "Get users", detail: "GET /users" },
  { kind: "collection", id: "c1", label: "Billing" },
  { kind: "environment", id: "e1", label: "Staging" },
  { kind: "chain", id: "ch1", label: "Login flow" },
];

type SetupOptions = Partial<{
  open: boolean;
  initialQuery: string;
  returnFocus: boolean;
}>;

function setup({
  open = true,
  initialQuery,
  returnFocus = false,
}: SetupOptions = {}) {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  const returnFocusTo = createRef<HTMLElement>();
  const utils = render(
    <>
      <button type="button" data-testid="return-target" ref={returnFocusTo as never}>
        back
      </button>
      <RelayPicker
        open={open}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        initialQuery={initialQuery}
        returnFocusTo={returnFocus ? returnFocusTo : undefined}
        trigger={<button type="button" data-testid="trigger">+</button>}
      />
    </>,
  );
  return { onSelect, onOpenChange, ...utils };
}

const rows = () => screen.queryAllByTestId("relay-picker-row");
const search = () => screen.getByTestId("relay-picker-search") as HTMLInputElement;

function bulk(count: number): PickerItem[] {
  return Array.from({ length: count }, (_, i) => ({
    kind: "request" as const,
    id: `bulk-${i}`,
    label: `Request ${i}`,
    detail: `GET /r/${i}`,
  }));
}

describe("RelayPicker", () => {
  it("renders nothing but the trigger while closed", () => {
    setup({ open: false });
    expect(screen.getByTestId("trigger")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-picker")).toBeNull();
  });

  it("lists every kind with its label, detail and position", () => {
    pickerState.items = sample;
    setup();
    expect(screen.getByTestId("relay-picker")).toBeInTheDocument();
    const list = rows();
    expect(list.map((r) => r.getAttribute("data-kind"))).toEqual([
      "request",
      "collection",
      "environment",
      "chain",
    ]);
    expect(list[0]).toHaveTextContent("Get users");
    expect(list[0]).toHaveTextContent("GET /users");
    expect(list[0]).toHaveTextContent("kindRequest");
    expect(list[1]).toHaveTextContent("kindCollection");
    expect(list[3]).toHaveTextContent("kindChain");
    expect(list[1]).not.toHaveTextContent("GET");
    expect(list[2].getAttribute("aria-posinset")).toBe("3");
    expect(list[2].getAttribute("aria-setsize")).toBe("4");
  });

  it("renders only a bounded window of rows for 5,000 items", () => {
    pickerState.items = bulk(5000);
    setup();
    const count = rows().length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(30);
    expect(rows()[0].getAttribute("aria-setsize")).toBe("5000");
    expect(rows()[0]).toHaveTextContent("Request 0");
  });

  it("says values are hidden on environment rows while Share is off", () => {
    pickerState.items = sample;
    setup();
    const hidden = screen.getAllByTestId("relay-picker-values-hidden");
    expect(hidden).toHaveLength(1);
    expect(rows()[2]).toContainElement(hidden[0]);
    expect(hidden[0]).toHaveTextContent("valuesHidden");
  });

  it("drops the values-hidden note once Share is on", () => {
    pickerState.items = sample;
    useRelayStore.setState({ shareValues: true });
    setup();
    expect(screen.queryByTestId("relay-picker-values-hidden")).toBeNull();
  });

  it("starts with the typed @ text as the search", () => {
    pickerState.items = sample;
    setup({ initialQuery: "get" });
    expect(search().value).toBe("get");
    expect(pickerState.calls[0]).toEqual({ query: "get", kind: "all" });
  });

  it("passes typed text to the search and shows the empty state", () => {
    setup();
    expect(screen.getByTestId("relay-picker-empty")).toHaveTextContent("picker.empty");
    fireEvent.change(search(), { target: { value: "zzz" } });
    expect(search().value).toBe("zzz");
    expect(pickerState.calls.at(-1)).toEqual({ query: "zzz", kind: "all" });
  });

  it("hides the empty state when there are results", () => {
    pickerState.items = sample;
    setup();
    expect(screen.queryByTestId("relay-picker-empty")).toBeNull();
  });

  it("tells the user to keep typing when the results were capped", () => {
    pickerState.items = sample;
    pickerState.truncated = true;
    setup();
    expect(screen.getByTestId("relay-picker-truncated")).toHaveTextContent("picker.keepTyping");
  });

  it("omits the cap hint when results are complete", () => {
    pickerState.items = sample;
    setup();
    expect(screen.queryByTestId("relay-picker-truncated")).toBeNull();
  });

  it("filters by kind and reflects the pressed button", () => {
    pickerState.items = sample;
    setup();
    expect(screen.getByTestId("relay-picker-kind-all")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("relay-picker-kind-collection"));
    expect(screen.getByTestId("relay-picker-kind-collection")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("relay-picker-kind-all")).toHaveAttribute("aria-pressed", "false");
    expect(rows().map((r) => r.getAttribute("data-kind"))).toEqual(["collection"]);
    expect(screen.getByRole("group", { name: "picker.kindFilterLabel" })).toBeInTheDocument();
  });

  it("selects a row on click", () => {
    pickerState.items = sample;
    const { onSelect } = setup();
    fireEvent.click(rows()[1]);
    expect(onSelect).toHaveBeenCalledWith(sample[1]);
  });

  it("Enter in the search picks the first row by default", () => {
    pickerState.items = sample;
    const { onSelect } = setup();
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(sample[0]);
  });

  it("ArrowDown and ArrowUp move the highlight and clamp at the ends", () => {
    pickerState.items = sample;
    const { onSelect } = setup();
    fireEvent.keyDown(search(), { key: "ArrowUp" });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(sample[0]);
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(sample[2]);
    fireEvent.keyDown(search(), { key: "ArrowUp" });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(sample[1]);
    for (let i = 0; i < 6; i++) fireEvent.keyDown(search(), { key: "ArrowDown" });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(sample[3]);
  });

  it("Home and End jump to the first and last item, even when unmounted", () => {
    pickerState.items = bulk(5000);
    const { onSelect } = setup();
    fireEvent.keyDown(search(), { key: "End" });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(pickerState.items[4999]);
    fireEvent.keyDown(search(), { key: "Home" });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(pickerState.items[0]);
  });

  it("marks the highlighted row as selected", () => {
    pickerState.items = sample;
    setup();
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    const selected = rows().filter((r) => r.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent("Billing");
  });

  it("typing resets the highlight to the first row", () => {
    pickerState.items = sample;
    const { onSelect } = setup();
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    fireEvent.change(search(), { target: { value: "b" } });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(sample[0]);
  });

  it("Enter with no results selects nothing", () => {
    const { onSelect } = setup();
    fireEvent.keyDown(search(), { key: "Enter" });
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    fireEvent.keyDown(search(), { key: "End" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Enter in the search selects exactly once, not once per handler", () => {
    pickerState.items = sample;
    const { onSelect } = setup();
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("Enter on a control outside the search is left to cmdk, which picks the highlight", () => {
    pickerState.items = sample;
    const { onSelect } = setup();
    fireEvent.keyDown(screen.getByTestId("relay-picker-kind-all"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sample[0]);
  });

  it("ignores navigation keys while an IME composition is active", () => {
    pickerState.items = sample;
    const { onSelect } = setup();
    fireEvent.keyDown(search(), { key: "Enter", isComposing: true });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ignores unrelated keys", () => {
    pickerState.items = sample;
    const { onSelect } = setup();
    fireEvent.keyDown(search(), { key: "a" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("labels the search, the kind group and the list", () => {
    pickerState.items = sample;
    setup();
    // cmdk points aria-labelledby at its own title, so the attribute is what we own.
    expect(search()).toHaveAttribute("aria-label", "picker.searchLabel");
    expect(search()).toHaveAttribute("placeholder", "picker.searchPlaceholder");
    expect(within(screen.getByTestId("relay-picker")).getByRole("listbox")).toHaveAccessibleName("picker.listLabel");
  });

  it("Esc asks to close the picker", () => {
    pickerState.items = sample;
    const { onOpenChange } = setup({ returnFocus: true });
    fireEvent.keyDown(search(), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("returns focus to the given element when the picker closes", async () => {
    pickerState.items = sample;
    const onOpenChange = vi.fn();
    const returnFocusTo = createRef<HTMLElement>();
    const Harness = ({ open }: { open: boolean }) => (
      <>
        <button type="button" data-testid="return-target" ref={returnFocusTo as never}>
          back
        </button>
        <RelayPicker
          open={open}
          onOpenChange={onOpenChange}
          onSelect={vi.fn()}
          returnFocusTo={returnFocusTo}
          trigger={<button type="button" data-testid="trigger">+</button>}
        />
      </>
    );
    const { rerender } = render(<Harness open />);
    rerender(<Harness open={false} />);
    await waitFor(() =>
      expect(screen.getByTestId("return-target")).toHaveFocus(),
    );
  });
});
