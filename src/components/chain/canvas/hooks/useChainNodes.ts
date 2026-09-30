import { type Node, useNodesState } from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import { getUnresolvedRequestVars } from "@/lib/resolveRequest";
import { useChainStore } from "@/stores/useChainStore";
import type { RequestModel } from "@/types";
import type {
  ChainEdge,
  ChainNodeState,
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
import type { ChainNodeData } from "../../nodes/ChainNode";
import type { CollectNodeData } from "../../nodes/CollectNode";
import type { ConditionNodeData } from "../../nodes/ConditionNode";
import type { DelayNodeData } from "../../nodes/DelayNode";
import type { DisplayNodeData } from "../../nodes/DisplayNode";
import type { EvaluateNodeData } from "../../nodes/EvaluateNode";
import type { LoopNodeData } from "../../nodes/LoopNode";
import type { MergeNodeData } from "../../nodes/MergeNode";
import { extractVariableRefs } from "../../nodes/NodeVariablesFooter";
import type { StartNodeData } from "../../nodes/StartNode";
import type { SubChainNodeData } from "../../nodes/SubChainNode";
import type { ValidateNodeData } from "../../nodes/ValidateNode";

/**
 * Returns a per-id memoization cache: `getOrBuild` reuses the previous node object
 * for an id as long as its own dependency values are unchanged (`Object.is` per slot),
 * so an unrelated run-state change never produces a new object for other nodes.
 */
function useNodeCache<T>() {
  const cache = useRef(new Map<string, { deps: unknown[]; node: T }>());
  return useMemo(
    () =>
      function getOrBuild(id: string, deps: unknown[], build: () => T): T {
        const cached = cache.current.get(id);
        if (
          cached &&
          cached.deps.length === deps.length &&
          cached.deps.every((d, i) => Object.is(d, deps[i]))
        ) {
          return cached.node;
        }
        const node = build();
        cache.current.set(id, { deps, node });
        return node;
      },
    [],
  );
}

type UseChainNodesParams = {
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
  startBlock: StartBlock | null;
  chainEdges: ChainEdge[];
  nodePositions: Record<string, { x: number; y: number }>;
  runState: ChainRunState;
  keyboardFocusNodeId: string | null;
  onClickNode: (requestId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRunNode?: (nodeId: string) => void;
  onDuplicateNode?: (requestId: string) => void;
  onEditRequest: (requestId: string) => void;
  onUpdateDelay: (id: string, delayMs: number) => void;
  onConfigureNode: (nodeId: string) => void;
  onConfigureEvaluateNode: (nodeId: string) => void;
  onConfigureValidateNode: (nodeId: string) => void;
  onConfigureMergeNode: (nodeId: string) => void;
  onConfigureLoopNode: (nodeId: string) => void;
  onConfigureCollectNode: (nodeId: string) => void;
  onConfigureSubChainNode: (nodeId: string) => void;
  onChangeSubChainReference: (nodeId: string) => void;
  onClickDisplayNode?: (nodeId: string) => void;
  resolveVariables: (text: string) => string;
};

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
  onClickNode,
  onDeleteNode,
  onRunNode,
  onDuplicateNode,
  onEditRequest,
  onUpdateDelay,
  onConfigureNode,
  onConfigureEvaluateNode,
  onConfigureValidateNode,
  onConfigureMergeNode,
  onConfigureLoopNode,
  onConfigureCollectNode,
  onConfigureSubChainNode,
  onChangeSubChainReference,
  onClickDisplayNode,
  resolveVariables,
}: UseChainNodesParams) {
  const chains = useChainStore((s) => s.chains);
  const apiCache = useNodeCache<Node<ChainNodeData>>();
  const delayCache = useNodeCache<Node<DelayNodeData>>();
  const conditionCache = useNodeCache<Node<ConditionNodeData>>();
  const displayCache = useNodeCache<Node<DisplayNodeData>>();
  const startCache = useNodeCache<Node<StartNodeData>>();
  const evaluateCache = useNodeCache<Node<EvaluateNodeData>>();
  const validateCache = useNodeCache<Node<ValidateNodeData>>();
  const mergeCache = useNodeCache<Node<MergeNodeData>>();
  const loopCache = useNodeCache<Node<LoopNodeData>>();
  const collectCache = useNodeCache<Node<CollectNodeData>>();
  const subChainCache = useNodeCache<Node<SubChainNodeData>>();

  const builtNodes = useMemo(() => {
    const isFocused = (id: string) => keyboardFocusNodeId === id;

    const apiNodes = requests.map((req, idx) => {
      const nodeState = runState[req.id];
      const focused = isFocused(req.id);
      // Before the first run, `nodeState.unresolvedVars` doesn't exist yet — fall back
      // to a dry-run resolve so the amber pill is accurate even pre-run.
      const unresolvedVars =
        nodeState?.unresolvedVars ??
        getUnresolvedRequestVars(req, resolveVariables);
      // Raw (pre-resolution) text fields the node's variable footer scans for
      // `{{var}}` references — same fields `getUnresolvedRequestVars` checks.
      const variableFooterTexts = [
        req.url,
        ...req.headers.flatMap((h) => [h.key, h.value]),
        ...req.params.flatMap((p) => [p.key, p.value]),
        req.body.content ?? "",
      ];
      const unresolvedSet = new Set(unresolvedVars);
      const variableFooterResolvedNames = extractVariableRefs(
        variableFooterTexts,
      ).filter((name) => !unresolvedSet.has(name));
      return apiCache(
        req.id,
        [
          req,
          nodePositions[req.id],
          nodeState,
          focused,
          onClickNode,
          onDeleteNode,
          onRunNode,
          onDuplicateNode,
          onEditRequest,
          resolveVariables,
        ],
        () => ({
          id: req.id,
          type: "chainNode",
          position: nodePositions[req.id] ?? { x: idx * 280 + 40, y: 120 },
          selected: focused,
          deletable: false,
          data: {
            requestId: req.id,
            name: req.name,
            method: req.method,
            url: req.url,
            state: (nodeState?.state ?? "idle") as ChainNodeState,
            response: nodeState?.response,
            error: nodeState?.error,
            errorKind: nodeState?.errorKind,
            extractedValues: nodeState?.extractedValues,
            unresolvedVars,
            variableFooterTexts,
            variableFooterResolvedNames,
            isKeyboardFocused: focused,
            onClickNode,
            onDeleteNode,
            onDuplicateNode,
            onRunNode,
            onEditRequest,
          },
        }),
      );
    });

    const delayNodesBuilt = delayNodes.map((dn, idx) => {
      const nodeState = runState[dn.id];
      const focused = isFocused(dn.id);
      return delayCache(
        dn.id,
        [
          dn,
          nodePositions[dn.id],
          nodeState,
          focused,
          onUpdateDelay,
          onDeleteNode,
        ],
        () => ({
          id: dn.id,
          type: "delayNode",
          position: nodePositions[dn.id] ?? { x: idx * 200 + 40, y: 260 },
          selected: focused,
          deletable: false,
          data: {
            nodeId: dn.id,
            delayMs: dn.delayMs,
            state: (nodeState?.state ?? "idle") as ChainNodeState,
            error: nodeState?.error,
            isKeyboardFocused: focused,
            onUpdateDelay,
            onDeleteNode,
          },
        }),
      );
    });

    const conditionNodesBuilt = conditionNodes.map((cn, idx) => {
      const nodeState = runState[cn.id];
      const focused = isFocused(cn.id);
      return conditionCache(
        cn.id,
        [
          cn,
          nodePositions[cn.id],
          nodeState,
          focused,
          onDeleteNode,
          onConfigureNode,
        ],
        () => ({
          id: cn.id,
          type: "conditionNode",
          position: nodePositions[cn.id] ?? { x: idx * 200 + 40, y: 400 },
          selected: focused,
          deletable: false,
          data: {
            nodeId: cn.id,
            variable: cn.variable,
            branches: cn.branches,
            state: (nodeState?.state ?? "idle") as ChainNodeState,
            activeBranchId: nodeState?.activeBranchId,
            error: nodeState?.error,
            isKeyboardFocused: focused,
            onDeleteNode,
            onConfigureNode,
          },
        }),
      );
    });

    const displayNodesBuilt = displayNodes.map((dn, idx) => {
      const nodeState = runState[dn.id];
      const focused = isFocused(dn.id);
      const inbound = chainEdges.find((e) => e.targetRequestId === dn.id);
      const sourceReq = inbound
        ? requests.find((r) => r.id === inbound.sourceRequestId)
        : undefined;
      const sourceResponse = sourceReq
        ? runState[sourceReq.id]?.response
        : undefined;
      return displayCache(
        dn.id,
        [
          dn,
          nodePositions[dn.id],
          nodeState,
          focused,
          sourceResponse,
          onDeleteNode,
          onClickDisplayNode,
        ],
        () => ({
          id: dn.id,
          type: "displayNode",
          position: nodePositions[dn.id] ?? { x: idx * 200 + 40, y: 320 },
          selected: focused,
          deletable: false,
          data: {
            nodeId: dn.id,
            config: dn,
            sourceResponse,
            state: (nodeState?.state ?? "idle") as ChainNodeState,
            error: nodeState?.error,
            isKeyboardFocused: focused,
            onClickNode: onClickDisplayNode,
            onDeleteNode,
          },
        }),
      );
    });

    const evaluateNodesBuilt = evaluateNodes.map((en, idx) => {
      const nodeState = runState[en.id];
      const focused = isFocused(en.id);
      return evaluateCache(
        en.id,
        [
          en,
          nodePositions[en.id],
          nodeState,
          focused,
          onDeleteNode,
          onConfigureEvaluateNode,
        ],
        () => ({
          id: en.id,
          type: "evaluateNode",
          position: nodePositions[en.id] ?? { x: idx * 200 + 40, y: 480 },
          selected: focused,
          deletable: false,
          data: {
            nodeId: en.id,
            outputAlias: en.outputAlias,
            state: (nodeState?.state ?? "idle") as ChainNodeState,
            error: nodeState?.error,
            isKeyboardFocused: focused,
            onDeleteNode,
            onConfigureNode: onConfigureEvaluateNode,
          },
        }),
      );
    });

    const validateNodesBuilt = validateNodes.map((vn, idx) => {
      const nodeState = runState[vn.id];
      const focused = isFocused(vn.id);
      return validateCache(
        vn.id,
        [
          vn,
          nodePositions[vn.id],
          nodeState,
          focused,
          onDeleteNode,
          onConfigureValidateNode,
        ],
        () => ({
          id: vn.id,
          type: "validateNode",
          position: nodePositions[vn.id] ?? { x: idx * 200 + 40, y: 560 },
          selected: focused,
          deletable: false,
          data: {
            nodeId: vn.id,
            sourceJsonPath: vn.sourceJsonPath,
            state: (nodeState?.state ?? "idle") as ChainNodeState,
            error: nodeState?.error,
            isKeyboardFocused: focused,
            onDeleteNode,
            onConfigureNode: onConfigureValidateNode,
          },
        }),
      );
    });

    const mergeNodesBuilt = mergeNodes.map((mn, idx) => {
      const nodeState = runState[mn.id];
      const focused = isFocused(mn.id);
      return mergeCache(
        mn.id,
        [
          mn,
          nodePositions[mn.id],
          nodeState,
          focused,
          onDeleteNode,
          onConfigureMergeNode,
        ],
        () => ({
          id: mn.id,
          type: "mergeNode",
          position: nodePositions[mn.id] ?? { x: idx * 200 + 40, y: 640 },
          selected: focused,
          deletable: false,
          data: {
            nodeId: mn.id,
            mode: mn.mode,
            state: (nodeState?.state ?? "idle") as ChainNodeState,
            error: nodeState?.error,
            isKeyboardFocused: focused,
            onDeleteNode,
            onConfigureNode: onConfigureMergeNode,
          },
        }),
      );
    });

    const loopNodesBuilt = loopNodes.map((ln: LoopBlock, idx: number) => {
      const nodeState = runState[ln.id];
      const focused = isFocused(ln.id);
      return loopCache(
        ln.id,
        [
          ln,
          nodePositions[ln.id],
          nodeState,
          focused,
          onDeleteNode,
          onConfigureLoopNode,
        ],
        () => ({
          id: ln.id,
          type: "loopNode",
          position: nodePositions[ln.id] ?? { x: idx * 200 + 40, y: 680 },
          selected: focused,
          deletable: false,
          data: {
            nodeId: ln.id,
            itemAlias: ln.itemAlias,
            maxIterations: ln.maxIterations,
            state: (nodeState?.state ?? "idle") as ChainNodeState,
            error: nodeState?.error,
            isKeyboardFocused: focused,
            onDeleteNode,
            onConfigureNode: onConfigureLoopNode,
          },
        }),
      );
    });

    // A placed subchain block is invalid when its reference is deleted, a
    // direct self-reference, or transitively reaches back to this chain.
    function isSubChainReferenceInvalid(targetChainId: string): boolean {
      if (!targetChainId) return true;
      if (targetChainId === chainId) return true;
      const visited = new Set<string>();
      function walk(id: string): boolean {
        if (visited.has(id)) return false;
        visited.add(id);
        const target = chains[id];
        if (!target) return false;
        for (const block of target.blocks) {
          if (block.type !== "subchain") continue;
          if (block.chainId === chainId) return true;
          if (walk(block.chainId)) return true;
        }
        return false;
      }
      return !(targetChainId in chains) || walk(targetChainId);
    }

    const subChainNodesBuilt = subChainNodes.map(
      (sn: SubChainBlock, idx: number) => {
        const nodeState = runState[sn.id];
        const focused = isFocused(sn.id);
        const referencedChain = chains[sn.chainId];
        const isInvalid = isSubChainReferenceInvalid(sn.chainId);
        return subChainCache(
          sn.id,
          [
            sn,
            nodePositions[sn.id],
            nodeState,
            focused,
            referencedChain?.name,
            isInvalid,
            onDeleteNode,
            onConfigureSubChainNode,
            onChangeSubChainReference,
          ],
          () => ({
            id: sn.id,
            type: "subchainNode",
            position: nodePositions[sn.id] ?? { x: idx * 200 + 40, y: 760 },
            selected: focused,
            deletable: false,
            data: {
              nodeId: sn.id,
              chainId: sn.chainId,
              chainName: referencedChain?.name,
              isInvalid,
              state: (nodeState?.state ?? "idle") as ChainNodeState,
              error: nodeState?.error,
              isKeyboardFocused: focused,
              onDeleteNode,
              onConfigureNode: onConfigureSubChainNode,
              onChangeReference: onChangeSubChainReference,
            },
          }),
        );
      },
    );

    const collectNodesBuilt = collectNodes.map(
      (cn: CollectBlock, idx: number) => {
        const nodeState = runState[cn.id];
        const focused = isFocused(cn.id);
        return collectCache(
          cn.id,
          [
            cn,
            nodePositions[cn.id],
            nodeState,
            focused,
            onDeleteNode,
            onConfigureCollectNode,
          ],
          () => ({
            id: cn.id,
            type: "collectNode",
            position: nodePositions[cn.id] ?? { x: idx * 200 + 40, y: 720 },
            selected: focused,
            deletable: false,
            data: {
              nodeId: cn.id,
              loopId: cn.loopId,
              state: (nodeState?.state ?? "idle") as ChainNodeState,
              error: nodeState?.error,
              isKeyboardFocused: focused,
              onDeleteNode,
              onConfigureNode: onConfigureCollectNode,
            },
          }),
        );
      },
    );

    const startNodeBuilt = startBlock
      ? startCache(
          startBlock.id,
          [
            startBlock,
            nodePositions[startBlock.id],
            runState[startBlock.id],
            isFocused(startBlock.id),
            onDeleteNode,
            onConfigureNode,
          ],
          () => ({
            id: startBlock.id,
            type: "startNode",
            // Placed above the main request row (y: 120) so it never collides
            // with the first API node's default position.
            position: nodePositions[startBlock.id] ?? { x: 40, y: -140 },
            selected: isFocused(startBlock.id),
            deletable: false,
            data: {
              nodeId: startBlock.id,
              inputs: startBlock.inputs,
              state: (runState[startBlock.id]?.state ??
                "idle") as ChainNodeState,
              error: runState[startBlock.id]?.error,
              isKeyboardFocused: isFocused(startBlock.id),
              onDeleteNode,
              onConfigureNode,
            },
          }),
        )
      : null;

    return [
      ...(startNodeBuilt ? [startNodeBuilt] : []),
      ...apiNodes,
      ...delayNodesBuilt,
      ...conditionNodesBuilt,
      ...displayNodesBuilt,
      ...evaluateNodesBuilt,
      ...validateNodesBuilt,
      ...mergeNodesBuilt,
      ...loopNodesBuilt,
      ...collectNodesBuilt,
      ...subChainNodesBuilt,
    ] as Node[];
  }, [
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
    chains,
    startBlock,
    chainEdges,
    nodePositions,
    runState,
    keyboardFocusNodeId,
    onClickNode,
    onDeleteNode,
    onRunNode,
    onDuplicateNode,
    onEditRequest,
    onUpdateDelay,
    onConfigureNode,
    onConfigureEvaluateNode,
    onConfigureValidateNode,
    onConfigureMergeNode,
    onConfigureLoopNode,
    onConfigureCollectNode,
    onConfigureSubChainNode,
    onChangeSubChainReference,
    onClickDisplayNode,
    resolveVariables,
    apiCache,
    delayCache,
    conditionCache,
    displayCache,
    startCache,
    evaluateCache,
    validateCache,
    mergeCache,
    loopCache,
    collectCache,
    subChainCache,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(builtNodes);

  useEffect(() => {
    setNodes(builtNodes);
  }, [builtNodes, setNodes]);

  return { nodes, setNodes, onNodesChange } as const;
}
