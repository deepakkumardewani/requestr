import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab, TabState } from "@/types";
import type { ToolImpl, ToolOutcome } from "./registry";
import { registerConfirmGate } from "./schemas";

/**
 * Tab tools move the user's view and may drop unsaved work, so a dirty target
 * always waits for the user: Save all & close, Discard & close, or Cancel
 * (FR-130, FR-131). A clean tab closes without asking.
 */

/** The two answers that let a close go ahead; Cancel is a declined card. */
export const CLOSE_DECISIONS = ["save-all", "discard"] as const;
export type CloseDecision = (typeof CLOSE_DECISIONS)[number];

export const CLOSE_TABS_TOOLS = ["close_tab", "close_all_tabs"] as const;
export type CloseTabsToolName = (typeof CLOSE_TABS_TOOLS)[number];

const DECISION_REQUIRED =
  "the user must choose what to do with unsaved changes first";

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const isDecision = (value: string | undefined): value is CloseDecision =>
  CLOSE_DECISIONS.some((decision) => decision === value);

export function isCloseTabsTool(name: string): name is CloseTabsToolName {
  return CLOSE_TABS_TOOLS.some((tool) => tool === name);
}

type CloseInput = { tabId?: string; includePinned?: boolean | null };

/** Tabs a call would close, and the pinned ones it would leave open. */
function resolveTargets(
  name: CloseTabsToolName,
  input: CloseInput,
): { targets: TabState[]; pinnedKept: number } {
  const { tabs } = useTabsStore.getState();
  if (name === "close_tab") {
    return {
      targets: tabs.filter((tab) => tab.tabId === input.tabId),
      pinnedKept: 0,
    };
  }
  const pinned = new Set(useSettingsStore.getState().pinnedRequestIds);
  const isPinned = (tab: TabState) =>
    tab.requestId !== null && pinned.has(tab.requestId);
  if (input.includePinned === true) return { targets: tabs, pinnedKept: 0 };
  return {
    targets: tabs.filter((tab) => !isPinned(tab)),
    pinnedKept: tabs.filter(isPinned).length,
  };
}

/** Only a saved HTTP request can be saved without asking where to put it. */
function savedRequestId(tab: TabState): string | null {
  if (tab.type !== "http" || !tab.requestId) return null;
  const exists = useCollectionsStore
    .getState()
    .requests.some((request) => request.id === tab.requestId);
  return exists ? tab.requestId : null;
}

export type DirtyTab = { tabId: string; name: string; hasDestination: boolean };

export type CloseTabsPreview = {
  /** Dirty tabs the call would close; `hasDestination` is false when Save cannot place them. */
  dirty: DirtyTab[];
  pinnedKept: number;
  /** True when the tabs close because Relay is deleting their requests (FR-133). */
  deleting?: boolean;
};

const toDirtyTab = (tab: TabState): DirtyTab => ({
  tabId: tab.tabId,
  name: tab.name,
  hasDestination: savedRequestId(tab) !== null,
});

/** What the dirty-close card shows, read from live tabs and never from model text. */
export function previewCloseTabs(
  name: CloseTabsToolName,
  input: CloseInput,
): CloseTabsPreview {
  const { targets, pinnedKept } = resolveTargets(name, input);
  return {
    dirty: targets.filter((tab) => tab.isDirty).map(toDirtyTab),
    pinnedKept,
  };
}

function dirtyTabsForRequests(requestIds: readonly string[]): TabState[] {
  const ids = new Set(requestIds);
  return useTabsStore
    .getState()
    .tabs.filter(
      (tab) => tab.isDirty && tab.requestId !== null && ids.has(tab.requestId),
    );
}

/** Open tabs with unsaved edits among the given requests (FR-133). */
export function dirtyTabsAmongRequests(
  requestIds: readonly string[],
): DirtyTab[] {
  return dirtyTabsForRequests(requestIds).map(toDirtyTab);
}

/** Writes the tab's edits into its saved request, as the editor's Save does. */
function saveTab(tab: HttpTab, requestId: string): void {
  useCollectionsStore.getState().updateRequest(requestId, {
    name: tab.name,
    method: tab.method,
    url: tab.url,
    params: tab.params,
    headers: tab.headers,
    auth: tab.auth,
    body: tab.body,
    preScript: tab.preScript,
    postScript: tab.postScript,
    timeoutMs: tab.timeoutMs,
  });
  useTabsStore.getState().updateTabState(tab.tabId, { isDirty: false });
}

/** Saves what can be saved in place; the rest stay unsaved and are returned. */
function saveDirtyTabs(tabs: readonly TabState[]): {
  saved: number;
  unsaved: string[];
} {
  const unsaved: string[] = [];
  let saved = 0;
  for (const tab of tabs.filter((item) => item.isDirty)) {
    const requestId = savedRequestId(tab);
    if (requestId === null || tab.type !== "http") {
      unsaved.push(tab.tabId);
      continue;
    }
    saveTab(tab, requestId);
    saved += 1;
  }
  return { saved, unsaved };
}

/**
 * FR-133: before a delete drops open tabs, the FR-131 decision applies. Returns
 * a failure when the user has not decided yet; on Save all the edits land in
 * the requests first, so the delete (and its Undo) sees them.
 */
export function settleDirtyTabsForDelete(
  requestIds: readonly string[],
  selection: string | undefined,
): ToolOutcome | null {
  const dirty = dirtyTabsForRequests(requestIds);
  if (dirty.length === 0) return null;
  if (!isDecision(selection)) return fail(DECISION_REQUIRED);
  if (selection === "save-all") saveDirtyTabs(dirty);
  return null;
}

function closeAll(targets: readonly TabState[]): void {
  const store = useTabsStore.getState();
  if (targets.length === store.tabs.length) {
    store.closeAllTabs();
    return;
  }
  for (const tab of targets) store.closeTab(tab.tabId);
}

function closeTabs(
  name: CloseTabsToolName,
  input: CloseInput,
  selection: string | undefined,
): ToolOutcome {
  const { targets, pinnedKept } = resolveTargets(name, input);
  if (name === "close_tab" && targets.length === 0) {
    return fail(`tab not found: ${input.tabId}`);
  }
  const hasDirty = targets.some((tab) => tab.isDirty);
  if (hasDirty && !isDecision(selection)) return fail(DECISION_REQUIRED);

  const { saved, unsaved: stayOpen } =
    hasDirty && selection === "save-all"
      ? saveDirtyTabs(targets)
      : { saved: 0, unsaved: [] };
  const closing = targets.filter((tab) => !stayOpen.includes(tab.tabId));
  closeAll(closing);
  return {
    ok: true,
    data: {
      closed: closing.length,
      saved,
      pinnedKept,
      needsDestination: stayOpen,
    },
  };
}

const closeTab: ToolImpl<"close_tab"> = {
  name: "close_tab",
  run: ({ tabId }, { selection }) =>
    closeTabs("close_tab", { tabId }, selection),
};

const closeAllTabs: ToolImpl<"close_all_tabs"> = {
  name: "close_all_tabs",
  run: ({ includePinned }, { selection }) =>
    closeTabs("close_all_tabs", { includePinned }, selection),
};

for (const name of CLOSE_TABS_TOOLS) {
  registerConfirmGate(
    name,
    (input) => previewCloseTabs(name, input as CloseInput).dirty.length > 0,
  );
}

export const tabTools = [closeTab, closeAllTabs] as const;
