"use client";

import { GitMerge } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import type { ChainNodeState, MergeBlock } from "@/types/chain";
import { NodeShell } from "./NodeShell";
import { useBlockNodeActions } from "./useNodeToolbarActions";

export type MergeNodeData = {
  nodeId: string;
  mode: MergeBlock["mode"];
  state: ChainNodeState;
  error?: string;
  onDeleteNode?: (nodeId: string) => void;
  onConfigureNode?: (nodeId: string) => void;
  isKeyboardFocused?: boolean;
};

function MergeNodeInner({ data }: { data: MergeNodeData }) {
  const t = useTranslations("chain");
  const { nodeId, mode, state, error, onDeleteNode, onConfigureNode } = data;
  const toolbar = useBlockNodeActions({
    nodeId,
    onConfigureNode,
    onDeleteNode,
  });

  return (
    <NodeShell
      testId={`merge-node-${nodeId}`}
      state={state}
      error={error}
      isKeyboardFocused={data.isKeyboardFocused}
      toolbar={toolbar}
      icon={GitMerge}
      iconClassName="text-violet-400"
      title={t("blockMenuMergeName")}
      subtitle={
        mode === "all" ? t("mergeNodeSubtitleAll") : t("mergeNodeSubtitleAny")
      }
    />
  );
}

export const MergeNode = memo(MergeNodeInner);
