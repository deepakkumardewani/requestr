export const GITHUB_URL = "https://github.com/deepakkumardewani/requestly";
export const DOCS_URL = `${GITHUB_URL}#readme`;
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;

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
