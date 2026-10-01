"use client";

import { Handle, Position } from "@xyflow/react";
import { Rocket } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import type { ChainInput, ChainNodeState } from "@/types/chain";
import { NodeShell } from "./NodeShell";
import { NODE_HANDLE_CLASS, StateIcon } from "./nodeStateStyles";
import { useBlockNodeActions } from "./useNodeToolbarActions";

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
  const { nodeId, inputs, state, error, onDeleteNode, onConfigureNode } = data;
  const toolbar = useBlockNodeActions({
    nodeId,
    onConfigureNode,
    onDeleteNode,
    labels: {
      configure: t("configureStart"),
      remove: t("removeStartFromChain"),
    },
  });
  const inputCount = inputs.length;

  return (
    <NodeShell
      testId={`start-node-${nodeId}`}
      state={state}
      error={error}
      isKeyboardFocused={data.isKeyboardFocused}
      toolbar={toolbar}
      hasTargetHandle={false}
      sourceHandles={[]}
      cardClassName="min-w-[180px] px-3 py-2"
      cardStyle={{
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

      {inputs.map((input, i) => {
        const topPct = ((i + 1) / (inputCount + 1)) * 100;
        return (
          <div key={input.key}>
            <Handle
              id={input.key}
              type="source"
              position={Position.Right}
              style={{ top: `${topPct}%` }}
              className={NODE_HANDLE_CLASS}
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
    </NodeShell>
  );
}

export const StartNode = memo(StartNodeInner);
