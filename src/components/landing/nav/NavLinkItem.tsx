"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { HOME_PATH, type NavLink } from "../data/links";
import { LINK_INTERACTIVE } from "../interactionStyles";

/** Shared by every link so the underline slides from one to the next. */
const UNDERLINE_LAYOUT_ID = "landing-nav-underline";
const UNDERLINE_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 40,
} as const;

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
}

/** The sections live on the homepage, so other pages link back to them there. */
export function sectionHref(
  sectionId: string,
  pathname: string | null,
): string {
  return pathname === HOME_PATH ? `#${sectionId}` : `${HOME_PATH}#${sectionId}`;
}

interface NavLinkItemProps {
  link: NavLink;
  isActive: boolean;
  /** Draws the sliding underline; the stacked mobile list marks active by colour only. */
  underline?: boolean;
  onNavigate?: () => void;
  className?: string;
}

export function NavLinkItem({
  link,
  isActive,
  underline = false,
  onNavigate,
  className,
}: NavLinkItemProps) {
  const pathname = usePathname();
  const onHomepage = pathname === HOME_PATH;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Off the homepage the browser follows the /#section link on its own.
    if (onHomepage) {
      event.preventDefault();
      scrollToSection(link.sectionId);
    }
    onNavigate?.();
  }

  return (
    <a
      href={sectionHref(link.sectionId, pathname)}
      aria-current={isActive ? "location" : undefined}
      className={cn(
        LINK_INTERACTIVE,
        "relative whitespace-nowrap px-1 py-1 text-sm font-medium",
        isActive ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      onClick={handleClick}
    >
      {link.label}
      {underline && isActive ? (
        <motion.span
          aria-hidden="true"
          layoutId={UNDERLINE_LAYOUT_ID}
          transition={UNDERLINE_SPRING}
          className="absolute inset-x-1 -bottom-0.5 h-0.5 rounded-full bg-[var(--landing-accent)]"
        />
      ) : null}
    </a>
  );
}
