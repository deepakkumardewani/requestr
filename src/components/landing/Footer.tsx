import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-muted/20 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* Wordmark */}
          <Link
            href="/"
            className="font-display text-base font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Requestr
          </Link>

          <p className="text-xs text-muted-foreground/40 text-center sm:text-right">
            © {new Date().getFullYear()} Requestr
          </p>
        </div>
      </div>
    </footer>
  );
}
