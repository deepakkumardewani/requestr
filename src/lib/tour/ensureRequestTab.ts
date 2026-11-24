import { useTabsStore } from "@/stores/useTabsStore";

function hasNoTabs(): boolean {
  const { tabs, activeTabId } = useTabsStore.getState();
  return tabs.length === 0 && activeTabId === null;
}

/** Resolves true once persisted tabs have loaded; false on abort or timeout. */
function waitForTabsHydrated(
  signal: AbortSignal,
  timeoutMs: number,
): Promise<boolean> {
  if (useTabsStore.getState().hydrated) return Promise.resolve(true);
  return new Promise((resolve) => {
    const settle = () => {
      const hydrated = useTabsStore.getState().hydrated;
      if (!hydrated && !signal.aborted) return;
      finish(hydrated && !signal.aborted);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const unsubscribe = useTabsStore.subscribe(settle);
    signal.addEventListener("abort", settle, { once: true });
    function finish(result: boolean) {
      clearTimeout(timer);
      unsubscribe();
      signal.removeEventListener("abort", settle);
      resolve(result);
    }
  });
}

/**
 * The URL bar, request tabs, response and save steps only exist with a request
 * open, so an empty workspace gets one blank tab (the same action as "New
 * Request"). It waits for hydration first so a persisted session is never
 * mistaken for an empty one, and it never touches existing tabs.
 */
export async function ensureRequestTab(
  signal: AbortSignal,
  timeoutMs: number,
): Promise<void> {
  if (!(await waitForTabsHydrated(signal, timeoutMs))) return;
  if (hasNoTabs()) useTabsStore.getState().openTab();
}
