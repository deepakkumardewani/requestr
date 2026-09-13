import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  DOCS_URL,
  GITHUB_URL,
  LICENSE_URL,
  SECTION_CONTAINER,
} from "./constants";
import { LINK_INTERACTIVE } from "./interactionStyles";

const FOOTER_LINK_CLASS = cn(
  LINK_INTERACTIVE,
  "text-sm text-muted-foreground hover:text-foreground",
);

interface FooterColumnProps {
  title: string;
  children: React.ReactNode;
}

function FooterColumn({ title, children }: FooterColumnProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
        {title}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-muted/20 py-12">
      <div className={SECTION_CONTAINER}>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 space-y-2 sm:col-span-1">
            <Link
              href="/"
              className={cn(
                LINK_INTERACTIVE,
                "font-display text-base font-bold tracking-tight text-foreground hover:opacity-80 active:opacity-100",
              )}
            >
              Requestr
            </Link>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground/60">
              Local-first API client. Nothing leaves your browser.
            </p>
          </div>

          <FooterColumn title="Product">
            <li>
              <Link href="/app" className={FOOTER_LINK_CLASS}>
                App
              </Link>
            </li>
            <li>
              <a href="#features" className={FOOTER_LINK_CLASS}>
                Features
              </a>
            </li>
            <li>
              <a href="#compare" className={FOOTER_LINK_CLASS}>
                Compare
              </a>
            </li>
          </FooterColumn>

          <FooterColumn title="Resources">
            <li>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_LINK_CLASS}
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_LINK_CLASS}
              >
                Docs
              </a>
            </li>
            <li>
              <a
                href={LICENSE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_LINK_CLASS}
              >
                License (MIT)
              </a>
            </li>
          </FooterColumn>
        </div>

        <div className="mt-10 border-t border-border/50 pt-6">
          <p className="text-xs text-muted-foreground/40">
            © {new Date().getFullYear()} Requestr
          </p>
        </div>
      </div>
    </footer>
  );
}
