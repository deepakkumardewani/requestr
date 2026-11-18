"use client";

import { ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import type { ChainNodeState } from "@/types/chain";
import { NodeShell } from "./NodeShell";
import { useBlockNodeActions } from "./useNodeToolbarActions";

export type CollectNodeData = {
  nodeId: string;
  loopId: string;
  /** Display label of the bound Loop block — shows the pairing on this node. */
  loopLabel?: string;
  state: ChainNodeState;
  error?: string;
  onDeleteNode?: (nodeId: string) => void;
  onConfigureNode?: (nodeId: string) => void;
  isKeyboardFocused?: boolean;
};

function CollectNodeInner({ data }: { data: CollectNodeData }) {
  const t = useTranslations("chain");
  const {
    nodeId,
    loopId,
    loopLabel,
    state,
    error,
    onDeleteNode,
    onConfigureNode,
  } = data;
  const toolbar = useBlockNodeActions({
    nodeId,
    onConfigureNode,
    onDeleteNode,
  });
  const pairing = loopLabel || loopId;

  return (
    <NodeShell
      testId={`collect-node-${nodeId}`}
      state={state}
      error={error}
      isKeyboardFocused={data.isKeyboardFocused}
      toolbar={toolbar}
      icon={ListChecks}
      iconClassName="text-violet-400"
      title={t("blockMenuCollectName")}
      subtitle={
        pairing
          ? t("collectNodeSubtitlePaired", { loop: pairing })
          : t("collectNodeSubtitleUnpaired")
      }
    />
  );
}

export const CollectNode = memo(CollectNodeInner);
