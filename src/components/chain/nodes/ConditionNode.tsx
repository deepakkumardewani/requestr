"use client";

import { Handle, Position } from "@xyflow/react";
import {
  CheckCircle,
  Circle,
  GitBranch,
  Loader2,
  Settings,
  Trash2,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChainNodeState, ConditionBranch } from "@/types/chain";

export type ConditionNodeData = {
  nodeId: string;
  variable: string;
  branches: ConditionBranch[];
  state: ChainNodeState;
  activeBranchId?: string;
  error?: string;
  onDeleteNode?: (nodeId: string) => void;
  onConfigureNode?: (nodeId: string) => void;
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

function ConditionNodeInner({ data }: { data: ConditionNodeData }) {
  const t = useTranslations("tooltips");
  const {
    nodeId,
    variable,
    branches,
    state,
    activeBranchId,
    error,
    onDeleteNode,
    onConfigureNode,
    isKeyboardFocused,
  } = data;

  const branchCount = branches.length;

  return (
    <div className="group/node relative">
      {/* Hover toolbar */}
      <TooltipProvider delay={400}>
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover/node:flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-1 shadow-lg z-20">
          {onConfigureNode && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6 rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
                    aria-label={t("configureCondition")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfigureNode(nodeId);
                    }}
                  />
                }
              >
                <Settings className="h-3 w-3" aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="top">{t("configure")}</TooltipContent>
            </Tooltip>
          )}
          {onDeleteNode && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6 rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    aria-label={t("removeConditionFromChain")}
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
          )}
        </div>
      </TooltipProvider>

      <div
        className={cn(
          "relative min-w-[180px] rounded-lg border-2 px-3 py-2 shadow-lg transition-[color,box-shadow,filter,border-color] duration-200",
          STATE_BORDER[state],
          STATE_BG[state],
          isKeyboardFocused &&
            "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
        style={{
          paddingBottom:
            branchCount > 1 ? `${(branchCount - 1) * 20 + 8}px` : undefined,
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-border !bg-muted"
        />

        <div className="flex items-center gap-1.5">
          <GitBranch
            className="h-3.5 w-3.5 shrink-0 text-violet-400"
            aria-hidden
          />
          <span className="text-xs font-semibold text-foreground truncate">
            {variable || "Condition"}
          </span>
          {state !== "idle" && (
            <div className="ml-auto shrink-0">
              <StateIcon state={state} />
            </div>
          )}
        </div>

        {state === "failed" && error && (
          <p className="mt-1 text-[10px] text-red-400 leading-tight">{error}</p>
        )}

        {branches.map((branch, i) => {
          const topPct = ((i + 1) / (branchCount + 1)) * 100;
          const isActive = activeBranchId === branch.id;
          const isElse = !branch.expression.trim();

          return (
            <div key={branch.id}>
              <Handle
                id={branch.id}
                type="source"
                position={Position.Right}
                style={{ top: `${topPct}%` }}
                className={cn(
                  "!h-3 !w-3 !border-2 !bg-muted",
                  isActive ? "!border-emerald-500" : "!border-border",
                )}
              />
              <span
                className={cn(
                  "absolute right-4 text-[9px] leading-none pointer-events-none select-none truncate max-w-[120px]",
                  isActive
                    ? "text-emerald-400"
                    : isElse
                      ? "text-zinc-400 italic"
                      : "text-muted-foreground",
                )}
                style={{ top: `calc(${topPct}% - 5px)` }}
              >
                {branch.label || (isElse ? "else" : branch.id)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeInner);
