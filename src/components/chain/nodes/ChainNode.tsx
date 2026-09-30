"use client";

import { Handle, Position } from "@xyflow/react";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ErrorKind } from "@/lib/chainRunner/types";
import { METHOD_BADGE_CLASSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { HttpMethod, ResponseData } from "@/types";
import type { ChainNodeState } from "@/types/chain";
import { NodeErrorStrip } from "./NodeErrorStrip";
import { NodeToolbar } from "./NodeToolbar";
import { NodeVariablesFooter } from "./NodeVariablesFooter";
import { STATE_BG, STATE_BORDER, StateIcon } from "./nodeStateStyles";

export type ChainNodeData = {
  requestId: string;
  name: string;
  method: HttpMethod;
  url: string;
  state: ChainNodeState;
  response?: ResponseData;
  extractedValues?: Record<string, string | null>;
  error?: string;
  errorKind?: ErrorKind;
  unresolvedVars?: string[];
  /** Raw text fields (url, header/param keys+values, body) scanned for `{{var}}` references. */
  variableFooterTexts?: string[];
  /** Names that resolve right now — chain input keys unioned with active-environment variable keys. */
  variableFooterResolvedNames?: string[];
  onClickNode?: (requestId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (requestId: string) => void;
  onRunNode?: (nodeId: string) => void;
  onEditRequest?: (requestId: string) => void;
  /** Canvas keyboard navigation focus (set by ChainCanvas) */
  isKeyboardFocused?: boolean;
};

function ChainNodeInner({ data }: { data: ChainNodeData }) {
  const t = useTranslations("tooltips");
  const {
    method,
    name,
    url,
    state,
    requestId,
    error,
    errorKind,
    unresolvedVars,
    variableFooterTexts,
    variableFooterResolvedNames,
    onClickNode,
    onEditRequest,
    isKeyboardFocused,
  } = data;
  const displayUrl = url.length > 100 ? `${url.slice(0, 100)}\u2026` : url;
  const unresolvedCount = unresolvedVars?.length ?? 0;

  // Determine error label based on error kind
  // Show extraction-specific label for extraction failures, generic label for others
  const errorLabel =
    errorKind === "extraction" ? t("extractFailed") : t("error");

  function handleActivateNode() {
    onClickNode?.(requestId);
  }

  return (
    // pt-9 extends the group bounding box upward so the hover zone covers the gap between the toolbar and the node
    <div className="group/node relative -mt-9 pt-9">
      <NodeToolbar data={data} />

      <div
        role="button"
        tabIndex={0}
        data-testid={`chain-node-${requestId}`}
        aria-label={`${method} request ${name}, run state ${state}`}
        className={cn(
          "relative min-w-[200px] max-w-[280px] rounded-lg border-2 p-3 shadow-lg transition-[color,box-shadow,filter,border-color] duration-200 cursor-pointer hover:brightness-110 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          STATE_BORDER[state],
          STATE_BG[state],
          isKeyboardFocused &&
            "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
        onClick={handleActivateNode}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleActivateNode();
          }
        }}
      >
        {/* Incoming handle — left side */}
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-border !bg-muted"
        />

        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                "inline-flex h-5 min-w-[3.25rem] items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tabular-nums tracking-wide",
                METHOD_BADGE_CLASSES[method],
              )}
            >
              {method}
            </span>
            {unresolvedCount > 0 && (
              <span className="inline-flex h-5 items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-900 text-amber-200 whitespace-nowrap">
                {unresolvedCount} unresolved
              </span>
            )}
            {error && (
              <span
                className="inline-flex h-5 items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-900 text-red-200 whitespace-nowrap"
                title={error}
              >
                {errorLabel}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground leading-tight">
              {name}
            </p>
            <div className="flex items-start gap-1 mt-0.5">
              <TooltipProvider delay={400}>
                {url.length > 100 ? (
                  <Tooltip>
                    <TooltipTrigger className="text-[10px] text-muted-foreground font-mono break-words cursor-default text-left flex-1 min-w-0">
                      {displayUrl}
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-[320px] font-mono text-[10px] break-all"
                    >
                      {url}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <p className="text-[10px] text-muted-foreground font-mono break-words flex-1 min-w-0">
                    {displayUrl}
                  </p>
                )}
              </TooltipProvider>
              <button
                type="button"
                className="shrink-0 opacity-0 group-hover/node:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditRequest?.(requestId);
                }}
              >
                <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="shrink-0 mt-1">
            <StateIcon state={state} />
          </div>
        </div>

        <NodeErrorStrip state={state} error={error} />

        {/* Success / Fail source handles with labels */}
        <div className="mt-2 flex flex-col gap-1 items-end pr-1">
          <div className="relative flex items-center justify-end gap-1.5 w-full">
            <span className="text-[9px] font-medium text-emerald-400 leading-none">
              Success
            </span>
            <Handle
              id="success"
              type="source"
              position={Position.Right}
              className="!relative !top-auto !right-auto !transform-none !h-2.5 !w-2.5 !border-2 !border-emerald-500 !bg-emerald-950"
            />
          </div>
          <div className="relative flex items-center justify-end gap-1.5 w-full">
            <span className="text-[9px] font-medium text-red-400 leading-none">
              Fail
            </span>
            <Handle
              id="fail"
              type="source"
              position={Position.Right}
              className="!relative !top-auto !right-auto !transform-none !h-2.5 !w-2.5 !border-2 !border-red-500 !bg-red-950"
            />
          </div>
        </div>

        {variableFooterTexts && variableFooterTexts.length > 0 && (
          <NodeVariablesFooter
            texts={variableFooterTexts}
            resolvedNames={variableFooterResolvedNames ?? []}
          />
        )}
      </div>
    </div>
  );
}

export const ChainNode = memo(ChainNodeInner);
