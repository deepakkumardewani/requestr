"use client";

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAnonUserId } from "@/lib/anonUser";
import { createShareLink } from "@/lib/shareLink";
import { SHARE_RATE_LIMIT_MAX } from "@/lib/shareServer";
import type { BodyConfig, HttpTab } from "@/types";

function hasNonEmptyBody(body: BodyConfig): boolean {
  if (body.type === "none") return false;
  if (["json", "xml", "text", "html"].includes(body.type)) {
    return body.content.trim().length > 0;
  }
  if (body.type === "form-data" || body.type === "urlencoded") {
    const fields = (body.formData ?? []).filter((f) => f.enabled && f.key);
    if (fields.length > 0) return true;
    return body.content.trim().length > 0;
  }
  return false;
}

/** Time first, then calendar date with year (locale-aware). */
function formatRateLimitResetAt(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${time}, ${date}`;
}

type ShareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: HttpTab;
};

export function ShareModal({ open, onOpenChange, tab }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<
    null | "rate_limited" | "failed"
  >(null);
  const [rateLimitResetsAtMs, setRateLimitResetsAtMs] = useState<number | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const copiedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedResetRef.current !== null) {
        clearTimeout(copiedResetRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setIsCreating(true);
    setCreateError(null);
    setRateLimitResetsAtMs(null);
    setShareUrl(null);

    async function runCreateShareLink() {
      try {
        const userId = getAnonUserId();
        const result = await createShareLink(tab, userId, ac.signal);
        if (cancelled) {
          return;
        }
        setIsCreating(false);
        if (result.ok) {
          setShareUrl(result.url);
          setCreateError(null);
          setRateLimitResetsAtMs(null);
        } else {
          setShareUrl(null);
          setCreateError(result.error);
          setRateLimitResetsAtMs(
            result.error === "rate_limited" ? (result.resetAt ?? null) : null,
          );
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        if (cancelled) {
          return;
        }
        setIsCreating(false);
        setCreateError("failed");
        setRateLimitResetsAtMs(null);
        setShareUrl(null);
      }
    }

    void runCreateShareLink();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [tab, open]);

  async function handleCopy() {
    if (!shareUrl || isCreating) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      if (copiedResetRef.current !== null) {
        clearTimeout(copiedResetRef.current);
      }
      copiedResetRef.current = setTimeout(() => {
        copiedResetRef.current = null;
        setCopied(false);
      }, 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  const enabledHeaderCount = tab.headers.filter((h) => h.enabled).length;
  const enabledParamCount = tab.params.filter((p) => p.enabled).length;
  const showSecretsWarning =
    enabledHeaderCount > 0 || hasNonEmptyBody(tab.body);

  const rateLimitResetsAtLabel =
    rateLimitResetsAtMs != null
      ? formatRateLimitResetAt(rateLimitResetsAtMs)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Shareable Link</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isCreating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              <span>Creating link…</span>
            </div>
          )}

          {createError === "rate_limited" && !isCreating && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100/90">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="space-y-1">
                <span className="block">
                  You&apos;ve reached the share limit for this device (
                  {SHARE_RATE_LIMIT_MAX} new links per rolling hour).
                </span>
                {rateLimitResetsAtLabel ? (
                  <span className="block text-amber-950/90 dark:text-amber-50/80">
                    Limit renews at {rateLimitResetsAtLabel}.
                  </span>
                ) : (
                  <span className="block text-amber-950/90 dark:text-amber-50/80">
                    Try again after the window resets.
                  </span>
                )}
              </span>
            </div>
          )}

          {createError === "failed" && !isCreating && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Couldn&apos;t create a link. Check your connection and try
                again.
              </span>
            </div>
          )}

          {/* Share URL row */}
          {shareUrl && !isCreating && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="h-8 w-full truncate rounded-md border border-border bg-muted/40 px-2.5 text-xs font-mono text-muted-foreground focus:outline-none"
              />
              <Button
                size="sm"
                className="h-8 shrink-0 gap-1.5 text-xs"
                onClick={handleCopy}
                disabled={copied || isCreating}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}

          {showSecretsWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Headers and body are included in this link. Remove any API keys
                or secrets before sharing.
              </span>
            </div>
          )}

          {!showSecretsWarning && createError !== "rate_limited" && (
            <div>
              <button
                type="button"
                onClick={() => setDetailsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>What's included</span>
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${
                    detailsOpen ? "rotate-90" : ""
                  }`}
                />
              </button>

              {detailsOpen && (
                <ul className="mt-2 space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <li>
                    <span className="text-foreground">Method:</span>{" "}
                    {tab.method}
                  </li>
                  <li>
                    <span className="text-foreground">URL:</span>{" "}
                    <span className="font-mono">{tab.url || "(empty)"}</span>
                  </li>
                  <li>
                    <span className="text-foreground">Headers:</span>{" "}
                    {enabledHeaderCount} enabled
                  </li>
                  <li>
                    <span className="text-foreground">Params:</span>{" "}
                    {enabledParamCount} enabled
                  </li>
                  <li>
                    <span className="text-foreground">Body:</span>{" "}
                    {tab.body.type === "none" ? "none" : tab.body.type}
                  </li>
                  <li>
                    <span className="text-foreground">Auth:</span>{" "}
                    {tab.auth.type}
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
