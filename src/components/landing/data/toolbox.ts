import { FEATURE_PAGES } from "../data/seoPages";

export interface ToolEntry {
  slug: string;
  route: string;
  name: string;
  description: string;
  /** Dark capture: the landing page is always dark. */
  screenshot: { src: string; alt: string };
}

/** Features with a section of their own higher up the page. */
const FEATURED_ELSEWHERE: ReadonlySet<string> = new Set([
  "relay",
  "command-palette",
  "import",
  "backup-restore",
]);
const LIGHT_SUFFIX = "-light.webp";
const DARK_SUFFIX = "-dark.webp";

/** Every app capture is saved as a `-light` / `-dark` pair in public/screens. */
export function toDarkScreenshot(src: string): string {
  return src.endsWith(LIGHT_SUFFIX)
    ? `${src.slice(0, -LIGHT_SUFFIX.length)}${DARK_SUFFIX}`
    : src;
}

export const TOOL_ENTRIES: readonly ToolEntry[] = FEATURE_PAGES.filter(
  (page) => !FEATURED_ELSEWHERE.has(page.slug),
).map((page) => ({
  slug: page.slug,
  route: page.route,
  name: page.h1,
  description: page.description,
  screenshot: {
    src: toDarkScreenshot(page.screenshot.src),
    alt: page.screenshot.alt,
  },
}));
