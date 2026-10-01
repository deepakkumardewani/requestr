import type { Node } from "@xyflow/react";
import { getChainDisplayName } from "@/lib/chainDisplayName";
import type { DeclaredNamespace } from "@/lib/chainValueNamespace";
import { getUnresolvedRequestVars } from "@/lib/resolveRequest";
import { isSubChainReferenceInvalid } from "@/lib/subChainGraph";
import type { CollectionModel, RequestModel } from "@/types";
import type {
  Chain,
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
import type { BuildBlockNode } from "./blockNodeFactory";

/** Node callbacks; each builder picks the ones its node renders. */
export type NodeHandlers = {
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
};

/** Everything a per-type builder reads; assembled once per rebuild by `useChainNodes`. */
export type NodeBuildContext = NodeHandlers & {
  build: BuildBlockNode;
  chainId: string;
  chains: Record<string, Chain>;
  collections: CollectionModel[];
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
  runState: ChainRunState;
  declaredNamespace: DeclaredNamespace;
  resolveVariables: (text: string) => string;
};

/** Raw (pre-resolution) text fields the variable footer scans for `{{var}}` references. */
function variableFooterTextsOf(req: RequestModel): string[] {
  return [
    req.url,
    ...req.headers.flatMap((h) => [h.key, h.value]),
    ...req.params.flatMap((p) => [p.key, p.value]),
    req.body.content ?? "",
  ];
}

type ApiVariableInfo = Pick<
  ChainNodeData,
  "unresolvedVars" | "variableFooterTexts" | "variableFooterResolvedNames"
>;

function apiVariableInfo(
  req: RequestModel,
  ctx: NodeBuildContext,
): ApiVariableInfo {
  const { runState, declaredNamespace, resolveVariables } = ctx;
  // Before the first run `unresolvedVars` doesn't exist yet — dry-run resolve
  // so the amber pill is accurate even pre-run.
  const unresolvedVars =
    runState[req.id]?.unresolvedVars ??
    getUnresolvedRequestVars(
      req,
      resolveVariables,
      declaredNamespace.chainInputs,
      declaredNamespace.aliasValues,
    );
  const variableFooterTexts = variableFooterTextsOf(req);
  const unresolved = new Set(unresolvedVars);
  const variableFooterResolvedNames = extractVariableRefs(
    variableFooterTexts,
  ).filter((name) => !unresolved.has(name));
  return { unresolvedVars, variableFooterTexts, variableFooterResolvedNames };
}

function buildApiNodes(ctx: NodeBuildContext): Node[] {
  const { requests, runState, declaredNamespace, resolveVariables } = ctx;
  const { onClickNode, onDeleteNode, onDuplicateNode, onRunNode } = ctx;
  const { onEditRequest } = ctx;
  return requests.map((req, index) => {
    const nodeState = runState[req.id];
    const variableInfo = apiVariableInfo(req, ctx);
    return ctx.build<ChainNodeData>({
      block: req,
      type: "api",
      index,
      deps: [
        onClickNode,
        onDeleteNode,
        onRunNode,
        onDuplicateNode,
        onEditRequest,
        resolveVariables,
        declaredNamespace,
      ],
      data: (common) => ({
        ...common,
        ...variableInfo,
        requestId: req.id,
        name: req.name,
        method: req.method,
        url: req.url,
        response: nodeState?.response,
        errorKind: nodeState?.errorKind,
        extractedValues: nodeState?.extractedValues,
        onClickNode,
        onDeleteNode,
        onDuplicateNode,
        onRunNode,
        onEditRequest,
      }),
    });
  });
}

function buildDelayNodes(ctx: NodeBuildContext): Node[] {
  const { onUpdateDelay, onDeleteNode } = ctx;
  return ctx.delayNodes.map((dn, index) =>
    ctx.build<DelayNodeData>({
      block: dn,
      type: "delay",
      index,
      deps: [onUpdateDelay, onDeleteNode],
      data: (common) => ({
        ...common,
        nodeId: dn.id,
        delayMs: dn.delayMs,
        onUpdateDelay,
        onDeleteNode,
      }),
    }),
  );
}

function buildConditionNodes(ctx: NodeBuildContext): Node[] {
  const { onDeleteNode, onConfigureNode, runState } = ctx;
  return ctx.conditionNodes.map((cn, index) =>
    ctx.build<ConditionNodeData>({
      block: cn,
      type: "condition",
      index,
      deps: [onDeleteNode, onConfigureNode],
      data: (common) => ({
        ...common,
        nodeId: cn.id,
        variable: cn.variable,
        branches: cn.branches,
        activeBranchId: runState[cn.id]?.activeBranchId,
        onDeleteNode,
        onConfigureNode,
      }),
    }),
  );
}

function buildDisplayNodes(ctx: NodeBuildContext): Node[] {
  const { chainEdges, requests, runState, onDeleteNode, onClickDisplayNode } =
    ctx;
  return ctx.displayNodes.map((dn, index) => {
    const inbound = chainEdges.find((e) => e.targetRequestId === dn.id);
    const sourceReq = inbound
      ? requests.find((r) => r.id === inbound.sourceRequestId)
      : undefined;
    const sourceResponse = sourceReq
      ? runState[sourceReq.id]?.response
      : undefined;
    return ctx.build<DisplayNodeData>({
      block: dn,
      type: "display",
      index,
      deps: [sourceResponse, onDeleteNode, onClickDisplayNode],
      data: (common) => ({
        ...common,
        nodeId: dn.id,
        config: dn,
        sourceResponse,
        onClickNode: onClickDisplayNode,
        onDeleteNode,
      }),
    });
  });
}

function buildEvaluateNodes(ctx: NodeBuildContext): Node[] {
  const { onDeleteNode, onConfigureEvaluateNode } = ctx;
  return ctx.evaluateNodes.map((en, index) =>
    ctx.build<EvaluateNodeData>({
      block: en,
      type: "evaluate",
      index,
      deps: [onDeleteNode, onConfigureEvaluateNode],
      data: (common) => ({
        ...common,
        nodeId: en.id,
        outputAlias: en.outputAlias,
        onDeleteNode,
        onConfigureNode: onConfigureEvaluateNode,
      }),
    }),
  );
}

function buildValidateNodes(ctx: NodeBuildContext): Node[] {
  const { onDeleteNode, onConfigureValidateNode } = ctx;
  return ctx.validateNodes.map((vn, index) =>
    ctx.build<ValidateNodeData>({
      block: vn,
      type: "validate",
      index,
      deps: [onDeleteNode, onConfigureValidateNode],
      data: (common) => ({
        ...common,
        nodeId: vn.id,
        sourceJsonPath: vn.sourceJsonPath,
        onDeleteNode,
        onConfigureNode: onConfigureValidateNode,
      }),
    }),
  );
}

function buildMergeNodes(ctx: NodeBuildContext): Node[] {
  const { onDeleteNode, onConfigureMergeNode } = ctx;
  return ctx.mergeNodes.map((mn, index) =>
    ctx.build<MergeNodeData>({
      block: mn,
      type: "merge",
      index,
      deps: [onDeleteNode, onConfigureMergeNode],
      data: (common) => ({
        ...common,
        nodeId: mn.id,
        mode: mn.mode,
        onDeleteNode,
        onConfigureNode: onConfigureMergeNode,
      }),
    }),
  );
}

function buildLoopNodes(ctx: NodeBuildContext): Node[] {
  const { onDeleteNode, onConfigureLoopNode } = ctx;
  return ctx.loopNodes.map((ln, index) =>
    ctx.build<LoopNodeData>({
      block: ln,
      type: "loop",
      index,
      deps: [onDeleteNode, onConfigureLoopNode],
      data: (common) => ({
        ...common,
        nodeId: ln.id,
        itemAlias: ln.itemAlias,
        maxIterations: ln.maxIterations,
        onDeleteNode,
        onConfigureNode: onConfigureLoopNode,
      }),
    }),
  );
}

function subChainReferenceInfo(
  sn: SubChainBlock,
  ctx: NodeBuildContext,
): Pick<SubChainNodeData, "chainName" | "isInvalid"> {
  const { chains, collections, chainId } = ctx;
  const referenced = chains[sn.chainId];
  return {
    chainName: referenced
      ? getChainDisplayName(referenced, collections)
      : undefined,
    isInvalid: isSubChainReferenceInvalid(chains, chainId, sn.chainId),
  };
}

function buildSubChainNodes(ctx: NodeBuildContext): Node[] {
  const { onDeleteNode, onConfigureSubChainNode, onChangeSubChainReference } =
    ctx;
  return ctx.subChainNodes.map((sn, index) => {
    const { chainName, isInvalid } = subChainReferenceInfo(sn, ctx);
    return ctx.build<SubChainNodeData>({
      block: sn,
      type: "subchain",
      index,
      deps: [
        chainName,
        isInvalid,
        onDeleteNode,
        onConfigureSubChainNode,
        onChangeSubChainReference,
      ],
      data: (common) => ({
        ...common,
        nodeId: sn.id,
        chainId: sn.chainId,
        chainName,
        isInvalid,
        onDeleteNode,
        onConfigureNode: onConfigureSubChainNode,
        onChangeReference: onChangeSubChainReference,
      }),
    });
  });
}

function buildCollectNodes(ctx: NodeBuildContext): Node[] {
  const { onDeleteNode, onConfigureCollectNode } = ctx;
  return ctx.collectNodes.map((cn, index) =>
    ctx.build<CollectNodeData>({
      block: cn,
      type: "collect",
      index,
      deps: [onDeleteNode, onConfigureCollectNode],
      data: (common) => ({
        ...common,
        nodeId: cn.id,
        loopId: cn.loopId,
        onDeleteNode,
        onConfigureNode: onConfigureCollectNode,
      }),
    }),
  );
}

function buildStartNodes({
  build,
  startBlock,
  onDeleteNode,
  onConfigureNode,
}: NodeBuildContext): Node[] {
  if (!startBlock) return [];
  return [
    build<StartNodeData>({
      block: startBlock,
      type: "start",
      index: 0,
      deps: [onDeleteNode, onConfigureNode],
      data: (common) => ({
        ...common,
        nodeId: startBlock.id,
        inputs: startBlock.inputs,
        onDeleteNode,
        onConfigureNode,
      }),
    }),
  ];
}

/** Every canvas node for the chain, in render order (Start first). */
export function buildAllNodes(ctx: NodeBuildContext): Node[] {
  return [
    ...buildStartNodes(ctx),
    ...buildApiNodes(ctx),
    ...buildDelayNodes(ctx),
    ...buildConditionNodes(ctx),
    ...buildDisplayNodes(ctx),
    ...buildEvaluateNodes(ctx),
    ...buildValidateNodes(ctx),
    ...buildMergeNodes(ctx),
    ...buildLoopNodes(ctx),
    ...buildCollectNodes(ctx),
    ...buildSubChainNodes(ctx),
  ];
}
