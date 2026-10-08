import { type Node, useNodesState } from "@xyflow/react";
import { useEffect, useMemo } from "react";
import { useChainErrorMessage } from "@/hooks/useChainErrorMessage";
import { collectDeclaredNamespace } from "@/lib/chainValueNamespace";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import type { RequestModel } from "@/types";
import type {
  ChainEdge,
  ChainRunState,
  CollectBlock,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayBlock,
  EvaluateBlock,
  LoopBlock,
  MergeBlock,
  StartBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";
import { createBlockNodeBuilder } from "./blockNodeFactory";
import { buildAllNodes, type NodeHandlers } from "./chainNodeBuilders";
import { useNodeCache } from "./useNodeCache";

type UseChainNodesParams = NodeHandlers & {
  chainId: string;
  requests: RequestModel[];
  delayNodes: DelayNodeConfig[];
  conditionNodes: ConditionNodeConfig[];
  displayNodes: DisplayBlock[];
  evaluateNodes: EvaluateBlock[];
  validateNodes: ValidateBlock[];
  mergeNodes: MergeBlock[];
  loopNodes: LoopBlock[];
  collectNodes: CollectBlock[];
  subChainNodes: SubChainBlock[];
  startBlock?: StartBlock | null;
  chainEdges: ChainEdge[];
  nodePositions: Record<string, { x: number; y: number }>;
  runState: ChainRunState;
  keyboardFocusNodeId: string | null;
  resolveVariables: (text: string) => string;
};

type DeclaredNamespaceSources = Pick<
  UseChainNodesParams,
  "displayNodes" | "evaluateNodes" | "loopNodes" | "startBlock" | "chainEdges"
>;

/**
 * Names upstream blocks/edges will define at run time, so the pre-run pill
 * doesn't flag `{{alias}}`/chain-input references as unresolved.
 */
function useDeclaredNamespace({
  displayNodes,
  evaluateNodes,
  loopNodes,
  startBlock,
  chainEdges,
}: DeclaredNamespaceSources) {
  return useMemo(
    () =>
      collectDeclaredNamespace(
        [
          ...displayNodes,
          ...evaluateNodes,
          ...loopNodes,
          ...(startBlock ? [startBlock] : []),
        ],
        chainEdges,
      ),
    [displayNodes, evaluateNodes, loopNodes, startBlock, chainEdges],
  );
}

/** Builds React Flow nodes from the current chain data + `ChainRunState`. */
export function useChainNodes({
  chainId,
  requests,
  delayNodes,
  conditionNodes,
  displayNodes,
  evaluateNodes,
  validateNodes,
  mergeNodes,
  loopNodes,
  collectNodes,
  subChainNodes,
  startBlock,
  chainEdges,
  nodePositions,
  runState,
  keyboardFocusNodeId,
  resolveVariables,
  onClickNode,
  onDeleteNode,
  onRunNode,
  onDuplicateNode,
  onEditRequest,
  onUpdateDelay,
  onConfigureNode,
  onConfigureConditionNode,
  onConfigureEvaluateNode,
  onConfigureValidateNode,
  onConfigureMergeNode,
  onConfigureLoopNode,
  onConfigureCollectNode,
  onConfigureSubChainNode,
  onChangeSubChainReference,
  onClickDisplayNode,
}: UseChainNodesParams) {
  const chains = useChainStore((s) => s.chains);
  const collections = useCollectionsStore((s) => s.collections);
  // Ids are unique across block types, so one cache serves every builder.
  const nodeCache = useNodeCache<Node>();
  const chainErrorMessage = useChainErrorMessage();

  const declaredNamespace = useDeclaredNamespace({
    displayNodes,
    evaluateNodes,
    loopNodes,
    startBlock,
    chainEdges,
  });

  const builtNodes = useMemo(
    () =>
      buildAllNodes({
        chainId,
        requests,
        delayNodes,
        conditionNodes,
        displayNodes,
        evaluateNodes,
        validateNodes,
        mergeNodes,
        loopNodes,
        collectNodes,
        subChainNodes,
        startBlock,
        chainEdges,
        runState,
        resolveVariables,
        onClickNode,
        onDeleteNode,
        onRunNode,
        onDuplicateNode,
        onEditRequest,
        onUpdateDelay,
        onConfigureNode,
        onConfigureConditionNode,
        onConfigureEvaluateNode,
        onConfigureValidateNode,
        onConfigureMergeNode,
        onConfigureLoopNode,
        onConfigureCollectNode,
        onConfigureSubChainNode,
        onChangeSubChainReference,
        onClickDisplayNode,
        chains,
        collections,
        declaredNamespace,
        build: createBlockNodeBuilder({
          runState,
          nodePositions,
          keyboardFocusNodeId,
          chainErrorMessage,
          nodeCache,
        }),
      }),
    [
      chainId,
      requests,
      delayNodes,
      conditionNodes,
      displayNodes,
      evaluateNodes,
      validateNodes,
      mergeNodes,
      loopNodes,
      collectNodes,
      subChainNodes,
      startBlock,
      chainEdges,
      nodePositions,
      runState,
      keyboardFocusNodeId,
      resolveVariables,
      onClickNode,
      onDeleteNode,
      onRunNode,
      onDuplicateNode,
      onEditRequest,
      onUpdateDelay,
      onConfigureNode,
      onConfigureConditionNode,
      onConfigureEvaluateNode,
      onConfigureValidateNode,
      onConfigureMergeNode,
      onConfigureLoopNode,
      onConfigureCollectNode,
      onConfigureSubChainNode,
      onChangeSubChainReference,
      onClickDisplayNode,
      chains,
      collections,
      declaredNamespace,
      chainErrorMessage,
      nodeCache,
    ],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(builtNodes);

  // Rebuilds (e.g. after a nudge or drag persists positions) must keep the
  // selection, otherwise repeated arrow nudges stop after the first press.
  // They must also keep `measured`, or React Flow warns #015 on the next move.
  useEffect(() => {
    setNodes((prev) => {
      const previousById = new Map(prev.map((node) => [node.id, node]));
      const selectedIds = new Set(
        prev.filter((node) => node.selected).map((node) => node.id),
      );
      let changed = false;
      const next = builtNodes.map((node) => {
        const prior = previousById.get(node.id);
        const selected = node.selected || selectedIds.has(node.id);
        const measured =
          typeof prior?.measured?.width === "number"
            ? prior.measured
            : undefined;
        if (selected === node.selected && !measured) return node;
        changed = true;
        return {
          ...node,
          selected,
          ...(measured ? { measured } : {}),
        };
      });
      return changed ? next : builtNodes;
    });
  }, [builtNodes, setNodes]);

  return { nodes, setNodes, onNodesChange } as const;
}
