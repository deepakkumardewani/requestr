"use client";

import { Handle, Position } from "@xyflow/react";
import { Repeat, Settings, Trash2 } from "lucide-react";
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
import type { ChainNodeState } from "@/types/chain";
import { NodeErrorStrip } from "./NodeErrorStrip";
import { STATE_BG, STATE_BORDER, StateIcon } from "./nodeStateStyles";

/** Handle id for the edge into the Loop's body subgraph. */
export const LOOP_BODY_HANDLE_ID = "body";
/** Handle id for the edge continuing downstream once the loop (and its Collect) has finished. */
export const LOOP_DONE_HANDLE_ID = "done";

export type LoopNodeData = {
  nodeId: string;
  itemAlias: string;
  maxIterations: number;
  state: ChainNodeState;
  error?: string;
  /** Display label of the paired Collect block, when one exists — shows the pairing on this node. */
  pairedCollectLabel?: string;
  onDeleteNode?: (nodeId: string) => void;
  onConfigureNode?: (nodeId: string) => void;
  isKeyboardFocused?: boolean;
};

function LoopNodeInner({ data }: { data: LoopNodeData }) {
  const t = useTranslations("tooltips");
  const {
    nodeId,
    itemAlias,
    maxIterations,
    state,
    error,
    pairedCollectLabel,
    onDeleteNode,
    onConfigureNode,
    isKeyboardFocused,
  } = data;

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
                    aria-label={t("configure")}
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
                    aria-label={t("removeFromChain")}
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
        data-testid={`loop-node-${nodeId}`}
        className={cn(
          "relative flex min-w-[180px] items-center gap-2 rounded-lg border-2 px-3 py-2 shadow-lg transition-[color,box-shadow,filter,border-color] duration-200",
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

        <Repeat className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />

        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-foreground truncate">
            Loop
          </span>
          <span className="block text-[10px] text-muted-foreground truncate">
            {itemAlias ? `for ${itemAlias}` : "for item"} · max {maxIterations}
          </span>
          {pairedCollectLabel && (
            <span className="block text-[9px] text-emerald-400 truncate">
              → {pairedCollectLabel}
            </span>
          )}
        </div>

        {state !== "idle" && (
          <div className="ml-auto shrink-0">
            <StateIcon state={state} />
          </div>
        )}

        <NodeErrorStrip state={state} error={error} variant="absolute" />

        <Handle
          id={LOOP_BODY_HANDLE_ID}
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-border !bg-muted"
        />
        <Handle
          id={LOOP_DONE_HANDLE_ID}
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-border !bg-muted"
        />
      </div>
    </div>
  );
}

export const LoopNode = memo(LoopNodeInner);
