"use client";

import { statusBadgeClass } from "@/components/landing/data/productVisual";
import { cn } from "@/lib/utils";
import type { LiveRequestState } from "./useLiveRequest";

interface MiniRequestrProps extends LiveRequestState {
  url: string;
  onSend: () => void;
  /** Slot under the response, used for the Relay line. */
  children?: React.ReactNode;
}

const FALLBACK_NOTICE =
  "Showing a recorded response (live request unavailable).";

function ResponsePanel({
  response,
  source,
}: Pick<LiveRequestState, "response" | "source">) {
  if (!response) {
    return (
      <p className="p-4 text-xs text-muted-foreground">
        Press Send to make a real request.
      </p>
    );
  }
  return (
    <div className="space-y-2 p-3 sm:p-4" data-testid="hero-a-response">
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-semibold",
            statusBadgeClass(response.status),
          )}
        >
          {response.status} {response.statusText}
        </span>
        <span className="text-muted-foreground">{response.timingMs} ms</span>
      </div>
      {source === "fallback" && (
        <p role="status" className="text-xs text-muted-foreground">
          {FALLBACK_NOTICE}
        </p>
      )}
      <pre className="max-h-56 overflow-auto rounded-md bg-background/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
        {response.body}
      </pre>
    </div>
  );
}

/** Presentational mini API client: a GET URL bar, Send, and the response. */
export function MiniRequestr({
  url,
  loading,
  response,
  source,
  onSend,
  children,
}: MiniRequestrProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border bg-background/50 p-2 sm:p-3">
        <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          GET
        </span>
        <input
          readOnly
          aria-label="Request URL"
          value={url}
          className="min-w-0 flex-1 truncate rounded-md border border-border bg-background/60 px-2.5 py-1.5 font-mono text-xs text-muted-foreground"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </div>
      <ResponsePanel response={response} source={source} />
      {children}
    </div>
  );
}
