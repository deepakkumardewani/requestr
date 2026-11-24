import { isRelayEnabled } from "@/lib/relay/flag";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";

/**
 * Whether each tour anchor can appear in the current UI state, so the anchor wait
 * never blocks on an element the user would have to change the UI to reveal.
 * Unknown states (not hydrated, sidebar not rendered yet) count as applicable:
 * the bounded wait covers them instead of dropping a step too early.
 */

export const TOUR_ROUTE = "/app";

type SidebarTab = "collections" | "history";

/** Protocols whose editor has no HTTP response panel (mirrors RightPanel). */
const STREAMING_TAB_TYPES: readonly string[] = ["websocket", "socketio"];

export function isOnTourRoute(): boolean {
  return window.location.pathname === TOUR_ROUTE;
}

/** The URL bar, request tabs, response and save anchors only exist with a request tab open. */
export function hasActiveRequestTab(): boolean {
  const { hydrated, activeTabId } = useTabsStore.getState();
  return !hydrated || activeTabId !== null;
}

export function hasResponsePanel(): boolean {
  if (!hasActiveRequestTab()) return false;
  const { tabs, activeTabId } = useTabsStore.getState();
  const active = tabs.find((tab) => tab.tabId === activeTabId);
  return !active || !STREAMING_TAB_TYPES.includes(active.type);
}

/**
 * The sidebar tab state is local to LeftPanel, so it is read from the DOM. Base UI
 * only sets `aria-controls` while the tab's panel is mounted, which also rules out
 * the search-results view that replaces the panels.
 */
function isSidebarPanelShown(tab: SidebarTab): boolean {
  const trigger = document.querySelector(`[data-testid="sidebar-tab-${tab}"]`);
  if (!trigger) return true;
  if (trigger.getAttribute("aria-selected") !== "true") return false;
  const panelId = trigger.getAttribute("aria-controls");
  return panelId !== null && document.getElementById(panelId) !== null;
}

export function isCollectionsSidebarShown(): boolean {
  return isSidebarPanelShown("collections");
}

/** Sample cards render inside the History panel only while there is no history. */
export function areSampleRequestsShown(): boolean {
  return (
    isSidebarPanelShown("history") &&
    useHistoryStore.getState().entries.length === 0
  );
}

/** Same gate as `useRelayAvailable`, read outside React. */
export function isRelayAvailable(): boolean {
  return isRelayEnabled() && useRelayStore.getState().enabled;
}
