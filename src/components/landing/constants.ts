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
