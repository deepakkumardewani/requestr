"use client";

import { Handle, Position } from "@xyflow/react";
import {
  CheckCircle,
  Circle,
  Copy,
  Loader2,
  Monitor,
  Trash2,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ResponseData } from "@/types";
import type { ChainNodeState, DisplayNodeConfig } from "@/types/chain";

export type DisplayNodeData = {
  nodeId: string;
  config?: DisplayNodeConfig;
  sourceResponse?: ResponseData;
  state: ChainNodeState;
  error?: string;
  onClickNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  isKeyboardFocused?: boolean;
};

const STATE_BORDER: Record<ChainNodeState, string> = {
  idle: "border-border",
  running: "border-blue-500 animate-pulse",
  passed: "border-emerald-500",
  failed: "border-red-500",
  skipped: "border-zinc-500",
};

const STATE_BG: Record<ChainNodeState, string> = {
  idle: "bg-card",
  running: "bg-blue-500/10 dark:bg-blue-950/30",
  passed: "bg-emerald-500/10 dark:bg-emerald-950/30",
  failed: "bg-red-500/10 dark:bg-red-950/30",
  skipped: "bg-muted/60 dark:bg-zinc-900/30",
};

function StateIcon({ state }: { state: ChainNodeState }) {
  switch (state) {
    case "running":
      return (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400"
          aria-hidden
        />
      );
    case "passed":
      return (
        <CheckCircle
          className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
      );
    case "failed":
      return (
        <XCircle
          className="h-3.5 w-3.5 text-red-600 dark:text-red-400"
          aria-hidden
        />
      );
    case "skipped":
      return (
        <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      );
    default:
      return null;
  }
}

/** Render compact JSON structure: top-level keys with type/count hints. */
function JsonSummary({ body }: { body: string }) {
  let parsed: Record<string, unknown> | null = null;
  try {
    const val = JSON.parse(body);
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      parsed = val as Record<string, unknown>;
    }
  } catch {
    // not JSON
  }

  if (!parsed) {
    return (
      <p className="text-[10px] text-muted-foreground font-mono truncate">
        {body.slice(0, 60)}
      </p>
    );
  }

  const entries = Object.entries(parsed).slice(0, 4);

  return (
    <div className="flex flex-col gap-0.5">
      {entries.map(([key, val]) => {
        let hint: string;
        if (val === null) {
          hint = "null";
        } else if (Array.isArray(val)) {
          hint = `[ ${val.length} ]`;
        } else if (typeof val === "object") {
          hint = `{ ${Object.keys(val as object).length} keys }`;
        } else {
          hint = String(val).slice(0, 20);
        }
        return (
          <div key={key} className="flex items-center gap-1.5 font-mono">
            <span className="text-[10px] text-violet-400 shrink-0">{key}</span>
            <span className="text-[10px] text-muted-foreground truncate">
              {hint}
            </span>
          </div>
        );
      })}
      {Object.keys(parsed).length > 4 && (
        <p className="text-[10px] text-muted-foreground/60">
          +{Object.keys(parsed).length - 4} more
        </p>
      )}
    </div>
  );
}

function DisplayNodeInner({ data }: { data: DisplayNodeData }) {
  const t = useTranslations("tooltips");
  const {
    nodeId,
    config,
    sourceResponse,
    state,
    onClickNode,
    onDeleteNode,
    isKeyboardFocused,
  } = data;
  const [format, setFormat] = useState<"JSON" | "Raw">("JSON");

  const hasResponse = !!sourceResponse?.body;
  if (!config) {
    return null;
  }
  const isConfigured = config.sourceJsonPath && config.sourceJsonPath !== "";

  const displayBody =
    hasResponse && format === "JSON"
      ? sourceResponse.body
      : (sourceResponse?.body ?? "");

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (sourceResponse?.body) {
      navigator.clipboard.writeText(sourceResponse.body);
    }
  }

  return (
    <div className="group/node relative -mt-9 pt-9">
      {/* Hover toolbar */}
      {onDeleteNode && (
        <TooltipProvider delay={400}>
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 hidden group-hover/node:flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-1 shadow-lg z-20">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6 rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    aria-label={t("removeDisplayNodeFromChain")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(nodeId);
                    }}
                  />
                }
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="top">{t("removeFromChain")}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label={`Display node, run state ${state}`}
        className={cn(
          "relative min-w-[200px] max-w-[260px] rounded-lg border-2 shadow-lg transition-[color,box-shadow,filter,border-color] duration-200 cursor-pointer hover:brightness-110 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          STATE_BORDER[state],
          STATE_BG[state],
          isKeyboardFocused &&
            "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
        onClick={() => onClickNode?.(nodeId)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClickNode?.(nodeId);
          }
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-border !bg-muted"
        />

        {/* Header row */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 border-b border-border/40">
          <Monitor className="h-3.5 w-3.5 shrink-0 text-violet-400" />
          <span className="text-xs font-semibold text-foreground flex-1">
            Display
          </span>
          {state !== "idle" && <StateIcon state={state} />}
          {hasResponse && (
            <div className="flex items-center gap-0.5 ml-auto">
              {(["JSON", "Raw"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={format === f}
                  aria-label={`Show response as ${f}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormat(f);
                  }}
                  className={cn(
                    "rounded px-1 py-0 text-[9px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    format === f
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
              <button
                type="button"
                onClick={handleCopy}
                className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("copyResponseBody")}
              >
                <Copy className="h-2.5 w-2.5" aria-hidden />
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          {hasResponse ? (
            <JsonSummary body={displayBody} />
          ) : (
            <p className="text-[10px] text-muted-foreground/60 italic">
              No response yet
            </p>
          )}

          {/* Extraction config pill */}
          {isConfigured && (
            <div className="mt-2 flex items-center gap-1 rounded bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5">
              <span className="text-[9px] font-mono text-violet-400 truncate">
                {config.sourceJsonPath}
              </span>
              <span className="text-[9px] text-muted-foreground shrink-0">
                →
              </span>
              <span className="text-[9px] font-mono text-emerald-400 truncate">
                {config.targetField}.{config.targetKey}
              </span>
            </div>
          )}
        </div>

        <Handle
          id="output"
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-violet-500 !bg-violet-950"
        />
      </div>
    </div>
  );
}

export const DisplayNode = memo(DisplayNodeInner);
