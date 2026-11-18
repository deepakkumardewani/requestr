import Link from "next/link";
import { cn } from "@/lib/utils";
import { LINK_INTERACTIVE } from "../interactionStyles";
import type { FooterLinkItem } from "./footerLinks";

/** A hairline in the accent draws in under the link on hover and keyboard focus. */
const FOOTER_LINK_CLASS = cn(
  LINK_INTERACTIVE,
  "group relative inline-flex items-baseline gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground",
  "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-compare-accent after:transition-transform after:duration-300 after:ease-out",
  "hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-reduce:after:transition-none",
);
const EXTERNAL_MARK_CLASS =
  "font-mono text-[0.7em] opacity-50 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none";
const EXTERNAL_MARK = "↗";

export function FooterLink({ label, href, external }: FooterLinkItem) {
  if (!external) {
    return (
      <Link href={href} className={FOOTER_LINK_CLASS}>
        {label}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={FOOTER_LINK_CLASS}
    >
      {label}
      <span aria-hidden="true" className={EXTERNAL_MARK_CLASS}>
        {EXTERNAL_MARK}
      </span>
    </a>
  );
}
