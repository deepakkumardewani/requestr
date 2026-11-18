"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import type { ChainNodeState } from "@/types/chain";
import { NodeShell } from "./NodeShell";
import { useBlockNodeActions } from "./useNodeToolbarActions";

export type ValidateNodeData = {
  nodeId: string;
  sourceJsonPath: string;
  state: ChainNodeState;
  error?: string;
  onDeleteNode?: (nodeId: string) => void;
  onConfigureNode?: (nodeId: string) => void;
  isKeyboardFocused?: boolean;
};

function ValidateNodeInner({ data }: { data: ValidateNodeData }) {
  const t = useTranslations("chain");
  const {
    nodeId,
    sourceJsonPath,
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

  return (
    <NodeShell
      testId={`validate-node-${nodeId}`}
      state={state}
      error={error}
      isKeyboardFocused={data.isKeyboardFocused}
      toolbar={toolbar}
      icon={ShieldCheck}
      iconClassName="text-emerald-400"
      title={t("blockMenuValidateName")}
      subtitle={sourceJsonPath || t("validateNodeSubtitleWholeResponse")}
    />
  );
}

export const ValidateNode = memo(ValidateNodeInner);
