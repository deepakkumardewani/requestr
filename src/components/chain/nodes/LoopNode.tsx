"use client";

import { Position } from "@xyflow/react";
import { Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import {
  type ChainNodeState,
  LOOP_BODY_HANDLE_ID,
  LOOP_DONE_HANDLE_ID,
} from "@/types/chain";
import { type NodeHandleSpec, NodeShell } from "./NodeShell";
import { useBlockNodeActions } from "./useNodeToolbarActions";

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

const LOOP_SOURCE_HANDLES: NodeHandleSpec[] = [
  { id: LOOP_BODY_HANDLE_ID, position: Position.Bottom },
  { id: LOOP_DONE_HANDLE_ID, position: Position.Right },
];

function LoopNodeInner({ data }: { data: LoopNodeData }) {
  const t = useTranslations("chain");
  const {
    nodeId,
    itemAlias,
    maxIterations,
    state,
    error,
    pairedCollectLabel,
    onDeleteNode,
    onConfigureNode,
  } = data;
  const toolbar = useBlockNodeActions({
    nodeId,
    onConfigureNode,
    onDeleteNode,
  });

  return (
    <NodeShell
      testId={`loop-node-${nodeId}`}
      state={state}
      error={error}
      isKeyboardFocused={data.isKeyboardFocused}
      toolbar={toolbar}
      sourceHandles={LOOP_SOURCE_HANDLES}
      icon={Repeat}
      iconClassName="text-violet-400"
      title={t("blockMenuLoopName")}
      subtitle={
        itemAlias
          ? t("loopNodeSubtitleWithAlias", {
              alias: itemAlias,
              max: maxIterations,
            })
          : t("loopNodeSubtitleNoAlias", { max: maxIterations })
      }
      detail={
        pairedCollectLabel && (
          <span className="block text-[9px] text-emerald-400 truncate">
            → {pairedCollectLabel}
          </span>
        )
      }
    />
  );
}

export const LoopNode = memo(LoopNodeInner);
