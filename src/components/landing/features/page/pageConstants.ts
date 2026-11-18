import { cn } from "@/lib/utils";
import { CTA_INTERACTIVE } from "../../interactionStyles";

/**
 * Section ids on a feature page. Prefixed so they never match the homepage
 * ids LandingNav highlights, which would light up a nav link on the wrong page.
 */
export const FEATURE_SECTION_IDS = {
  demo: "feature-demo",
  how: "feature-how",
  capabilities: "feature-capabilities",
  relay: "feature-relay",
  related: "feature-related",
  closing: "feature-cta",
} as const;

/** The related section keeps the heading id the page has always used. */
export const RELATED_HEADING_ID = "related-heading";

export function titleId(sectionId: string): string {
  return `${sectionId}-title`;
}

/** The outlined action beside PrimaryCta, as on the landing's closing band. */
export const SECONDARY_CTA_CLASS = cn(
  CTA_INTERACTIVE,
  "inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-6 py-3 text-base font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

/** The soft light behind a demo or screenshot, tinted per feature. */
export const MEDIA_HALO =
  "pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--halo-color)_16%,transparent),transparent)] blur-2xl";
