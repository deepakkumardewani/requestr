"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import type { HttpMethod } from "@/types";

/**
 * Ephemeral, subtree-local picker state (CLAUDE.md: React Context, not a store). The active tab is NOT
 * here: it is persisted in `useUIStore`. Context carries a stable external store so consumers subscribe
 * to slices through selector hooks and re-render only when their slice changes.
 */

export type PickerMethodFilter = HttpMethod | "OTHER";
export type NewRequestMode = "blank" | "curl";

export type NewRequestDraft = {
  mode: NewRequestMode;
  name: string;
  method: HttpMethod;
  url: string;
  curlText: string;
  /** `null` means "this chain only" (unsaved); otherwise the collection to save into. */
  targetCollectionId: string | null;
  targetFolderId: string | null;
};

export type PickerState = {
  query: string;
  methodFilters: ReadonlySet<PickerMethodFilter>;
  selectedIds: ReadonlySet<string>;
  /** Raw collection/folder ids, same contract as `flattenPickerTree`'s `expanded`. */
  expanded: ReadonlySet<string>;
  activeRowId: string | null;
  draft: NewRequestDraft;
};

export type PickerAction =
  | { type: "setQuery"; query: string }
  | { type: "toggleMethodFilter"; method: PickerMethodFilter }
  | { type: "clearMethodFilters" }
  | { type: "toggleSelected"; id: string }
  | { type: "selectMany"; ids: readonly string[] }
  | { type: "deselect"; ids: readonly string[] }
  | { type: "clearSelection" }
  | { type: "setExpanded"; expanded: ReadonlySet<string> }
  | { type: "toggleExpanded"; id: string }
  | { type: "setActiveRowId"; id: string | null }
  | { type: "patchDraft"; patch: Partial<NewRequestDraft> }
  | { type: "reset" };

export const DEFAULT_DRAFT_METHOD: HttpMethod = "GET";

export const createInitialDraft = (): NewRequestDraft => ({
  mode: "blank",
  name: "",
  method: DEFAULT_DRAFT_METHOD,
  url: "",
  curlText: "",
  targetCollectionId: null,
  targetFolderId: null,
});

export const createInitialPickerState = (): PickerState => ({
  query: "",
  methodFilters: new Set(),
  selectedIds: new Set(),
  expanded: new Set(),
  activeRowId: null,
  draft: createInitialDraft(),
});

function withToggled<T>(source: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(source);
  if (!next.delete(value)) next.add(value);
  return next;
}

/** Adds ids until the cap is hit; returns the same set when nothing was added. */
function addCapped(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): ReadonlySet<string> {
  const next = new Set(selected);
  for (const id of ids) {
    if (next.size >= PICKER_SELECTION_CAP) break;
    next.add(id);
  }
  return next.size === selected.size ? selected : next;
}

function removeIds(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): ReadonlySet<string> {
  const next = new Set(selected);
  for (const id of ids) next.delete(id);
  return next.size === selected.size ? selected : next;
}

export function pickerReducer(
  state: PickerState,
  action: PickerAction,
): PickerState {
  switch (action.type) {
    case "setQuery":
      return action.query === state.query
        ? state
        : { ...state, query: action.query };
    case "toggleMethodFilter":
      return {
        ...state,
        methodFilters: withToggled(state.methodFilters, action.method),
      };
    case "clearMethodFilters":
      return state.methodFilters.size === 0
        ? state
        : { ...state, methodFilters: new Set() };
    case "toggleSelected":
      return toggleSelected(state, action.id);
    case "selectMany": {
      const selectedIds = addCapped(state.selectedIds, action.ids);
      return selectedIds === state.selectedIds
        ? state
        : { ...state, selectedIds };
    }
    case "deselect": {
      const selectedIds = removeIds(state.selectedIds, action.ids);
      return selectedIds === state.selectedIds
        ? state
        : { ...state, selectedIds };
    }
    case "clearSelection":
      return state.selectedIds.size === 0
        ? state
        : { ...state, selectedIds: new Set() };
    case "setExpanded":
      return { ...state, expanded: action.expanded };
    case "toggleExpanded":
      return { ...state, expanded: withToggled(state.expanded, action.id) };
    case "setActiveRowId":
      return action.id === state.activeRowId
        ? state
        : { ...state, activeRowId: action.id };
    case "patchDraft":
      return { ...state, draft: { ...state.draft, ...action.patch } };
    case "reset":
      return createInitialPickerState();
  }
}

function toggleSelected(state: PickerState, id: string): PickerState {
  if (state.selectedIds.has(id))
    return { ...state, selectedIds: removeIds(state.selectedIds, [id]) };
  const selectedIds = addCapped(state.selectedIds, [id]);
  return selectedIds === state.selectedIds ? state : { ...state, selectedIds };
}

type Listener = () => void;

export type PickerStore = {
  getState: () => PickerState;
  dispatch: (action: PickerAction) => void;
  subscribe: (listener: Listener) => () => void;
};

export function createPickerStore(): PickerStore {
  let state = createInitialPickerState();
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    dispatch: (action) => {
      const next = pickerReducer(state, action);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type PickerActions = {
  setQuery: (query: string) => void;
  toggleMethodFilter: (method: PickerMethodFilter) => void;
  clearMethodFilters: () => void;
  /** Returns `false` when the selection cap rejected the request. */
  toggleSelected: (id: string) => boolean;
  /** Returns `false` when the cap dropped at least one id. */
  selectMany: (ids: readonly string[]) => boolean;
  deselect: (ids: readonly string[]) => void;
  clearSelection: () => void;
  setExpanded: (expanded: ReadonlySet<string>) => void;
  toggleExpanded: (id: string) => void;
  setActiveRowId: (id: string | null) => void;
  patchDraft: (patch: Partial<NewRequestDraft>) => void;
  reset: () => void;
};

function createActions(store: PickerStore): PickerActions {
  const { dispatch, getState } = store;
  return {
    setQuery: (query) => dispatch({ type: "setQuery", query }),
    toggleMethodFilter: (method) =>
      dispatch({ type: "toggleMethodFilter", method }),
    clearMethodFilters: () => dispatch({ type: "clearMethodFilters" }),
    toggleSelected: (id) => {
      const before = getState().selectedIds;
      dispatch({ type: "toggleSelected", id });
      return before.has(id) || getState().selectedIds.has(id);
    },
    selectMany: (ids) => {
      dispatch({ type: "selectMany", ids });
      const selected = getState().selectedIds;
      return ids.every((id) => selected.has(id));
    },
    deselect: (ids) => dispatch({ type: "deselect", ids }),
    clearSelection: () => dispatch({ type: "clearSelection" }),
    setExpanded: (expanded) => dispatch({ type: "setExpanded", expanded }),
    toggleExpanded: (id) => dispatch({ type: "toggleExpanded", id }),
    setActiveRowId: (id) => dispatch({ type: "setActiveRowId", id }),
    patchDraft: (patch) => dispatch({ type: "patchDraft", patch }),
    reset: () => dispatch({ type: "reset" }),
  };
}

type PickerContextValue = { store: PickerStore; actions: PickerActions };

const PickerContext = createContext<PickerContextValue | null>(null);

function usePickerContext(): PickerContextValue {
  const value = useContext(PickerContext);
  if (!value)
    throw new Error("Picker hooks must be used inside <PickerProvider>");
  return value;
}

type PickerProviderProps = {
  children: ReactNode;
  /** When this flips to `false` all picker state resets (tab lives in `useUIStore`, so it is unaffected). */
  open?: boolean;
};

export function PickerProvider({ children, open = true }: PickerProviderProps) {
  const value = useMemo<PickerContextValue>(() => {
    const store = createPickerStore();
    return { store, actions: createActions(store) };
  }, []);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) value.actions.reset();
    wasOpen.current = open;
  }, [open, value]);
  return (
    <PickerContext.Provider value={value}>{children}</PickerContext.Provider>
  );
}

/** Subscribes to a slice; the selector must return a referentially stable value (state slices are). */
export function usePickerSelector<T>(selector: (state: PickerState) => T): T {
  const { store } = usePickerContext();
  const read = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, read, read);
}

export const usePickerActions = (): PickerActions => usePickerContext().actions;

/** For imperative reads inside event handlers (e.g. keyboard nav) without subscribing. */
export const usePickerStore = (): PickerStore => usePickerContext().store;

export const usePickerQuery = () => usePickerSelector((state) => state.query);
export const usePickerMethodFilters = () =>
  usePickerSelector((state) => state.methodFilters);
export const usePickerSelectedIds = () =>
  usePickerSelector((state) => state.selectedIds);
export const usePickerSelectionCount = () =>
  usePickerSelector((state) => state.selectedIds.size);
export const usePickerExpanded = () =>
  usePickerSelector((state) => state.expanded);
export const usePickerActiveRowId = () =>
  usePickerSelector((state) => state.activeRowId);
export const usePickerDraft = () => usePickerSelector((state) => state.draft);

/** Boolean slice per row so toggling one row re-renders only that row. */
export const useIsPickerRowSelected = (id: string) =>
  usePickerSelector((state) => state.selectedIds.has(id));
export const useIsPickerRowActive = (id: string) =>
  usePickerSelector((state) => state.activeRowId === id);
