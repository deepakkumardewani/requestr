export const GITHUB_URL = "https://github.com/deepakkumardewani/requestly";
export const DOCS_URL = `${GITHUB_URL}#readme`;
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;
export const PRIVACY_PATH = "/privacy";
export const TERMS_PATH = "/terms";

// ── Shared section layout ────────────────────────────────────────────────
// Single source of truth for section width/gutters and vertical rhythm so
// every landing page section stays visually aligned. Apply SECTION_CONTAINER
// to the inner wrapper div and SECTION_PADDING to the <section> element.
export const SECTION_CONTAINER = "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8";
export const SECTION_PADDING = "py-16 sm:py-24";
// Sections alternate plain/tinted grounds with a hairline so adjacent
// sections read as distinct bands on a dark page.
export const SECTION_DIVIDER = "border-t border-border/60";
export const SECTION_SURFACE_ALT = "bg-muted/30";

// ── Shared heading pattern (eyebrow + H2 + lede) ─────────────────────────
export const SECTION_EYEBROW =
  "mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground/60";
export const SECTION_HEADING =
  "text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl";
export const SECTION_LEDE = "mt-3 text-muted-foreground leading-relaxed";

// ── Hero copy ────────────────────────────────────────────────────────────
export const HERO_HEADLINE_LEAD = "AI that does";
export const HERO_HEADLINE_TAIL = "your API work.";
export const HERO_SUBLINE =
  "Relay is built into the app and can do whatever you can do by hand: build requests, chain them and write the tests. Nothing to install, no account to make.";

// ── Relay section copy and media ─────────────────────────────────────────
export const RELAY_EYEBROW = "Relay";
export const RELAY_HEADLINE = "An AI built into the app. It does what you do.";
export const RELAY_LEDE =
  "Ask in plain words and Relay works inside your collections, the same way you would: it edits requests, runs them and checks the results. You review each change before it lands.";
export const RELAY_LOOP_SRC = "/media/relay/relay-loop";
export const RELAY_FULL_SRC = "/media/relay/relay-full";
export const RELAY_POSTER_SRC = "/media/relay/relay-poster.webp";
export const RELAY_MEDIA_WIDTH = 1280;
export const RELAY_MEDIA_HEIGHT = 800;

// ── Command palette section copy and media ───────────────────────────────
export const COMMAND_PALETTE_EYEBROW = "Command palette";
export const COMMAND_PALETTE_HEADLINE = "Do anything from one keystroke.";
export const COMMAND_PALETTE_LEDE =
  "Press one shortcut and type. Any request, collection, environment or action is a few letters away, so you can move around the app without reaching for the mouse.";
export const COMMAND_PALETTE_LIGHT_SRC = "/screens/command-palette-light.webp";
export const COMMAND_PALETTE_DARK_SRC = "/screens/command-palette-dark.webp";
export const COMMAND_PALETTE_ALT =
  "Command palette open over the app, with a search box and a list of matching requests, collections and actions";
export const COMMAND_PALETTE_WIDTH = 1440;
export const COMMAND_PALETTE_HEIGHT = 900;

// ── Import and backup section copy and media ─────────────────────────────
export const IMPORT_EYEBROW = "Import and backup";
export const IMPORT_HEADLINE = "Bring what you have. Keep what you build.";
export const IMPORT_GROUP_HEADING = "Import";
export const IMPORT_GROUP_LEDE =
  "Paste a cURL command or drop a Postman, Insomnia, OpenAPI or Swagger file. Scan lists what it found, and each item opens as a request ready to send.";
export const IMPORT_FORMAT_CHIPS = [
  "cURL",
  "Postman v2.1",
  "Insomnia",
  "OpenAPI 3",
  "Swagger 2",
] as const;
export const IMPORT_LIGHT_SRC = "/screens/import-light.webp";
export const IMPORT_DARK_SRC = "/screens/import-dark.webp";
export const IMPORT_ALT =
  "Import API Resources page on the cURL Import tab with a pasted cURL command, an Import Command button, and a Restore a Requestr backup row";
export const IMPORT_WIDTH = 1440;
export const IMPORT_HEIGHT = 900;

export const BACKUP_GROUP_HEADING = "Backup";
export const BACKUP_GROUP_LEDE =
  "Export everything to one file, then restore it on any machine. Your data stays in your browser until you choose to move it.";
// Backup dialog screenshots (light/dark/alt) are added per item in phase 10 (T10.10).
export const BACKUP_ITEMS = [
  {
    id: "export",
    title: "Export",
    description:
      "Pick the collections, environments and history you want, then save them as one file.",
  },
  {
    id: "restore",
    title: "Restore",
    description:
      "Choose a backup file, review what it contains, then restore it into the app.",
  },
] as const;
