/** Internal routes and in-page anchors the landing page points at. */
export const APP_PATH = "/app";
export const FEATURES_HUB_PATH = "/features";
export const HOME_PATH = "/";
export const COMMAND_PALETTE_FEATURE_PATH = "/features/command-palette";

export const SECTION_IDS = {
  hero: "hero",
  basics: "basics",
  /** Set by the shared RelaySection. */
  demo: "relay",
  capabilities: "capabilities",
  /** The 401 to 200 band between the capabilities and the approvals. */
  authFlip: "auth-flip",
  control: "control",
  commandPalette: "command-palette",
  importBackup: "import",
  toolbox: "toolbox",
  /** Set by the shared ComparisonTable. */
  compare: "compare",
  finalCta: "get-started",
} as const;

export interface NavLink {
  label: string;
  /** Section the link scrolls to. */
  sectionId: string;
  /** Every section that keeps this link marked active while it is on screen. */
  covers: readonly string[];
}

export const NAV_LINKS: readonly NavLink[] = [
  {
    label: "Demo",
    sectionId: SECTION_IDS.demo,
    covers: [SECTION_IDS.demo],
  },
  {
    label: "What it does",
    sectionId: SECTION_IDS.capabilities,
    // The band walks through one of the capabilities, so it stays under this link.
    covers: [SECTION_IDS.capabilities, SECTION_IDS.authFlip],
  },
  {
    label: "Approvals",
    sectionId: SECTION_IDS.control,
    covers: [SECTION_IDS.control],
  },
  {
    label: "The client",
    sectionId: SECTION_IDS.commandPalette,
    covers: [
      SECTION_IDS.commandPalette,
      SECTION_IDS.importBackup,
      SECTION_IDS.toolbox,
    ],
  },
  {
    label: "Compare",
    sectionId: SECTION_IDS.compare,
    covers: [SECTION_IDS.compare],
  },
];

/** Page order, top to bottom: the scroll spy walks this list. */
export const SECTION_ORDER: readonly string[] = [
  SECTION_IDS.hero,
  SECTION_IDS.basics,
  SECTION_IDS.demo,
  SECTION_IDS.capabilities,
  SECTION_IDS.authFlip,
  SECTION_IDS.control,
  SECTION_IDS.commandPalette,
  SECTION_IDS.importBackup,
  SECTION_IDS.toolbox,
  SECTION_IDS.compare,
  SECTION_IDS.finalCta,
];

/** The nav link to mark active for a section, or null above the first one. */
export function navLinkForSection(sectionId: string | null): NavLink | null {
  if (!sectionId) return null;
  return NAV_LINKS.find((link) => link.covers.includes(sectionId)) ?? null;
}
