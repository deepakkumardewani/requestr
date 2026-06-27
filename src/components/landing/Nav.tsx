"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CTA_INTERACTIVE, LINK_INTERACTIVE } from "./interactionStyles";

const SECTION_IDS = ["hero", "features", "compare"] as const;

const NAV_LINKS = [
  { label: "Home", sectionId: "hero" as const },
  { label: "Features", sectionId: "features" as const },
  { label: "Compare", sectionId: "compare" as const },
] as const;

const GITHUB_URL = "https://github.com/deepakkumardewani/requestly";

function sectionHash(sectionId: string) {
  return `#${sectionId}`;
}

function navHref(pathname: string, sectionId: string) {
  const hash = sectionHash(sectionId);
  return pathname === "/" ? hash : `/${hash}`;
}

function scrollToSection(sectionId: string) {
  if (sectionId === "hero") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
}

function NavUnderline() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 -bottom-0.5 h-px rounded-full bg-foreground/40 motion-safe:animate-[panel-in_180ms_ease-out_both]"
    />
  );
}

interface NavItemProps {
  label: string;
  sectionId: string;
  isActive: boolean;
  pathname: string;
  onNavigate: () => void;
  className?: string;
}

function NavItem({
  label,
  sectionId,
  isActive,
  pathname,
  onNavigate,
  className,
}: NavItemProps) {
  const href = navHref(pathname, sectionId);
  const linkClassName = cn(
    LINK_INTERACTIVE,
    "relative px-1 py-0.5 text-sm font-medium hover:translate-y-[-1px] active:translate-y-0",
    isActive ? "text-foreground" : "text-muted-foreground",
    className,
  );

  if (pathname === "/") {
    return (
      <a
        href={href}
        aria-current={isActive ? "true" : undefined}
        className={linkClassName}
        onClick={(e) => {
          e.preventDefault();
          scrollToSection(sectionId);
          onNavigate();
        }}
      >
        {label}
        {isActive && <NavUnderline />}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={linkClassName}
      onClick={onNavigate}
      aria-current={isActive ? "true" : undefined}
    >
      {label}
      {isActive && <NavUnderline />}
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [condensed, setCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(
    isHomePage ? sectionHash("hero") : null,
  );

  useEffect(() => {
    const handler = () => setCondensed(window.scrollY > 48);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!isHomePage) {
      setActiveSection(null);
      return;
    }

    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visible.set(id, entry.intersectionRatio);
          } else {
            visible.delete(id);
          }
        }

        let nextActive: string | null = null;
        let maxRatio = 0;
        for (const id of SECTION_IDS) {
          const ratio = visible.get(id);
          if (ratio !== undefined && ratio >= maxRatio) {
            maxRatio = ratio;
            nextActive = sectionHash(id);
          }
        }

        if (nextActive) {
          setActiveSection(nextActive);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [isHomePage]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-200",
        condensed
          ? "border-b border-border/50 bg-background py-2 shadow-sm"
          : "bg-transparent py-4",
      )}
    >
      <nav
        className="relative mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 rounded font-display text-base font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-lg"
        >
          <Image
            src="/logo.png"
            alt="Requestr logo"
            width={28}
            height={28}
            priority
            className="object-contain"
          />
          Requestr
        </Link>

        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <NavItem
                label={link.label}
                sectionId={link.sectionId}
                isActive={activeSection === sectionHash(link.sectionId)}
                pathname={pathname}
                onNavigate={closeMenu}
              />
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              LINK_INTERACTIVE,
              "hidden p-1.5 text-muted-foreground hover:scale-110 active:scale-95 sm:inline-flex",
            )}
          >
            <span className="sr-only">Requestr on GitHub</span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.25.82-.57 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.33-1.73-1.33-1.73-1.09-.73.08-.71.08-.71 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.49.98.11-.76.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.81 0-1.28.47-2.33 1.24-3.15-.13-.3-.54-1.51.11-3.15 0 0 1.01-.32 3.3 1.2a11.6 11.6 0 016.01 0c2.29-1.52 3.3-1.2 3.3-1.2.65 1.64.24 2.85.12 3.15.77.82 1.23 1.87 1.23 3.15 0 4.51-2.81 5.5-5.49 5.79.43.36.81 1.08.81 2.18 0 1.58-.01 2.85-.01 3.24 0 .32.21.69.83.57A12.02 12.02 0 0024 12.29C24 5.78 18.63.5 12 .5z" />
            </svg>
          </a>
          <Link
            href="/app"
            className={cn(
              CTA_INTERACTIVE,
              "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:py-2 sm:text-sm",
            )}
          >
            Go to App
          </Link>

          <button
            type="button"
            className={cn(
              LINK_INTERACTIVE,
              "ml-1 p-1.5 text-muted-foreground hover:scale-110 active:scale-95 md:hidden",
            )}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 2l14 14M16 2L2 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 4h14M2 9h14M2 14h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-border/50 bg-background px-4 pb-4 pt-2 md:hidden motion-safe:animate-[menu-in_200ms_ease-out_both]">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <NavItem
                  label={link.label}
                  sectionId={link.sectionId}
                  isActive={activeSection === sectionHash(link.sectionId)}
                  pathname={pathname}
                  onNavigate={closeMenu}
                  className="block px-2 py-2 hover:bg-muted hover:translate-x-0.5 active:translate-x-0"
                />
              </li>
            ))}
            <li>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
                className={cn(
                  LINK_INTERACTIVE,
                  "block px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:translate-x-0.5 active:translate-x-0",
                )}
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
