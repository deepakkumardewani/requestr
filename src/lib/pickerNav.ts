import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import { PICKER_MAX_DEPTH, type PickerRow } from "@/lib/pickerTree";

export const PICKER_PAGE_SIZE = 8;

export type PickerNavKeyName =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"
  | "Enter"
  | " "
  | "a";

/** Subset of `KeyboardEvent`; `ctrlKey` is treated like `metaKey` so Ctrl+A works off macOS. */
export type PickerNavKey = {
  key: PickerNavKeyName;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
};

export type PickerNavState = {
  /** Visible flattened rows (headers and requests), in display order. */
  rows: ReadonlyArray<PickerRow<unknown>>;
  activeId: string | null;
  /** Raw collection/folder ids (not `collection:`-prefixed row ids), same contract as `flattenPickerTree`. */
  expanded: ReadonlySet<string>;
  selectedIds: ReadonlySet<string>;
  /**
   * Request ids already on the canvas. They stay focusable (so "Show on canvas" is reachable and the
   * "already in chain" hint can be announced) but are never selectable, rangeable or added.
   */
  inChainIds: ReadonlySet<string>;
  /** Fixed end of a Shift-range; `null` until a Shift move starts one. */
  anchorId: string | null;
};

/** Side effects the caller performs; the reducer itself stays pure. */
export type PickerNavEffect =
  | { type: "add"; ids: string[] }
  | { type: "in-chain"; id: string }
  | { type: "cap-reached" };

export type PickerNavResult = {
  state: PickerNavState;
  effect: PickerNavEffect | null;
};

const rawEntityId = (rowId: string) => rowId.slice(rowId.indexOf(":") + 1);

const isSelectable = (
  row: PickerRow<unknown>,
  inChainIds: ReadonlySet<string>,
) => row.kind === "item" && !inChainIds.has(row.id);

function done(
  state: PickerNavState,
  patch: Partial<PickerNavState>,
  effect: PickerNavEffect | null = null,
) {
  return { state: { ...state, ...patch }, effect };
}

/** Adds ids in order until the cap; `capped` reports whether any were dropped. */
function addWithinCap(current: ReadonlySet<string>, ids: string[]) {
  const next = new Set(current);
  let capped = false;
  for (const id of ids) {
    if (next.has(id)) continue;
    if (next.size >= PICKER_SELECTION_CAP) {
      capped = true;
      break;
    }
    next.add(id);
  }
  return { next, capped };
}

function targetIndex(
  state: PickerNavState,
  current: number,
  key: PickerNavKeyName,
): number {
  const last = state.rows.length - 1;
  switch (key) {
    case "ArrowUp":
      return current < 0 ? last : Math.max(current - 1, 0);
    case "ArrowDown":
      return Math.min(current + 1, last);
    case "PageUp":
      return current < 0 ? last : Math.max(current - PICKER_PAGE_SIZE, 0);
    case "PageDown":
      return Math.min(current + PICKER_PAGE_SIZE, last);
    case "Home":
      return 0;
    default:
      return last;
  }
}

function moveActive(
  state: PickerNavState,
  event: PickerNavKey,
): PickerNavResult {
  const current = state.rows.findIndex((row) => row.id === state.activeId);
  const index = targetIndex(state, current, event.key);
  const target = state.rows[index];
  const isVertical = event.key === "ArrowUp" || event.key === "ArrowDown";
  if (!event.shiftKey || !isVertical)
    return done(state, { activeId: target.id, anchorId: null });
  return extendRange(state, index);
}

function extendRange(
  state: PickerNavState,
  targetIdx: number,
): PickerNavResult {
  const target = state.rows[targetIdx];
  const anchorIndex = state.rows.findIndex(
    (row) => row.id === (state.anchorId ?? state.activeId),
  );
  const anchor = anchorIndex < 0 ? targetIdx : anchorIndex;
  const [from, to] =
    anchor <= targetIdx ? [anchor, targetIdx] : [targetIdx, anchor];
  const ids = state.rows
    .slice(from, to + 1)
    .filter((row) => isSelectable(row, state.inChainIds))
    .map((row) => row.id);
  const { next, capped } = addWithinCap(state.selectedIds, ids);
  const anchorId = state.rows[anchor].id;
  return done(
    state,
    { activeId: target.id, anchorId, selectedIds: next },
    capped ? { type: "cap-reached" } : null,
  );
}

function toggleExpanded(
  state: PickerNavState,
  row: PickerRow<unknown>,
  expand: boolean,
): PickerNavState {
  const expanded = new Set(state.expanded);
  const id = rawEntityId(row.id);
  if (expand) expanded.add(id);
  else expanded.delete(id);
  return { ...state, expanded, anchorId: null };
}

/** Nearest preceding header that owns `row`; depth is clamped at PICKER_MAX_DEPTH so equality counts there. */
function findParentHeader(rows: PickerNavState["rows"], index: number) {
  const { depth } = rows[index];
  for (let i = index - 1; i >= 0; i--) {
    const candidate = rows[i];
    if (candidate.kind !== "header") continue;
    if (
      candidate.depth < depth ||
      (depth >= PICKER_MAX_DEPTH && candidate.depth <= depth)
    )
      return candidate;
  }
  return null;
}

function handleLeft(state: PickerNavState, index: number): PickerNavResult {
  const row = state.rows[index];
  if (row.kind === "header" && row.expandable && row.expanded) {
    return done(toggleExpanded(state, row, false), {});
  }
  const parent = findParentHeader(state.rows, index);
  return parent
    ? done(state, { activeId: parent.id, anchorId: null })
    : done(state, {});
}

function handleRight(state: PickerNavState, index: number): PickerNavResult {
  const row = state.rows[index];
  if (row.kind !== "header" || !row.expandable) return done(state, {});
  if (!row.expanded) return done(toggleExpanded(state, row, true), {});
  const child = state.rows[index + 1];
  return child
    ? done(state, { activeId: child.id, anchorId: null })
    : done(state, {});
}

function toggleSelection(state: PickerNavState, id: string): PickerNavResult {
  if (state.selectedIds.has(id)) {
    const next = new Set(state.selectedIds);
    next.delete(id);
    return done(state, { selectedIds: next, anchorId: null });
  }
  const { next, capped } = addWithinCap(state.selectedIds, [id]);
  return done(
    state,
    { selectedIds: next, anchorId: null },
    capped ? { type: "cap-reached" } : null,
  );
}

function activateRow(
  state: PickerNavState,
  row: PickerRow<unknown>,
  isEnter: boolean,
): PickerNavResult {
  if (row.kind === "header") {
    return row.expandable
      ? done(toggleExpanded(state, row, !row.expanded), {})
      : done(state, {});
  }
  if (state.inChainIds.has(row.id))
    return done(state, {}, { type: "in-chain", id: row.id });
  if (isEnter && state.selectedIds.size === 0)
    return done(state, {}, { type: "add", ids: [row.id] });
  return toggleSelection(state, row.id);
}

function selectAllVisible(state: PickerNavState): PickerNavResult {
  const ids = state.rows
    .filter((row) => isSelectable(row, state.inChainIds))
    .map((row) => row.id);
  const { next, capped } = addWithinCap(state.selectedIds, ids);
  return done(
    state,
    { selectedIds: next, anchorId: null },
    capped ? { type: "cap-reached" } : null,
  );
}

const MOVE_KEYS: ReadonlySet<PickerNavKeyName> = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

/**
 * Pure keyboard reducer for the picker tree. Returns the next state plus an optional effect for the
 * caller (add request(s), announce, cap hint). Unhandled keys return the same state reference.
 * Shift+Arrow adds the anchor..active range (visible requests only) to the selection; it never shrinks it.
 */
export function pickerNavReducer(
  state: PickerNavState,
  event: PickerNavKey,
): PickerNavResult {
  const unchanged: PickerNavResult = { state, effect: null };
  if (state.rows.length === 0) return unchanged;
  if (event.key === "a") {
    return event.metaKey || event.ctrlKey ? selectAllVisible(state) : unchanged;
  }
  if (MOVE_KEYS.has(event.key)) return moveActive(state, event);
  const index = state.rows.findIndex((row) => row.id === state.activeId);
  if (index < 0) return unchanged;
  if (event.key === "ArrowLeft") return handleLeft(state, index);
  if (event.key === "ArrowRight") return handleRight(state, index);
  return activateRow(state, state.rows[index], event.key === "Enter");
}
