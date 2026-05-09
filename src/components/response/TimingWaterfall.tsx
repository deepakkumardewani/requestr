"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TimingData } from "@/types";

type Props = {
  timing: TimingData;
};

type Segment = {
  label: string;
  value: number | null;
  /** CSS variable name without `var()` — e.g. `--timing-dns` */
  fillVar: string;
};

const NA_STRIPE =
  "repeating-linear-gradient(-45deg, var(--timing-na-stripe-a) 0px, var(--timing-na-stripe-a) 3px, var(--timing-na-stripe-b) 3px, var(--timing-na-stripe-b) 6px)";

/** Segment row: py-[3px] + line box (~17px). Total row: border-t + pt + line. */
const TIMING_ROW_ESTIMATE_PX = 22;
const TIMING_TOTAL_ROW_ESTIMATE_PX = 30;

function buildSegments(timing: TimingData): Segment[] {
  return [
    { label: "DNS", value: timing.dns, fillVar: "--timing-dns" },
    { label: "TCP", value: timing.tcp, fillVar: "--timing-tcp" },
    { label: "TLS", value: timing.tls, fillVar: "--timing-tls" },
    { label: "TTFB", value: timing.ttfb, fillVar: "--timing-ttfb" },
    {
      label: "Download",
      value: timing.download,
      fillVar: "--timing-download",
    },
  ];
}

function formatMs(value: number): string {
  return `${Math.round(value * 100) / 100} ms`;
}

function formatPct(value: number, total: number): string {
  return `${Math.round((value / total) * 100)}%`;
}

const BOTTLENECK_THRESHOLD = 0.8;

export function TimingWaterfall({ timing }: Props) {
  const segments = buildSegments(timing);

  const filledTotal = segments.reduce<number>(
    (sum, s) => sum + (s.value ?? 0),
    0,
  );
  const totalForPct = filledTotal > 0 ? filledTotal : 1;

  // Highlight TTFB as bottleneck when it dominates (> 80% of total time)
  const ttfbPct =
    timing.ttfb !== null && timing.ttfb > 0 ? timing.ttfb / totalForPct : 0;
  const ttfbIsBottleneck = ttfbPct > BOTTLENECK_THRESHOLD;

  const nullCount = segments.filter((s) => s.value === null).length;
  const naVisualPct = nullCount > 0 ? 5 : 0;
  const filledVisualPct = 100 - naVisualPct * nullCount;

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const rowCount = segments.length + 1;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: (index) =>
      index === rowCount - 1
        ? TIMING_TOTAL_ROW_ESTIMATE_PX
        : TIMING_ROW_ESTIMATE_PX,
    overscan: 4,
  });

  return (
    <TooltipProvider delay={100}>
      <div
        className="flex flex-col gap-3 p-3"
        data-testid="response-timing-waterfall"
      >
        <div className="flex h-5 w-full overflow-hidden rounded">
          {segments.map((seg) => {
            if (seg.value === null) {
              return (
                <Tooltip key={seg.label}>
                  <TooltipTrigger
                    className="h-full cursor-default"
                    style={{
                      width: `${naVisualPct}%`,
                      background: NA_STRIPE,
                    }}
                  />
                  <TooltipContent side="top">
                    <span className="font-medium">{seg.label}</span>
                    <span className="ml-2 text-muted-foreground">N/A</span>
                  </TooltipContent>
                </Tooltip>
              );
            }

            const widthPct = (seg.value / totalForPct) * filledVisualPct;

            return (
              <Tooltip key={seg.label}>
                <TooltipTrigger
                  className="h-full cursor-default"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: `var(${seg.fillVar})`,
                  }}
                />
                <TooltipContent side="top">
                  <span className="font-medium">{seg.label}</span>
                  <span className="ml-2">{formatMs(seg.value)}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div
          ref={tableScrollRef}
          className="flex max-h-[min(45vh,15rem)] flex-col overflow-y-auto"
        >
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const idx = virtualRow.index;
              if (idx < segments.length) {
                const seg = segments[idx];
                const pct =
                  seg.value !== null ? (seg.value / totalForPct) * 100 : 0;
                const isBottleneck = ttfbIsBottleneck && seg.label === "TTFB";
                return (
                  <div
                    key={seg.label}
                    className={cn(
                      "absolute left-0 right-0 grid items-center gap-x-2 py-[3px] text-[11px]",
                      isBottleneck && "rounded bg-amber-500/10",
                    )}
                    style={{
                      top: 0,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                      gridTemplateColumns: "0.5rem 3.25rem 1fr 4.25rem 1.75rem",
                    }}
                    data-testid="timing-row"
                    data-bottleneck={isBottleneck || undefined}
                  >
                    {seg.value !== null ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor: isBottleneck
                            ? "rgb(245 158 11)"
                            : `var(${seg.fillVar})`,
                        }}
                      />
                    ) : (
                      <span
                        className="h-2 w-2 shrink-0 rounded-[2px]"
                        style={{ background: NA_STRIPE }}
                      />
                    )}
                    <span
                      className={cn(
                        "text-muted-foreground",
                        isBottleneck && "font-semibold text-amber-500",
                      )}
                      data-testid="timing-label"
                    >
                      {seg.label}
                      {isBottleneck && (
                        <span className="ml-1 text-[10px] font-normal text-amber-500/80">
                          bottleneck
                        </span>
                      )}
                    </span>
                    <div
                      className="h-[3px] overflow-hidden rounded-full"
                      style={{
                        backgroundColor: isBottleneck
                          ? "rgb(245 158 11 / 0.18)"
                          : `color-mix(in oklch, var(${seg.fillVar}) 18%, transparent)`,
                      }}
                    >
                      {seg.value !== null && (
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isBottleneck
                              ? "rgb(245 158 11)"
                              : `var(${seg.fillVar})`,
                          }}
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-right font-mono text-foreground",
                        isBottleneck && "font-semibold text-amber-500",
                      )}
                      data-testid="timing-value"
                    >
                      {seg.value !== null ? formatMs(seg.value) : "N/A"}
                    </span>
                    <span className="text-right font-mono text-muted-foreground">
                      {seg.value !== null
                        ? formatPct(seg.value, totalForPct)
                        : "—"}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key="timing-total"
                  className="absolute left-0 right-0 grid items-center gap-x-2 border-t border-border pt-1.5 text-[11px]"
                  style={{
                    top: 0,
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                    gridTemplateColumns: "0.5rem 3.25rem 1fr 4.25rem 1.75rem",
                  }}
                >
                  <span />
                  <span className="text-muted-foreground">Total</span>
                  <span />
                  <span className="text-right font-mono font-medium text-foreground">
                    {formatMs(timing.total)}
                  </span>
                  <span className="text-right font-mono text-muted-foreground">
                    100%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
