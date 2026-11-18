/** @vitest-environment happy-dom */
import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import {
  createInitialPickerState,
  createPickerStore,
  PickerProvider,
  pickerReducer,
  useIsPickerRowSelected,
  usePickerActions,
  usePickerActiveRowId,
  usePickerDraft,
  usePickerExpanded,
  usePickerMethodFilters,
  usePickerQuery,
  usePickerSelectedIds,
  usePickerSelectionCount,
  usePickerStore,
  type PickerState,
} from "./PickerContext";

const ids = (n: number, prefix = "r") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("pickerReducer", () => {
  const init = createInitialPickerState();

  it("sets the query and keeps identity when unchanged", () => {
    const next = pickerReducer(init, { type: "setQuery", query: "x" });
    expect(next.query).toBe("x");
    expect(pickerReducer(next, { type: "setQuery", query: "x" })).toBe(next);
  });

  it("toggles and clears method filters", () => {
    const on = pickerReducer(init, { type: "toggleMethodFilter", method: "GET" });
    expect(on.methodFilters.has("GET")).toBe(true);
    expect(pickerReducer(on, { type: "toggleMethodFilter", method: "GET" }).methodFilters.size).toBe(0);
    expect(pickerReducer(on, { type: "clearMethodFilters" }).methodFilters.size).toBe(0);
    expect(pickerReducer(init, { type: "clearMethodFilters" })).toBe(init);
  });

  it("toggles selection on and off", () => {
    const on = pickerReducer(init, { type: "toggleSelected", id: "a" });
    expect(on.selectedIds.has("a")).toBe(true);
    expect(pickerReducer(on, { type: "toggleSelected", id: "a" }).selectedIds.size).toBe(0);
  });

  it("rejects toggling and selectMany past the cap", () => {
    const full = pickerReducer(init, { type: "selectMany", ids: ids(PICKER_SELECTION_CAP + 10) });
    expect(full.selectedIds.size).toBe(PICKER_SELECTION_CAP);
    expect(pickerReducer(full, { type: "toggleSelected", id: "extra" })).toBe(full);
    expect(pickerReducer(full, { type: "selectMany", ids: ["extra"] })).toBe(full);
    expect(pickerReducer(full, { type: "toggleSelected", id: "r0" }).selectedIds.size).toBe(PICKER_SELECTION_CAP - 1);
  });

  it("selectMany/deselect/clearSelection keep identity on no-ops", () => {
    expect(pickerReducer(init, { type: "selectMany", ids: [] })).toBe(init);
    expect(pickerReducer(init, { type: "deselect", ids: ["nope"] })).toBe(init);
    expect(pickerReducer(init, { type: "clearSelection" })).toBe(init);
    const two = pickerReducer(init, { type: "selectMany", ids: ["a", "b"] });
    expect([...pickerReducer(two, { type: "deselect", ids: ["a"] }).selectedIds]).toEqual(["b"]);
    expect(pickerReducer(two, { type: "clearSelection" }).selectedIds.size).toBe(0);
  });

  it("manages expansion", () => {
    const set = new Set(["c1"]);
    expect(pickerReducer(init, { type: "setExpanded", expanded: set }).expanded).toBe(set);
    const open = pickerReducer(init, { type: "toggleExpanded", id: "c1" });
    expect(open.expanded.has("c1")).toBe(true);
    expect(pickerReducer(open, { type: "toggleExpanded", id: "c1" }).expanded.size).toBe(0);
  });

  it("sets the active row and keeps identity when unchanged", () => {
    const next = pickerReducer(init, { type: "setActiveRowId", id: "a" });
    expect(next.activeRowId).toBe("a");
    expect(pickerReducer(next, { type: "setActiveRowId", id: "a" })).toBe(next);
  });

  it("patches the draft and resets everything", () => {
    const patched = pickerReducer(init, { type: "patchDraft", patch: { name: "N", mode: "curl" } });
    expect(patched.draft).toMatchObject({ name: "N", mode: "curl", method: "GET" });
    const dirty: PickerState = { ...patched, query: "q", selectedIds: new Set(["a"]) };
    expect(pickerReducer(dirty, { type: "reset" })).toEqual(init);
  });
});

describe("createPickerStore", () => {
  it("notifies subscribers only on real changes and supports unsubscribe", () => {
    const store = createPickerStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.dispatch({ type: "setQuery", query: "" });
    expect(listener).not.toHaveBeenCalled();
    store.dispatch({ type: "setQuery", query: "a" });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.dispatch({ type: "setQuery", query: "b" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

const wrap =
  (open = true) =>
  ({ children }: { children: ReactNode }) => <PickerProvider open={open}>{children}</PickerProvider>;

function useAll() {
  return {
    actions: usePickerActions(),
    query: usePickerQuery(),
    filters: usePickerMethodFilters(),
    selected: usePickerSelectedIds(),
    count: usePickerSelectionCount(),
    expanded: usePickerExpanded(),
    active: usePickerActiveRowId(),
    draft: usePickerDraft(),
    store: usePickerStore(),
  };
}

describe("PickerProvider hooks", () => {
  it("throws outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => usePickerQuery())).toThrow(/PickerProvider/);
    spy.mockRestore();
  });

  it("exposes every slice and reflects actions", () => {
    const { result } = renderHook(useAll, { wrapper: wrap() });
    act(() => {
      result.current.actions.setQuery("q");
      result.current.actions.toggleMethodFilter("POST");
      result.current.actions.toggleExpanded("c1");
      result.current.actions.setExpanded(new Set(["c1", "f1"]));
      result.current.actions.setActiveRowId("collection:c1");
      result.current.actions.patchDraft({ url: "https://x" });
    });
    expect(result.current.query).toBe("q");
    expect(result.current.filters.has("POST")).toBe(true);
    expect([...result.current.expanded]).toEqual(["c1", "f1"]);
    expect(result.current.active).toBe("collection:c1");
    expect(result.current.draft.url).toBe("https://x");
    expect(result.current.store.getState().query).toBe("q");
    act(() => result.current.actions.clearMethodFilters());
    expect(result.current.filters.size).toBe(0);
  });

  it("enforces the selection cap through actions and reports it", () => {
    const { result } = renderHook(useAll, { wrapper: wrap() });
    let ok = true;
    act(() => {
      ok = result.current.actions.selectMany(ids(PICKER_SELECTION_CAP + 1));
    });
    expect(ok).toBe(false);
    expect(result.current.count).toBe(PICKER_SELECTION_CAP);
    act(() => {
      ok = result.current.actions.toggleSelected("extra");
    });
    expect(ok).toBe(false);
    act(() => {
      ok = result.current.actions.toggleSelected("r0");
    });
    expect(ok).toBe(true);
    expect(result.current.count).toBe(PICKER_SELECTION_CAP - 1);
    act(() => {
      ok = result.current.actions.toggleSelected("extra");
    });
    expect(ok).toBe(true);
    act(() => result.current.actions.deselect(["extra"]));
    act(() => result.current.actions.clearSelection());
    expect(result.current.count).toBe(0);
  });

  it("keeps selection and draft across query/filter changes (tab switch is outside context)", () => {
    const { result } = renderHook(useAll, { wrapper: wrap() });
    act(() => {
      result.current.actions.toggleSelected("a");
      result.current.actions.patchDraft({ mode: "curl", curlText: "curl x", name: "n" });
      result.current.actions.setQuery("zzz");
      result.current.actions.toggleMethodFilter("GET");
      result.current.actions.setQuery("");
    });
    expect(result.current.selected.has("a")).toBe(true);
    expect(result.current.draft).toMatchObject({ mode: "curl", curlText: "curl x", name: "n" });
  });

  it("resets all state when open flips to false, and stays when re-rendered open", () => {
    let open = true;
    const { result, rerender } = renderHook(useAll, {
      wrapper: ({ children }: { children: ReactNode }) => <PickerProvider open={open}>{children}</PickerProvider>,
    });
    act(() => {
      result.current.actions.setQuery("q");
      result.current.actions.toggleSelected("a");
      result.current.actions.patchDraft({ name: "keep?" });
    });
    rerender();
    expect(result.current.query).toBe("q");
    open = false;
    rerender();
    expect(result.current.query).toBe("");
    expect(result.current.count).toBe(0);
    expect(result.current.draft.name).toBe("");
    open = true;
    rerender();
    expect(result.current.query).toBe("");
  });

  it("re-renders a row only when its own selection changes", () => {
    const renders: Record<string, number> = { a: 0, b: 0 };
    function Row({ id }: { id: string }) {
      renders[id]++;
      return <span data-testid={id}>{String(useIsPickerRowSelected(id))}</span>;
    }
    let actions!: ReturnType<typeof usePickerActions>;
    function Grab() {
      actions = usePickerActions();
      return null;
    }
    render(
      <PickerProvider>
        <Grab />
        <Row id="a" />
        <Row id="b" />
      </PickerProvider>,
    );
    act(() => {
      actions.toggleSelected("a");
    });
    expect(screen.getByTestId("a").textContent).toBe("true");
    expect(screen.getByTestId("b").textContent).toBe("false");
    expect(renders.a).toBe(2);
    expect(renders.b).toBe(1);
  });
});
