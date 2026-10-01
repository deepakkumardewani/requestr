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
import { ERROR_KIND, type ErrorKind } from "@/lib/chainRunner/types";
import { METHOD_BADGE_CLASSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { HttpMethod, ResponseData } from "@/types";
import type { ChainNodeState } from "@/types/chain";
import { CHAIN_HANDLE_IDS } from "@/types/chain";
import { NodeErrorStrip } from "./NodeErrorStrip";
import { NodeToolbar } from "./NodeToolbar";
import { NodeVariablesFooter } from "./NodeVariablesFooter";
import {
  NODE_CARD_INTERACTIVE,
  NODE_HANDLE_CLASS,
  NODE_RUN_STATE_LABEL_KEYS,
  nodeCardClass,
  StateIcon,
} from "./nodeStateStyles";
import { useRequestNodeActions } from "./useNodeToolbarActions";

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
  const tChain = useTranslations("chain");
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
  const toolbar = useRequestNodeActions(data);
  const displayUrl = url.length > 100 ? `${url.slice(0, 100)}\u2026` : url;
  const unresolvedCount = unresolvedVars?.length ?? 0;

  // Determine error label based on error kind
  // Show extraction-specific label for extraction failures, generic label for others
  const errorLabel =
    errorKind === ERROR_KIND.EXTRACTION ? t("extractFailed") : t("error");

  function handleActivateNode() {
    onClickNode?.(requestId);
  }

  return (
    // pt-9 extends the group bounding box upward so the hover zone covers the gap between the toolbar and the node
    <div className="group/node relative -mt-9 pt-9">
      <NodeToolbar
        actions={toolbar}
        isKeyboardFocused={isKeyboardFocused}
        className="top-0"
      />

      <div
        role="button"
        tabIndex={0}
        data-testid={`chain-node-${requestId}`}
        aria-label={tChain("chainNodeAriaLabel", {
          method,
          name,
          state: tChain(NODE_RUN_STATE_LABEL_KEYS[state]),
        })}
        className={nodeCardClass({
          state,
          isKeyboardFocused,
          className: cn(
            "min-w-[200px] max-w-[280px] p-3",
            NODE_CARD_INTERACTIVE,
          ),
        })}
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
          className={NODE_HANDLE_CLASS}
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
                {tChain("nodeVariablesFooterUnresolvedBadge", {
                  count: unresolvedCount,
                })}
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

        <NodeErrorStrip state={state} error={error} className="truncate" />

        {/* Success / Fail source handles with labels */}
        <div className="mt-2 flex flex-col gap-1 items-end pr-1">
          <div className="relative flex items-center justify-end gap-1.5 w-full">
            <span className="text-[9px] font-medium text-emerald-400 leading-none">
              {tChain("chainNodeSuccessHandle")}
            </span>
            <Handle
              id={CHAIN_HANDLE_IDS.SUCCESS}
              type="source"
              position={Position.Right}
              className="!relative !top-auto !right-auto !transform-none !h-2.5 !w-2.5 !border-2 !border-emerald-500 !bg-emerald-950"
            />
          </div>
          <div className="relative flex items-center justify-end gap-1.5 w-full">
            <span className="text-[9px] font-medium text-red-400 leading-none">
              {tChain("chainNodeFailHandle")}
            </span>
            <Handle
              id={CHAIN_HANDLE_IDS.FAIL}
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
