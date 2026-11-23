"use client";

import { MenuIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GITHUB_URL, SECTION_CONTAINER } from "../constants";
import {
  APP_PATH,
  HOME_PATH,
  NAV_LINKS,
  navLinkForSection,
  SECTION_ORDER,
} from "../data/links";
import { useActiveSection } from "../hooks/useActiveSection";
import { CTA_INTERACTIVE, LINK_INTERACTIVE } from "../interactionStyles";
import { trackLandingCtaClick } from "../LandingAnalytics";
import { GitHubIcon } from "./GitHubIcon";
import { MOBILE_MENU_ID, MobileMenu } from "./MobileMenu";
import { NavLinkItem } from "./NavLinkItem";

const LOGO_SIZE_PX = 28;
/** Past this scroll offset the bar gets its solid ground and hairline. */
const CONDENSE_AFTER_PX = 48;
const ICON_BUTTON_CLASS = cn(
  LINK_INTERACTIVE,
  "p-1.5 text-muted-foreground hover:scale-110 active:scale-95",
);

/** Tracks the scroll offset: a flag for the bar and a 0-1 ratio written straight to the progress line. */
function useScrollChrome() {
  const [condensed, setCondensed] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const update = () => {
      setCondensed(window.scrollY > CONDENSE_AFTER_PX);
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      // Written to the node directly so scrolling never re-renders the nav.
      progressRef.current?.style.setProperty("transform", `scaleX(${ratio})`);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return { condensed, progressRef };
}

/** Escape closes the menu and returns focus to its toggle. */
function useEscapeToClose(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);
}

function Brand() {
  return (
    <Link
      href={HOME_PATH}
      className="flex min-w-0 items-center gap-2 rounded font-display text-base font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-lg"
    >
      <Image
        src="/logo.png"
        alt="Requestr logo"
        width={LOGO_SIZE_PX}
        height={LOGO_SIZE_PX}
        priority
        className="object-contain"
      />
      Requestr
    </Link>
  );
}

function GitHubLink() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(ICON_BUTTON_CLASS, "hidden sm:inline-flex")}
    >
      <span className="sr-only">Requestr on GitHub</span>
      <GitHubIcon />
    </a>
  );
}

function OpenAppLink() {
  return (
    <Link
      href={APP_PATH}
      onClick={() => trackLandingCtaClick("nav_open_app")}
      className={cn(
        CTA_INTERACTIVE,
        "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:py-2 sm:text-sm",
      )}
    >
      Open the app
    </Link>
  );
}

export function LandingNav() {
  const { condensed, progressRef } = useScrollChrome();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const activeLink = navLinkForSection(useActiveSection(SECTION_ORDER));

  const closeMenu = () => setMenuOpen(false);
  useEscapeToClose(menuOpen, () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  });

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-200",
        condensed || menuOpen
          ? "border-b border-border/50 bg-background/80 py-2 backdrop-blur-md"
          : "border-b border-transparent bg-transparent py-4",
      )}
    >
      <nav
        aria-label="Main navigation"
        className={cn(
          "relative flex items-center justify-between",
          SECTION_CONTAINER,
        )}
      >
        <Brand />

        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.sectionId}>
              <NavLinkItem
                link={link}
                isActive={link === activeLink}
                underline
              />
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <GitHubLink />
          <OpenAppLink />
          <button
            ref={menuButtonRef}
            type="button"
            aria-controls={MOBILE_MENU_ID}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className={cn(ICON_BUTTON_CLASS, "ml-1 lg:hidden")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <XIcon aria-hidden="true" className="size-5" />
            ) : (
              <MenuIcon aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <MobileMenu activeLink={activeLink} onNavigate={closeMenu} />
      ) : null}

      <span
        ref={progressRef}
        aria-hidden="true"
        // Starts empty; useScrollChrome owns the transform from here on.
        style={{ transform: "scaleX(0)" }}
        className="absolute inset-x-0 -bottom-px h-px origin-left bg-[var(--landing-accent)]"
      />
    </header>
  );
}
