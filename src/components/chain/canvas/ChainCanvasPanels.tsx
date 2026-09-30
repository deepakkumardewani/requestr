import { lazy, Suspense } from "react";
import { useChainStore } from "@/stores/useChainStore";
import type { RequestModel, ResponseData } from "@/types";
import type {
  ChainAssertion,
  ChainEdge,
  ChainNodeState,
  ChainRunState,
  CollectBlock,
  ConditionNodeConfig,
  DisplayBlock,
  EnvPromotion,
  EvaluateBlock,
  LoopBlock,
  MergeBlock,
  StartBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";
import { ArrowConfigPanel } from "../panels/ArrowConfigPanel";
import { NodeDetailsPanel } from "../panels/NodeDetailsPanel";
import type { ContextMenuState } from "./ChainCanvas.types";
import { NodeContextMenu } from "./NodeContextMenu";

const EditRequestPanel = lazy(() =>
  import("../panels/EditRequestPanel").then((m) => ({
    default: m.EditRequestPanel,
  })),
);
const ConditionConfigPanel = lazy(() =>
  import("../panels/ConditionConfigPanel").then((m) => ({
    default: m.ConditionConfigPanel,
  })),
);
const StartConfigPanel = lazy(() =>
  import("../panels/StartConfigPanel").then((m) => ({
    default: m.StartConfigPanel,
  })),
);
const EvaluateConfigPanel = lazy(() =>
  import("../panels/EvaluateConfigPanel").then((m) => ({
    default: m.EvaluateConfigPanel,
  })),
);
const ValidateConfigPanel = lazy(() =>
  import("../panels/ValidateConfigPanel").then((m) => ({
    default: m.ValidateConfigPanel,
  })),
);
const MergeConfigPanel = lazy(() =>
  import("../panels/MergeConfigPanel").then((m) => ({
    default: m.MergeConfigPanel,
  })),
);
const LoopConfigPanel = lazy(() =>
  import("../panels/LoopConfigPanel").then((m) => ({
    default: m.LoopConfigPanel,
  })),
);
const CollectConfigPanel = lazy(() =>
  import("../panels/CollectConfigPanel").then((m) => ({
    default: m.CollectConfigPanel,
  })),
);
const SubChainConfigPanel = lazy(() =>
  import("../panels/SubChainConfigPanel").then((m) => ({
    default: m.SubChainConfigPanel,
  })),
);

type ChainCanvasPanelsProps = {
  contextMenu: ContextMenuState | null;
  onCloseContextMenu: () => void;
  onAddAfterNode: (requestId: string) => void;
  onRunUpTo: (requestId: string) => void;
  onRunFromHere: (requestId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onOpenConditionPanel: (nodeId: string) => void;
  onOpenDisplayNodeConfig: (nodeId: string) => void;

  editRequestId: string | null;
  requests: RequestModel[];
  onCloseEditRequest: () => void;
  onSaveRequest: (id: string, patch: Partial<RequestModel>) => void;

  nodeDetailOpen: boolean;
  onCloseDetails: () => void;
  selectedRequest: RequestModel | null;
  selectedState: ChainRunState[string] | null;
  selectedNodeId: string | null;
  nodeAssertions: Record<string, ChainAssertion[]>;
  onUpsertNodeAssertions: (
    requestId: string,
    assertions: ChainAssertion[],
  ) => void;
  canSaveBody: boolean;
  chainEdges: ChainEdge[];
  envPromotions?: EnvPromotion[];
  onSavePromotion?: (promotion: EnvPromotion) => void;
  onRemovePromotion?: (edgeId: string) => void;

  conditionPanelNodeId: string | null;
  conditionPanelNode: ConditionNodeConfig | null;
  onCloseConditionPanel: () => void;
  onUpsertConditionNode: (node: ConditionNodeConfig) => void;
  onRemoveConditionNode: (nodeId: string) => void;

  arrowConfigPanelOpen: boolean;
  selectedEdgeId: string | null;
  selectedDisplayNodeId: string | null;
  onCloseArrowConfigPanel: () => void;
  onUpsertEdge: (edge: ChainEdge) => void;
  onDeleteEdge: (edgeId: string) => void;
  displayNodes: DisplayBlock[];
  onUpsertDisplayNode: (node: DisplayBlock) => void;
  startBlock: StartBlock | null;
  startConfigPanelNodeId: string | null;
  onCloseStartConfigPanel: () => void;
  onUpsertStartBlock: (node: StartBlock) => void;
  onRemoveStartBlock: (nodeId: string) => void;
  onRunSource?: (nodeId: string) => void;
  runState: ChainRunState;

  evaluateNodes: EvaluateBlock[];
  evaluatePanelNodeId: string | null;
  onOpenEvaluatePanel: (nodeId: string) => void;
  onCloseEvaluatePanel: () => void;
  onUpsertEvaluateNode: (node: EvaluateBlock) => void;

  validateNodes: ValidateBlock[];
  validatePanelNodeId: string | null;
  onOpenValidatePanel: (nodeId: string) => void;
  onCloseValidatePanel: () => void;
  onUpsertValidateNode: (node: ValidateBlock) => void;

  mergeNodes: MergeBlock[];
  mergePanelNodeId: string | null;
  onOpenMergePanel: (nodeId: string) => void;
  onCloseMergePanel: () => void;
  onUpsertMergeNode: (node: MergeBlock) => void;

  loopNodes: LoopBlock[];
  loopPanelNodeId: string | null;
  onOpenLoopPanel: (nodeId: string) => void;
  onCloseLoopPanel: () => void;
  onUpsertLoopNode: (node: LoopBlock) => void;

  collectNodes: CollectBlock[];
  collectPanelNodeId: string | null;
  onOpenCollectPanel: (nodeId: string) => void;
  onCloseCollectPanel: () => void;
  onUpsertCollectNode: (node: CollectBlock) => void;

  subChainNodes: SubChainBlock[];
  subChainPanelNodeId: string | null;
  onOpenSubChainPanel: (nodeId: string) => void;
  onCloseSubChainPanel: () => void;
  onUpsertSubChainNode: (node: SubChainBlock) => void;
};

/** Renders the floating overlays for ChainCanvas: context menu, edit-request, node-details, and condition-config panels. */
export function ChainCanvasPanels({
  contextMenu,
  onCloseContextMenu,
  onAddAfterNode,
  onRunUpTo,
  onRunFromHere,
  onDeleteNode,
  onOpenConditionPanel,
  onOpenDisplayNodeConfig,
  editRequestId,
  requests,
  onCloseEditRequest,
  onSaveRequest,
  nodeDetailOpen,
  onCloseDetails,
  selectedRequest,
  selectedState,
  selectedNodeId,
  nodeAssertions,
  onUpsertNodeAssertions,
  canSaveBody,
  chainEdges,
  envPromotions,
  onSavePromotion,
  onRemovePromotion,
  conditionPanelNodeId,
  conditionPanelNode,
  onCloseConditionPanel,
  onUpsertConditionNode,
  onRemoveConditionNode,
  arrowConfigPanelOpen,
  selectedEdgeId,
  selectedDisplayNodeId,
  onCloseArrowConfigPanel,
  onUpsertEdge,
  onDeleteEdge,
  displayNodes,
  onUpsertDisplayNode,
  startBlock,
  startConfigPanelNodeId,
  onCloseStartConfigPanel,
  onUpsertStartBlock,
  onRemoveStartBlock,
  onRunSource,
  runState,
  evaluateNodes,
  evaluatePanelNodeId,
  onOpenEvaluatePanel,
  onCloseEvaluatePanel,
  onUpsertEvaluateNode,
  validateNodes,
  validatePanelNodeId,
  onOpenValidatePanel,
  onCloseValidatePanel,
  onUpsertValidateNode,
  mergeNodes,
  mergePanelNodeId,
  onOpenMergePanel,
  onCloseMergePanel,
  onUpsertMergeNode,
  loopNodes,
  loopPanelNodeId,
  onOpenLoopPanel,
  onCloseLoopPanel,
  onUpsertLoopNode,
  collectNodes,
  collectPanelNodeId,
  onOpenCollectPanel,
  onCloseCollectPanel,
  onUpsertCollectNode,
  subChainNodes,
  subChainPanelNodeId,
  onOpenSubChainPanel,
  onCloseSubChainPanel,
  onUpsertSubChainNode,
}: ChainCanvasPanelsProps) {
  const editRequest = requests.find((r) => r.id === editRequestId) ?? null;
  const chains = useChainStore((s) => s.chains);

  const subChainPanelNode = subChainPanelNodeId
    ? (subChainNodes.find((n) => n.id === subChainPanelNodeId) ?? null)
    : null;
  const referencedChain = subChainPanelNode
    ? chains[subChainPanelNode.chainId]
    : undefined;
  const referencedChainInputs =
    referencedChain?.blocks.find((b) => b.type === "start")?.inputs ?? [];

  // Resolve ArrowConfigPanel data for edge mode
  const selectedEdge = selectedEdgeId
    ? (chainEdges.find((e) => e.id === selectedEdgeId) ?? null)
    : null;
  const arrowSourceRequest = selectedEdge
    ? (requests.find((r) => r.id === selectedEdge.sourceRequestId) ?? null)
    : null;
  const arrowTargetRequest = selectedEdge
    ? (requests.find((r) => r.id === selectedEdge.targetRequestId) ?? null)
    : null;
  // Keyed by the edge's own source request — not `selectedState`, which
  // only reflects whichever node's details panel was last opened and is
  // unrelated to which edge's config panel is currently showing.
  const arrowSourceRunState = arrowSourceRequest
    ? (runState[arrowSourceRequest.id]?.state as ChainNodeState)
    : undefined;
  const arrowSourceResponse = arrowSourceRequest
    ? (runState[arrowSourceRequest.id]?.response as ResponseData)
    : undefined;

  // Resolve ArrowConfigPanel data for display node mode
  const selectedDisplayNode = selectedDisplayNodeId
    ? (displayNodes.find((n) => n.id === selectedDisplayNodeId) ?? null)
    : null;
  const displayNodeSourceEdge = selectedDisplayNode
    ? chainEdges.find((e) => e.targetRequestId === selectedDisplayNode.id)
    : null;
  const displayNodeSourceRequest = displayNodeSourceEdge
    ? (requests.find((r) => r.id === displayNodeSourceEdge.sourceRequestId) ??
      null)
    : null;
  const displayNodeSourceRunState = displayNodeSourceRequest
    ? (runState[displayNodeSourceRequest.id]?.state as ChainNodeState)
    : undefined;
  const displayNodeSourceResponse = displayNodeSourceRequest
    ? (runState[displayNodeSourceRequest.id]?.response as ResponseData)
    : undefined;

  // Resolve LoopConfigPanel's JSONPath explorer data from the Loop's upstream response
  const loopSourceEdge = loopPanelNodeId
    ? chainEdges.find((e) => e.targetRequestId === loopPanelNodeId)
    : null;
  const loopSourceRequest = loopSourceEdge
    ? (requests.find((r) => r.id === loopSourceEdge.sourceRequestId) ?? null)
    : null;
  const loopSourceResponseBody = loopSourceRequest
    ? (runState[loopSourceRequest.id]?.response as ResponseData | undefined)
        ?.body
    : undefined;

  return (
    <>
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          requestId={contextMenu.nodeId}
          nodeType={contextMenu.nodeType}
          onClose={onCloseContextMenu}
          onAddAfter={onAddAfterNode}
          onRunUpTo={onRunUpTo}
          onRunFromHere={onRunFromHere}
          onDelete={onDeleteNode}
          onDuplicate={(nodeId: string) => {
            // Handle duplication for Display/Evaluate/Validate/Merge nodes
            const displayNode = displayNodes.find((n) => n.id === nodeId);
            const evaluateNode = evaluateNodes.find((n) => n.id === nodeId);
            const validateNode = validateNodes.find((n) => n.id === nodeId);
            const mergeNode = mergeNodes.find((n) => n.id === nodeId);
            const subChainNode = subChainNodes.find((n) => n.id === nodeId);
            if (displayNode) {
              // Duplicate display node with new id
              const newDisplayNode: DisplayBlock = {
                ...displayNode,
                id: `display-${Date.now()}`,
              };
              onUpsertDisplayNode(newDisplayNode);
            } else if (evaluateNode) {
              onUpsertEvaluateNode({
                ...evaluateNode,
                id: `evaluate-${Date.now()}`,
              });
            } else if (validateNode) {
              onUpsertValidateNode({
                ...validateNode,
                id: `validate-${Date.now()}`,
              });
            } else if (mergeNode) {
              onUpsertMergeNode({
                ...mergeNode,
                id: `merge-${Date.now()}`,
              });
            } else if (subChainNode) {
              // Duplicating a sub-chain block copies the reference (chainId +
              // bindings), never the referenced chain itself.
              onUpsertSubChainNode({
                ...subChainNode,
                id: `subchain-${Date.now()}`,
              });
            }
            onCloseContextMenu();
          }}
          onConfigure={(nodeId: string) => {
            // Handle configure per node type
            if (contextMenu.nodeType === "display") {
              // Open arrow config panel for display node
              onOpenDisplayNodeConfig(nodeId);
            } else if (contextMenu.nodeType === "condition") {
              // Open condition config panel
              onOpenConditionPanel(nodeId);
            } else if (contextMenu.nodeType === "evaluate") {
              onOpenEvaluatePanel(nodeId);
            } else if (contextMenu.nodeType === "validate") {
              onOpenValidatePanel(nodeId);
            } else if (contextMenu.nodeType === "merge") {
              onOpenMergePanel(nodeId);
            } else if (contextMenu.nodeType === "loop") {
              onOpenLoopPanel(nodeId);
            } else if (contextMenu.nodeType === "collect") {
              onOpenCollectPanel(nodeId);
            } else if (contextMenu.nodeType === "subchain") {
              onOpenSubChainPanel(nodeId);
            }
            onCloseContextMenu();
          }}
        />
      )}

      {editRequest && (
        <Suspense fallback={null}>
          <EditRequestPanel
            open
            onClose={onCloseEditRequest}
            request={editRequest}
            onSave={(updated) => {
              onSaveRequest(editRequest.id, updated);
            }}
          />
        </Suspense>
      )}

      <NodeDetailsPanel
        open={nodeDetailOpen}
        onClose={onCloseDetails}
        name={selectedRequest?.name ?? ""}
        method={selectedRequest?.method ?? "GET"}
        url={selectedRequest?.url ?? ""}
        state={selectedState?.state ?? "idle"}
        response={selectedState?.response}
        extractedValues={selectedState?.extractedValues}
        error={selectedState?.error}
        assertionResults={selectedState?.assertionResults}
        assertions={
          selectedNodeId ? (nodeAssertions[selectedNodeId] ?? []) : []
        }
        onAssertionsChange={
          selectedNodeId
            ? (updated) => onUpsertNodeAssertions(selectedNodeId, updated)
            : undefined
        }
        bodyContent={selectedRequest?.body?.content ?? ""}
        onSaveBody={
          canSaveBody && selectedRequest
            ? (body) => {
                onSaveRequest(selectedRequest.id, {
                  body: { ...selectedRequest.body, content: body },
                });
              }
            : undefined
        }
        envPromotions={envPromotions}
        onSavePromotion={onSavePromotion}
        onRemovePromotion={onRemovePromotion}
      />

      <Suspense fallback={null}>
        <ConditionConfigPanel
          open={conditionPanelNodeId !== null}
          node={conditionPanelNode}
          onClose={onCloseConditionPanel}
          onSave={onUpsertConditionNode}
          onDelete={onRemoveConditionNode}
          incomingEdges={
            conditionPanelNodeId
              ? chainEdges.filter(
                  (e) => e.targetRequestId === conditionPanelNodeId,
                )
              : []
          }
        />
      </Suspense>

      <Suspense fallback={null}>
        <StartConfigPanel
          open={startConfigPanelNodeId !== null}
          node={startBlock}
          onClose={onCloseStartConfigPanel}
          onSave={onUpsertStartBlock}
          onDelete={onRemoveStartBlock}
        />
      </Suspense>

      <Suspense fallback={null}>
        <EvaluateConfigPanel
          open={evaluatePanelNodeId !== null}
          node={
            evaluatePanelNodeId
              ? (evaluateNodes.find((n) => n.id === evaluatePanelNodeId) ??
                null)
              : null
          }
          onClose={onCloseEvaluatePanel}
          onSave={onUpsertEvaluateNode}
          onDelete={onDeleteNode}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ValidateConfigPanel
          open={validatePanelNodeId !== null}
          node={
            validatePanelNodeId
              ? (validateNodes.find((n) => n.id === validatePanelNodeId) ??
                null)
              : null
          }
          onClose={onCloseValidatePanel}
          onSave={onUpsertValidateNode}
          onDelete={onDeleteNode}
        />
      </Suspense>

      <Suspense fallback={null}>
        <MergeConfigPanel
          open={mergePanelNodeId !== null}
          node={
            mergePanelNodeId
              ? (mergeNodes.find((n) => n.id === mergePanelNodeId) ?? null)
              : null
          }
          onClose={onCloseMergePanel}
          onSave={onUpsertMergeNode}
          onDelete={onDeleteNode}
        />
      </Suspense>

      <Suspense fallback={null}>
        <LoopConfigPanel
          open={loopPanelNodeId !== null}
          node={
            loopPanelNodeId
              ? (loopNodes.find((n) => n.id === loopPanelNodeId) ?? null)
              : null
          }
          onClose={onCloseLoopPanel}
          onSave={onUpsertLoopNode}
          onDelete={onDeleteNode}
          sourceResponseBody={loopSourceResponseBody}
        />
      </Suspense>

      <Suspense fallback={null}>
        <CollectConfigPanel
          open={collectPanelNodeId !== null}
          node={
            collectPanelNodeId
              ? (collectNodes.find((n) => n.id === collectPanelNodeId) ?? null)
              : null
          }
          loopBlocks={loopNodes}
          onClose={onCloseCollectPanel}
          onSave={onUpsertCollectNode}
          onDelete={onDeleteNode}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SubChainConfigPanel
          open={subChainPanelNodeId !== null}
          node={subChainPanelNode}
          referencedChainInputs={referencedChainInputs}
          referencedChainName={referencedChain?.name}
          incomingEdges={
            subChainPanelNodeId
              ? chainEdges.filter(
                  (e) => e.targetRequestId === subChainPanelNodeId,
                )
              : []
          }
          onClose={onCloseSubChainPanel}
          onSave={onUpsertSubChainNode}
          onDelete={onDeleteNode}
        />
      </Suspense>

      <ArrowConfigPanel
        open={arrowConfigPanelOpen}
        onClose={onCloseArrowConfigPanel}
        sourceRequest={
          selectedEdgeId ? arrowSourceRequest : displayNodeSourceRequest
        }
        targetRequest={selectedEdgeId ? arrowTargetRequest : null}
        existingEdge={selectedEdgeId ? selectedEdge : null}
        onSave={selectedEdgeId ? (edge) => onUpsertEdge(edge) : () => {}}
        onDelete={selectedEdgeId ? (edgeId) => onDeleteEdge(edgeId) : () => {}}
        sourceRunState={
          selectedEdgeId ? arrowSourceRunState : displayNodeSourceRunState
        }
        sourceResponse={
          selectedEdgeId ? arrowSourceResponse : displayNodeSourceResponse
        }
        envPromotions={envPromotions}
        displayNodeId={selectedDisplayNodeId ?? undefined}
        existingDisplayNode={selectedDisplayNode ?? undefined}
        onSaveDisplayNode={
          selectedDisplayNodeId
            ? (node) => onUpsertDisplayNode(node)
            : undefined
        }
        onDeleteDisplayNode={
          selectedDisplayNodeId ? (nodeId) => onDeleteNode(nodeId) : undefined
        }
        onRunSource={onRunSource}
      />
    </>
  );
}
