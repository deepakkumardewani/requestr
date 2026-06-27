"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import {
  METHOD_TAB_HOVER,
  METHOD_TEXT,
  type MockResponse,
  PRODUCT_METHODS,
  PRODUCT_REQUESTS,
  type ProductMethod,
  RESPONSE_CONTENT_MIN_HEIGHT,
  RESPONSE_PANEL_MIN_HEIGHT,
  statusBadgeClass,
} from "./data/productVisual";

const INTERACTIVE_SCALE = "hover:scale-105 active:scale-95";

interface TabPillProps {
  method: ProductMethod;
  label: string;
  active: boolean;
  reduced: boolean;
  onSelect: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

function TabPill({
  method,
  label,
  active,
  reduced,
  onSelect,
  onKeyDown,
}: TabPillProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded border px-1.5 py-1 text-xs transition-all duration-150 sm:gap-1.5 sm:px-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? cn("bg-card border-border/60 shadow-sm", METHOD_TAB_HOVER[method])
          : cn(
              "border-transparent text-muted-foreground hover:text-foreground",
              METHOD_TAB_HOVER[method],
            ),
        !reduced && INTERACTIVE_SCALE,
      )}
    >
      <span
        className={cn(
          "font-mono font-semibold text-[10px]",
          METHOD_TEXT[method],
        )}
      >
        {method}
      </span>
      <span
        className={cn(
          "font-mono text-[11px]",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        /{label}
      </span>
    </button>
  );
}

function ResponseBody({ response }: { response: MockResponse }) {
  return (
    <>
      {response.lines.map((line, i) => (
        <div
          key={`${line.indent}-${i}`}
          className="rounded px-1 -mx-1 text-muted-foreground/50 transition-colors duration-150 hover:bg-white/[0.04]"
          style={{ paddingLeft: `${line.indent * 12}px` }}
        >
          {line.parts.map((part, j) => (
            <span key={`${part.text}-${j}`} className={part.className}>
              {part.text}
            </span>
          ))}
        </div>
      ))}
    </>
  );
}

export function ProductVisual() {
  const reduced = useReducedMotion();
  const [activeMethod, setActiveMethod] = useState<ProductMethod>("GET");
  const [responseIndex, setResponseIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [displayedResponse, setDisplayedResponse] =
    useState<MockResponse | null>(PRODUCT_REQUESTS.GET.responses[0]);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = PRODUCT_REQUESTS[activeMethod];

  const clearLoadingTimer = useCallback(() => {
    if (loadingTimer.current) {
      clearTimeout(loadingTimer.current);
      loadingTimer.current = null;
    }
  }, []);

  useEffect(() => clearLoadingTimer, [clearLoadingTimer]);

  function handleTabSelect(method: ProductMethod) {
    if (method === activeMethod) return;
    clearLoadingTimer();
    setIsLoading(false);
    setActiveMethod(method);
    setResponseIndex(0);
    setDisplayedResponse(PRODUCT_REQUESTS[method].responses[0]);
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    method: ProductMethod,
  ) {
    const index = PRODUCT_METHODS.indexOf(method);
    if (index === -1) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight")
      nextIndex = (index + 1) % PRODUCT_METHODS.length;
    else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + PRODUCT_METHODS.length) % PRODUCT_METHODS.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = PRODUCT_METHODS.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const nextMethod = PRODUCT_METHODS[nextIndex];
    handleTabSelect(nextMethod);
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  }

  function handleSend() {
    clearLoadingTimer();
    const nextIndex = (responseIndex + 1) % config.responses.length;
    const nextResponse = config.responses[nextIndex];

    if (reduced) {
      setDisplayedResponse(nextResponse);
      setResponseIndex(nextIndex);
      return;
    }

    setIsLoading(true);
    loadingTimer.current = setTimeout(() => {
      setDisplayedResponse(nextResponse);
      setIsLoading(false);
      setResponseIndex(nextIndex);
      loadingTimer.current = null;
    }, nextResponse.loadingMs);
  }

  return (
    <div className="group/visual relative w-full max-w-full overflow-visible pt-4 pr-5 pb-5 pl-4 sm:pt-5 sm:pr-6 sm:pb-6 sm:pl-5">
      <div
        className={cn(
          "rounded-xl border border-border bg-card shadow-2xl overflow-hidden transition-all duration-200",
          "hover:border-border/80 hover:shadow-[0_28px_60px_-16px_rgba(0,0,0,0.55)]",
          !reduced && "hover:-translate-y-0.5",
        )}
      >
        <div className="flex items-center gap-1 border-b border-border bg-background/50 px-2 py-2 sm:px-3">
          <div
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch]"
            role="tablist"
            aria-label="Request tabs"
          >
            {PRODUCT_METHODS.map((method) => (
              <TabPill
                key={method}
                method={method}
                label={PRODUCT_REQUESTS[method].label}
                active={activeMethod === method}
                reduced={reduced}
                onSelect={() => handleTabSelect(method)}
                onKeyDown={(event) => handleTabKeyDown(event, method)}
              />
            ))}
          </div>
          <span
            aria-hidden="true"
            className="rounded px-1.5 py-0.5 text-muted-foreground/30 text-xs font-mono select-none"
          >
            +
          </span>
        </div>

        <div className="space-y-3 p-3 sm:space-y-3 sm:p-4">
          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-2 font-mono text-xs transition-all duration-150 sm:gap-2 sm:px-3 sm:text-sm",
              "hover:border-border/80 hover:bg-background/75",
            )}
          >
            <span
              className={cn(
                "rounded px-1 py-0.5 font-semibold text-xs transition-colors duration-150",
                METHOD_TEXT[config.method],
                "group-hover/visual:bg-white/[0.03]",
              )}
            >
              {config.method}
            </span>
            <span className="text-muted-foreground/40 text-xs max-sm:hidden">
              │
            </span>
            <span className="text-muted-foreground/50 text-xs max-sm:hidden">
              {"{"}
            </span>
            <span className="text-purple-400 text-xs transition-colors duration-150 hover:text-purple-300 max-sm:hidden">
              {"{"}
            </span>
            <span className="text-purple-300 text-xs transition-colors duration-150 hover:text-purple-200 max-sm:hidden">
              BASE_URL
            </span>
            <span className="text-purple-400 text-xs transition-colors duration-150 hover:text-purple-300 max-sm:hidden">
              {"}"}
            </span>
            <span className="text-purple-400 text-xs max-sm:hidden">{"}"}</span>
            <span className="min-w-0 truncate text-muted-foreground text-xs transition-colors duration-150 hover:text-foreground/80 sm:text-xs">
              {config.path}
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading}
              className={cn(
                "ml-auto rounded px-2 py-0.5 text-[10px] font-semibold border transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
                "hover:bg-emerald-500/25 hover:border-emerald-500/35",
                !reduced && INTERACTIVE_SCALE,
                isLoading && "opacity-60 cursor-wait",
              )}
            >
              {isLoading ? "Sending…" : "Send"}
            </button>
          </div>

          <div
            key={`headers-${activeMethod}`}
            className={cn(
              "rounded-md border border-border bg-background/30 p-2.5 space-y-1.5 transition-colors duration-150",
              "hover:border-border/70 hover:bg-background/40",
              "motion-safe:animate-[panel-in_180ms_ease-out_both]",
            )}
          >
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Headers
            </p>
            {config.headers.map((header) => (
              <div
                key={header.key}
                className={cn(
                  "flex items-center gap-3 text-xs font-mono rounded px-1 -mx-1 transition-all duration-150 hover:bg-muted/50",
                  !reduced && "hover:translate-x-0.5",
                )}
              >
                <span className="text-muted-foreground w-24 shrink-0 truncate transition-colors duration-150 group-hover/visual:text-foreground/80">
                  {header.key}
                </span>
                <span
                  className={cn(
                    header.valueClass ?? "text-foreground/70",
                    "transition-opacity duration-150 hover:opacity-100",
                  )}
                >
                  {header.value}
                </span>
              </div>
            ))}
          </div>

          <div
            data-testid="response-panel"
            style={{ minHeight: RESPONSE_PANEL_MIN_HEIGHT }}
            className={cn(
              "relative flex flex-col rounded-md border border-border bg-[oklch(0.12_0.005_285)] p-3 font-mono text-xs transition-colors duration-150",
              "hover:border-border/70",
            )}
          >
            {displayedResponse ? (
              <div
                key={`${activeMethod}-${responseIndex}`}
                style={{ minHeight: RESPONSE_CONTENT_MIN_HEIGHT }}
                className={cn(
                  "flex flex-col transition-opacity duration-200",
                  isLoading
                    ? "opacity-40"
                    : "motion-safe:animate-[panel-in_220ms_ease-out_both]",
                )}
              >
                <div className="mb-2 flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold border transition-transform duration-150",
                      statusBadgeClass(displayedResponse.status),
                      !reduced &&
                        !isLoading &&
                        "motion-safe:animate-[badge-pop_200ms_cubic-bezier(.2,.8,.3,1.2)_both]",
                    )}
                  >
                    {displayedResponse.status} {displayedResponse.statusLabel}
                  </span>
                  <span className="text-muted-foreground">
                    {displayedResponse.timingMs} ms · {displayedResponse.sizeKb}{" "}
                    kB
                  </span>
                </div>
                <div className="min-h-0 flex-1 space-y-1">
                  <ResponseBody response={displayedResponse} />
                </div>
              </div>
            ) : null}

            {isLoading ? (
              <div
                className="absolute inset-0 flex items-center justify-center gap-2 rounded-md bg-[oklch(0.12_0.005_285)]/75 text-muted-foreground/70"
                aria-live="polite"
              >
                {!reduced && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-emerald-400" />
                )}
                <span className="text-[11px]">Waiting for response…</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-3 pb-3 sm:hidden">
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-mono">
            <span className="text-muted-foreground/60">env: </span>
            <span className="text-purple-400">staging</span>
          </span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono text-emerald-400">
            ✓ data stays in your browser
          </span>
        </div>
      </div>

      <div
        className={cn(
          "absolute -top-3 -right-4 hidden rounded-full border border-border bg-card px-3 py-1 text-xs font-mono shadow-xl transition-all duration-200 sm:block",
          "hover:border-purple-500/30 hover:bg-card/90",
          !reduced && "hover:-translate-y-0.5 hover:scale-105",
        )}
      >
        <span className="text-muted-foreground/60">env: </span>
        <span className="text-purple-400 transition-colors duration-150 hover:text-purple-300">
          staging
        </span>
      </div>

      <div
        className={cn(
          "absolute -bottom-3 -left-4 hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono shadow-xl transition-all duration-200 sm:block",
          "hover:border-emerald-500/50 hover:bg-emerald-500/15",
          !reduced && "hover:-translate-y-0.5 hover:scale-105",
        )}
      >
        <span className="text-emerald-400">✓ </span>
        <span className="text-emerald-400/80">data stays in your browser</span>
      </div>
    </div>
  );
}
