"use client";

import { Braces } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import type { ChainNodeState } from "@/types/chain";
import { NodeShell } from "./NodeShell";
import { useBlockNodeActions } from "./useNodeToolbarActions";

export type EvaluateNodeData = {
  nodeId: string;
  outputAlias: string;
  state: ChainNodeState;
  error?: string;
  onDeleteNode?: (nodeId: string) => void;
  onConfigureNode?: (nodeId: string) => void;
  isKeyboardFocused?: boolean;
};

function EvaluateNodeInner({ data }: { data: EvaluateNodeData }) {
  const t = useTranslations("chain");
  const { nodeId, outputAlias, state, error, onDeleteNode, onConfigureNode } =
    data;
  const toolbar = useBlockNodeActions({
    nodeId,
    onConfigureNode,
    onDeleteNode,
  });

  return (
    <NodeShell
      testId={`evaluate-node-${nodeId}`}
      state={state}
      error={error}
      isKeyboardFocused={data.isKeyboardFocused}
      toolbar={toolbar}
      icon={Braces}
      iconClassName="text-sky-400"
      title={t("blockMenuEvaluateName")}
      subtitle={outputAlias || t("evaluateNodeSubtitleUnset")}
    />
  );
}

export const EvaluateNode = memo(EvaluateNodeInner);
