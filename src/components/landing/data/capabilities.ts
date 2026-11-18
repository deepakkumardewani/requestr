import {
  CAPABILITY_CATEGORY_BY_TOOL,
  type CapabilityCategory,
} from "@/lib/relay/capabilities";

export interface LandingCapability {
  id: CapabilityCategory;
  title: string;
  description: string;
  /** Something a person would actually type into Relay for this area. */
  example: string;
}

/**
 * Titles and descriptions match the capabilities panel in the app. Keyed by
 * category so adding one to Relay without landing copy fails typecheck.
 */
const CAPABILITY_COPY: Record<
  CapabilityCategory,
  Omit<LandingCapability, "id">
> = {
  read: {
    title: "Read & explain",
    description: "Look through your workspace and explain what is there.",
    example: "Why is Get user cart returning 401?",
  },
  write: {
    title: "Create & edit",
    description:
      "Build and change requests, collections, chains and environments.",
    example: "Add a bearer token header to every request in Shop",
  },
  run: {
    title: "Run & test",
    description: "Send requests, run chains and check the results.",
    example: "Run List products and write assertions for it",
  },
  organize: {
    title: "Organize",
    description: "Rename, move and clean up what you have.",
    example: "Move the auth requests into a folder called Auth",
  },
  transfer: {
    title: "Import & export",
    description: "Bring requests in and take them out.",
    example: "Import this cURL command and save it to Shop",
  },
  settings: {
    title: "Settings",
    description:
      "Change theme, language, proxy, global variables and how Relay behaves.",
    example: "Switch to the light theme",
  },
  navigation: {
    title: "Navigate",
    description:
      "Open pages and sidebar tabs so you land where you need to be.",
    example: "Open the transform playground",
  },
  backup: {
    title: "Backup",
    description:
      "Save your workspace to a file or restore one. It always asks first.",
    example: "Back up my collections and environments",
  },
};

/** Display order, same as the app's capabilities panel then the smaller areas. */
const CAPABILITY_ORDER: readonly CapabilityCategory[] = [
  "read",
  "write",
  "run",
  "organize",
  "transfer",
  "settings",
  "navigation",
  "backup",
];

export const LANDING_CAPABILITIES: readonly LandingCapability[] =
  CAPABILITY_ORDER.map((id) => ({ id, ...CAPABILITY_COPY[id] }));

/** Number of Relay tools per area, read from the tool registry so it cannot drift. */
export function countToolsByCategory(): Record<CapabilityCategory, number> {
  const counts = Object.fromEntries(
    CAPABILITY_ORDER.map((id) => [id, 0]),
  ) as Record<CapabilityCategory, number>;
  for (const category of Object.values(CAPABILITY_CATEGORY_BY_TOOL)) {
    counts[category] += 1;
  }
  return counts;
}

export const TOTAL_TOOL_COUNT = Object.keys(CAPABILITY_CATEGORY_BY_TOOL).length;
