"use client";

import { Handle, Position } from "@xyflow/react";
import { Rocket, Settings, Trash2 } from "lucide-react";
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
import type { ChainInput, ChainNodeState } from "@/types/chain";
import { NodeErrorStrip } from "./NodeErrorStrip";
import { STATE_BG, STATE_BORDER, StateIcon } from "./nodeStateStyles";

// "At most one Start per chain" is enforced once, at the single source of
// truth for block insertion — `useChainStore.upsertBlock` — not here or in
// any menu that triggers insertion (see useChainStore.ts).
export type StartNodeData = {
  nodeId: string;
  inputs: ChainInput[];
  state: ChainNodeState;
  error?: string;
  onDeleteNode?: (nodeId: string) => void;
  onConfigureNode?: (nodeId: string) => void;
  isKeyboardFocused?: boolean;
};

function StartNodeInner({ data }: { data: StartNodeData }) {
  const t = useTranslations("tooltips");
  const tChain = useTranslations("chain");
  const {
    nodeId,
    inputs,
    state,
    error,
    onDeleteNode,
    onConfigureNode,
    isKeyboardFocused,
  } = data;

  const inputCount = inputs.length;

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
                    aria-label={t("configureStart")}
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
                    aria-label={t("removeStartFromChain")}
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
        data-testid={`start-node-${nodeId}`}
        className={cn(
          "relative min-w-[180px] rounded-lg border-2 px-3 py-2 shadow-lg transition-[color,box-shadow,filter,border-color] duration-200",
          STATE_BORDER[state],
          STATE_BG[state],
          isKeyboardFocused &&
            "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
        style={{
          paddingBottom:
            inputCount > 1 ? `${(inputCount - 1) * 20 + 8}px` : undefined,
        }}
      >
        <div className="flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />
          <span className="text-xs font-semibold text-foreground truncate">
            {tChain("startNodeLabel")}
          </span>
          {state !== "idle" && (
            <div className="ml-auto shrink-0">
              <StateIcon state={state} />
            </div>
          )}
        </div>

        {inputCount === 0 && (
          <p className="mt-1 text-[10px] text-muted-foreground/60 italic">
            {tChain("startNodeNoInputs")}
          </p>
        )}

        <NodeErrorStrip state={state} error={error} />

        {inputs.map((input, i) => {
          const topPct = ((i + 1) / (inputCount + 1)) * 100;
          return (
            <div key={input.key}>
              <Handle
                id={input.key}
                type="source"
                position={Position.Right}
                style={{ top: `${topPct}%` }}
                className="!h-3 !w-3 !border-2 !border-border !bg-muted"
              />
              <span
                className="absolute right-4 text-[9px] leading-none pointer-events-none select-none truncate max-w-[120px] text-muted-foreground"
                style={{ top: `calc(${topPct}% - 5px)` }}
              >
                {input.key}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const StartNode = memo(StartNodeInner);
