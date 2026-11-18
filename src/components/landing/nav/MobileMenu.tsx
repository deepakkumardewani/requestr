"use client";

import { cn } from "@/lib/utils";
import { GITHUB_URL } from "../constants";
import { NAV_LINKS, type NavLink } from "../data/links";
import { LINK_INTERACTIVE } from "../interactionStyles";
import { NavLinkItem } from "./NavLinkItem";

export const MOBILE_MENU_ID = "landing-mobile-menu";
const ROW_CLASS = "block rounded px-2 py-2 hover:bg-muted";

interface MobileMenuProps {
  activeLink: NavLink | null;
  onNavigate: () => void;
}

export function MobileMenu({ activeLink, onNavigate }: MobileMenuProps) {
  return (
    <div
      id={MOBILE_MENU_ID}
      className="border-t border-border/50 bg-background px-4 pt-2 pb-4 lg:hidden motion-safe:animate-[menu-in_200ms_ease-out_both]"
    >
      <ul className="flex flex-col gap-1">
        {NAV_LINKS.map((link) => (
          <li key={link.sectionId}>
            <NavLinkItem
              link={link}
              isActive={link === activeLink}
              onNavigate={onNavigate}
              className={ROW_CLASS}
            />
          </li>
        ))}
        <li>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className={cn(
              LINK_INTERACTIVE,
              ROW_CLASS,
              "text-sm font-medium text-muted-foreground",
            )}
          >
            GitHub
          </a>
        </li>
      </ul>
    </div>
  );
}
