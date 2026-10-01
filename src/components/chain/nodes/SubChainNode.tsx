"use client";

import { AlertTriangle, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import type { ChainNodeState } from "@/types/chain";
import { NodeShell } from "./NodeShell";
import { useBlockNodeActions } from "./useNodeToolbarActions";

export type SubChainNodeData = {
  nodeId: string;
  chainId: string;
  /** Display name of the referenced chain — undefined when it can't be resolved (e.g. deleted). */
  chainName?: string;
  /** True when the reference is deleted or participates in a cycle. */
  isInvalid?: boolean;
  state: ChainNodeState;
  error?: string;
  onDeleteNode?: (nodeId: string) => void;
  onConfigureNode?: (nodeId: string) => void;
  /** Opens the SubChainPicker to select or change the referenced chain. */
  onChangeReference?: (nodeId: string) => void;
  isKeyboardFocused?: boolean;
};

function SubChainNodeInner({ data }: { data: SubChainNodeData }) {
  const t = useTranslations("tooltips");
  const tc = useTranslations("chain");
  const {
    nodeId,
    chainId,
    chainName,
    isInvalid,
    state,
    error,
    onDeleteNode,
    onConfigureNode,
    onChangeReference,
  } = data;
  const blockActions = useBlockNodeActions({
    nodeId,
    onConfigureNode,
    onDeleteNode,
  });
  const toolbar = onChangeReference
    ? [
        {
          id: "change-reference",
          icon: Workflow,
          label: t("subChainChangeReference"),
          onClick: () => onChangeReference(nodeId),
        },
        ...blockActions,
      ]
    : blockActions;

  return (
    <NodeShell
      testId={`subchain-node-${nodeId}`}
      state={state}
      error={error}
      invalid={isInvalid}
      isKeyboardFocused={data.isKeyboardFocused}
      toolbar={toolbar}
      icon={Workflow}
      iconClassName="text-cyan-400"
      title={tc("subChainNodeLabel")}
      subtitle={chainName ?? (chainId || tc("subChainNodeNoReference"))}
      statusIcon={
        isInvalid ? (
          <span title={tc("subchainInvalidBannerMessage")}>
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
          </span>
        ) : undefined
      }
    />
  );
}

export const SubChainNode = memo(SubChainNodeInner);
