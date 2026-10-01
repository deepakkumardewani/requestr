"use client";

import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { ChainNodeState, ConditionBranch } from "@/types/chain";
import { CHAIN_HANDLE_IDS } from "@/types/chain";
import { NodeShell } from "./NodeShell";
import { NODE_HANDLE_CLASS, StateIcon } from "./nodeStateStyles";
import { useBlockNodeActions } from "./useNodeToolbarActions";

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

function ConditionNodeInner({ data }: { data: ConditionNodeData }) {
  const t = useTranslations("tooltips");
  const tChain = useTranslations("chain");
  const {
    nodeId,
    variable,
    branches,
    state,
    activeBranchId,
    error,
    onDeleteNode,
    onConfigureNode,
  } = data;
  const toolbar = useBlockNodeActions({
    nodeId,
    onConfigureNode,
    onDeleteNode,
    labels: {
      configure: t("configureCondition"),
      remove: t("removeConditionFromChain"),
    },
  });
  const branchCount = branches.length;

  return (
    <NodeShell
      testId={`condition-node-${nodeId}`}
      state={state}
      error={error}
      isKeyboardFocused={data.isKeyboardFocused}
      toolbar={toolbar}
      sourceHandles={[]}
      cardClassName="min-w-[180px] px-3 py-2"
      cardStyle={{
        paddingBottom:
          branchCount > 1 ? `${(branchCount - 1) * 20 + 8}px` : undefined,
      }}
    >
      <div className="flex items-center gap-1.5">
        <GitBranch
          className="h-3.5 w-3.5 shrink-0 text-violet-400"
          aria-hidden
        />
        <span className="text-xs font-semibold text-foreground truncate">
          {variable || tChain("blockMenuConditionName")}
        </span>
        {state !== "idle" && (
          <div className="ml-auto shrink-0">
            <StateIcon state={state} />
          </div>
        )}
      </div>

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
                NODE_HANDLE_CLASS,
                isActive && "!border-emerald-500",
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
              {branch.label || (isElse ? CHAIN_HANDLE_IDS.ELSE : branch.id)}
            </span>
          </div>
        );
      })}
    </NodeShell>
  );
}

export const ConditionNode = memo(ConditionNodeInner);
