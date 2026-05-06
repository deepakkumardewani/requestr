"use client";

import { Handle, Position } from "@xyflow/react";
import {
  CheckCircle,
  Circle,
  Clock,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChainNodeState } from "@/types/chain";

export type DelayNodeData = {
  nodeId: string;
  delayMs: number;
  state: ChainNodeState;
  error?: string;
  onUpdateDelay?: (id: string, delayMs: number) => void;
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
          className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400"
          aria-hidden
        />
      );
    case "passed":
      return (
        <CheckCircle
          className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
      );
    case "failed":
      return (
        <XCircle
          className="h-4 w-4 text-red-600 dark:text-red-400"
          aria-hidden
        />
      );
    case "skipped":
      return <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />;
    default:
      return null;
  }
}

function DelayNodeInner({ data }: { data: DelayNodeData }) {
  const t = useTranslations("tooltips");
  const {
    nodeId,
    delayMs,
    state,
    onUpdateDelay,
    onDeleteNode,
    isKeyboardFocused,
  } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(delayMs));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(String(delayMs));
  }, [delayMs, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  function commitEdit() {
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onUpdateDelay?.(nodeId, parsed);
    } else {
      setDraft(String(delayMs));
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") {
      setDraft(String(delayMs));
      setIsEditing(false);
    }
  }

  return (
    <div className="group/node relative">
      {/* Hover toolbar */}
      {onDeleteNode && (
        <TooltipProvider delay={400}>
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover/node:flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-1 shadow-lg z-20">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6 rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    aria-label={t("removeDateFromChain")}
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
        className={cn(
          "relative flex min-w-[160px] items-center gap-2 rounded-lg border-2 px-3 py-2 shadow-lg transition-[color,box-shadow,filter,border-color] duration-200",
          STATE_BORDER[state],
          STATE_BG[state],
          isKeyboardFocused &&
            "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-border !bg-muted"
        />

        {/* Clock stays amber — Loader2 in StateIcon shows running state */}
        <Clock className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />

        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground text-xs">Wait</span>
          {isEditing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-16 rounded border border-border bg-muted px-1 py-0 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              type="number"
              min={0}
              aria-label="Delay duration in milliseconds"
            />
          ) : (
            <button
              type="button"
              className="rounded px-0.5 text-xs font-semibold text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              aria-label={`Edit delay, currently ${delayMs} milliseconds`}
            >
              {delayMs}
            </button>
          )}
          <span className="text-muted-foreground text-xs">ms</span>
        </div>

        {state !== "idle" && (
          <div className="ml-auto shrink-0">
            <StateIcon state={state} />
          </div>
        )}

        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-border !bg-muted"
        />
      </div>
    </div>
  );
}

export const DelayNode = memo(DelayNodeInner);
