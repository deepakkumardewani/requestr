import Link from "next/link";
import { cn } from "@/lib/utils";
import { LINK_INTERACTIVE } from "./interactionStyles";

const GITHUB_URL = "https://github.com/deepakkumardewani/requestly";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-muted/20 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
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
              Local-first API testing. Your requests never leave your browser.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                LINK_INTERACTIVE,
                "text-sm text-muted-foreground hover:text-foreground",
              )}
            >
              GitHub
            </a>
            <p className="text-xs text-muted-foreground/40">
              © {new Date().getFullYear()} Requestr
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
