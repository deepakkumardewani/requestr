"use client";

import Link from "next/link";
import { ClickSpark } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import { APP_PATH } from "./data/links";
import { CTA_INTERACTIVE } from "./interactionStyles";
import { type LandingCtaId, trackLandingCtaClick } from "./LandingAnalytics";

const SIZE_CLASSES = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
} as const;

const DEFAULT_LABEL = "Open the app";

interface PrimaryCtaProps {
  size?: keyof typeof SIZE_CLASSES;
  /** Feature pages point at their own tool; everywhere else opens the app. */
  href?: string;
  label?: string;
  /** Reported on click; only app-opening CTAs are tracked. */
  ctaId?: LandingCtaId;
}

/** The one primary action on the page: open the app, or the tool it is about. */
export function PrimaryCta({
  size = "md",
  href = APP_PATH,
  label = DEFAULT_LABEL,
  ctaId = "hero_open_app",
}: PrimaryCtaProps) {
  return (
    <ClickSpark className="inline-flex">
      <Link
        href={href}
        onClick={
          href === APP_PATH ? () => trackLandingCtaClick(ctaId) : undefined
        }
        className={cn(
          CTA_INTERACTIVE,
          SIZE_CLASSES[size],
          "group inline-flex items-center gap-2 rounded-md bg-primary font-semibold text-primary-foreground shadow-[0_0_32px_-8px_var(--landing-accent)] hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {label}
        <span
          aria-hidden="true"
          className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none"
        >
          →
        </span>
      </Link>
    </ClickSpark>
  );
}
