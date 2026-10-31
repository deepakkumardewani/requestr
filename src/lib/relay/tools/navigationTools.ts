import {
  ENVIRONMENTS_ROUTE,
  routeForTarget,
  WORKSPACE_HOME_ROUTE,
} from "../openEntity";
import type { ToolImpl, ToolOutcome } from "./registry";
import type { RelayToolInput } from "./schemas";

/**
 * Navigation tools (TOOL-02) move the user around the app. They change no data,
 * so they are not logged and no permission mode gates them.
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

type OpenPage = RelayToolInput<"open_page">["page"];

const PAGE_ROUTES: Record<Exclude<OpenPage, "settings">, string> = {
  app: WORKSPACE_HOME_ROUTE,
  import: "/import",
  environments: ENVIRONMENTS_ROUTE,
  "json-compare": "/json-compare",
  "json-visualize": "/json-visualize",
  transform: "/transform",
};

const SECTION_ONLY_FOR_SETTINGS =
  "section only applies to the settings page; set it to null";

function pageRoute({ page, section }: RelayToolInput<"open_page">): string {
  if (page !== "settings") return PAGE_ROUTES[page];
  return routeForTarget({ kind: "settings", id: section ?? "" }) ?? "";
}

const openPage: ToolImpl<"open_page"> = {
  name: "open_page",
  run: (input, { navigate }) => {
    if (input.page !== "settings" && input.section !== null) {
      return fail(SECTION_ONLY_FOR_SETTINGS);
    }
    const href = pageRoute(input);
    navigate?.(href);
    return { ok: true, data: { href, summary: `Opened ${input.page}` } };
  },
};

const SIDEBAR_TAB_ORDER = ["collections", "history", "hub"] as const;
/** Every sidebar tab trigger shares the tab list of this one, which has a stable test id. */
const SIDEBAR_ANCHOR_SELECTOR = '[data-testid="sidebar-tab-collections"]';
const SIDEBAR_UNAVAILABLE =
  "the left panel is not on screen; open the workspace home first";

/** The left panel keeps its tab in local state, so the tool presses the tab like the user would. */
function pressSidebarTab(tab: (typeof SIDEBAR_TAB_ORDER)[number]): boolean {
  const list = document
    .querySelector(SIDEBAR_ANCHOR_SELECTOR)
    ?.closest('[role="tablist"]');
  const trigger =
    list?.querySelectorAll<HTMLElement>('[role="tab"]')[
      SIDEBAR_TAB_ORDER.indexOf(tab)
    ];
  trigger?.click();
  return trigger !== undefined;
}

const showSidebarTab: ToolImpl<"show_sidebar_tab"> = {
  name: "show_sidebar_tab",
  run: ({ tab }) =>
    pressSidebarTab(tab)
      ? { ok: true, data: { tab, summary: `Showed the ${tab} tab` } }
      : fail(SIDEBAR_UNAVAILABLE),
};

export const navigationTools = [openPage, showSidebarTab] as const;
