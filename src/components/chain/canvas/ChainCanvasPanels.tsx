import { lazy, Suspense, useMemo } from "react";
import { useChainErrorMessage } from "@/hooks/useChainErrorMessage";
import { getChainDisplayName } from "@/lib/chainDisplayName";
import { groupBlocks } from "@/lib/chainRunner/runGraph";
import type { AlignEdge, DistributeAxis } from "@/lib/nodeAlign";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import type { RequestModel } from "@/types";
import type {
  ChainAssertion,
  ChainBlock,
  ChainEdge,
  ChainRunState,
  EnvPromotion,
} from "@/types/chain";
import {
  BLOCK_REGISTRY,
  type ConfigurableBlockType,
  isConfigurableBlockType,
} from "../blockRegistry";
import { ArrowConfigPanel } from "../panels/ArrowConfigPanel";
import { NodeDetailsPanel } from "../panels/NodeDetailsPanel";
import type { ContextMenuState } from "./ChainCanvas.types";
import type {
  ArrowPanelState,
  PanelBlockType,
  PanelIds,
} from "./hooks/useCanvasPanels";
import { useEvaluateTestInput } from "./hooks/useEvaluateTestInput";
import { NodeContextMenu } from "./NodeContextMenu";
import {
  resolveArrowPanelData,
  resolveLoopSourceBody,
} from "./panelSourceData";

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
  onDuplicateBlock: (blockId: string) => void;
  /** Opens whichever config surface `type` uses (side panel, or the arrow panel for Display). */
  onConfigureBlock: (type: ConfigurableBlockType, nodeId: string) => void;
  /** Opens the chain picker for a Sub-chain block; omit to hide the "Change reference" entry. */
  onChangeSubChainReference?: (nodeId: string) => void;
  /** Multi-selection arrangement shown in the node context menu. */
  selectedCount?: number;
  onAlign?: (edge: AlignEdge) => void;
  onDistribute?: (axis: DistributeAxis) => void;

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

  /** Every block of the chain; each config panel looks up its own block here. */
  blocks: ChainBlock[];
  onUpsertBlock: (block: ChainBlock) => void;
  onRemoveConditionNode: (nodeId: string) => void;
  onRemoveStartBlock: (nodeId: string) => void;
  panelIds: PanelIds;
  onClosePanel: (type: PanelBlockType) => void;

  arrowPanel: ArrowPanelState;
  onCloseArrowPanel: () => void;
  onUpsertEdge: (edge: ChainEdge) => void;
  onDeleteEdge: (edgeId: string) => void;
  onRunSource?: (nodeId: string) => void;
  runState: ChainRunState;
};

const noop = () => {};

/** Renders the floating overlays for ChainCanvas: context menu, edit-request, node-details, and every block config panel. */
export function ChainCanvasPanels({
  contextMenu,
  onCloseContextMenu,
  onAddAfterNode,
  onRunUpTo,
  onRunFromHere,
  onDeleteNode,
  onDuplicateBlock,
  onConfigureBlock,
  selectedCount,
  onAlign,
  onDistribute,
  onChangeSubChainReference,
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
  blocks,
  onUpsertBlock,
  onRemoveConditionNode,
  onRemoveStartBlock,
  panelIds,
  onClosePanel,
  arrowPanel,
  onCloseArrowPanel,
  onUpsertEdge,
  onDeleteEdge,
  onRunSource,
  runState,
}: ChainCanvasPanelsProps) {
  const chainErrorMessage = useChainErrorMessage();
  const editRequest = requests.find((r) => r.id === editRequestId) ?? null;
  const chains = useChainStore((s) => s.chains);
  const collections = useCollectionsStore((s) => s.collections);
  const views = useMemo(() => groupBlocks(blocks), [blocks]);
  const {
    startBlock,
    displayNodes,
    evaluateNodes,
    loopNodes,
    conditionNodes,
    validateNodes,
    mergeNodes,
    collectNodes,
    subChainNodes,
  } = views;
  const evaluateTestInput = useEvaluateTestInput({
    nodeId: panelIds.evaluate,
    edges: chainEdges,
    runState,
    startBlock: startBlock ?? null,
  });

  const subChainPanelNode =
    subChainNodes.find((n) => n.id === panelIds.subchain) ?? null;
  const referencedChain = subChainPanelNode
    ? chains[subChainPanelNode.chainId]
    : undefined;
  const referencedChainInputs =
    referencedChain?.blocks.find((b) => b.type === "start")?.inputs ?? [];

  // Only the blocks that publish names into the shared namespace matter for
  // the alias-collision warning shown while configuring an edge.
  const namePublishingBlocks = useMemo<ChainBlock[]>(
    () => [
      ...(startBlock ? [startBlock] : []),
      ...displayNodes,
      ...evaluateNodes,
      ...loopNodes,
    ],
    [startBlock, displayNodes, evaluateNodes, loopNodes],
  );

  const sourceLookup = { chainEdges, requests, runState };
  const arrow = resolveArrowPanelData(arrowPanel, displayNodes, sourceLookup);
  const loopSourceResponseBody = resolveLoopSourceBody(
    panelIds.loop,
    sourceLookup,
  );
  const conditionIncomingEdges = panelIds.condition
    ? chainEdges.filter((e) => e.targetRequestId === panelIds.condition)
    : [];
  const isEdgeMode = arrowPanel.edgeId !== null;

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
          selectedCount={selectedCount}
          onAlign={onAlign}
          onDistribute={onDistribute}
          onDuplicate={(nodeId: string) => {
            if (!BLOCK_REGISTRY[contextMenu.nodeType].canDuplicate) return;
            onDuplicateBlock(nodeId);
            onCloseContextMenu();
          }}
          onChangeReference={
            onChangeSubChainReference &&
            ((nodeId: string) => {
              onChangeSubChainReference(nodeId);
              onCloseContextMenu();
            })
          }
          onConfigure={(nodeId: string) => {
            if (isConfigurableBlockType(contextMenu.nodeType)) {
              onConfigureBlock(contextMenu.nodeType, nodeId);
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
        error={
          chainErrorMessage(
            selectedState?.errorCode,
            selectedState?.errorParams,
            selectedState?.error,
          ) || undefined
        }
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
          open={panelIds.condition !== null}
          node={conditionNodes.find((n) => n.id === panelIds.condition) ?? null}
          onClose={() => onClosePanel("condition")}
          onSave={onUpsertBlock}
          onDelete={onRemoveConditionNode}
          incomingEdges={conditionIncomingEdges}
        />
      </Suspense>

      <Suspense fallback={null}>
        <StartConfigPanel
          open={panelIds.start !== null}
          node={startBlock ?? null}
          onClose={() => onClosePanel("start")}
          onSave={onUpsertBlock}
          onDelete={onRemoveStartBlock}
        />
      </Suspense>

      <Suspense fallback={null}>
        <EvaluateConfigPanel
          open={panelIds.evaluate !== null}
          node={evaluateNodes.find((n) => n.id === panelIds.evaluate) ?? null}
          onClose={() => onClosePanel("evaluate")}
          onSave={onUpsertBlock}
          onDelete={onDeleteNode}
          testInput={evaluateTestInput}
          chainBlocks={blocks}
          chainEdges={chainEdges}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ValidateConfigPanel
          open={panelIds.validate !== null}
          node={validateNodes.find((n) => n.id === panelIds.validate) ?? null}
          onClose={() => onClosePanel("validate")}
          onSave={onUpsertBlock}
          onDelete={onDeleteNode}
        />
      </Suspense>

      <Suspense fallback={null}>
        <MergeConfigPanel
          open={panelIds.merge !== null}
          node={mergeNodes.find((n) => n.id === panelIds.merge) ?? null}
          onClose={() => onClosePanel("merge")}
          onSave={onUpsertBlock}
          onDelete={onDeleteNode}
        />
      </Suspense>

      <Suspense fallback={null}>
        <LoopConfigPanel
          open={panelIds.loop !== null}
          node={loopNodes.find((n) => n.id === panelIds.loop) ?? null}
          onClose={() => onClosePanel("loop")}
          onSave={onUpsertBlock}
          onDelete={onDeleteNode}
          sourceResponseBody={loopSourceResponseBody}
        />
      </Suspense>

      <Suspense fallback={null}>
        <CollectConfigPanel
          open={panelIds.collect !== null}
          node={collectNodes.find((n) => n.id === panelIds.collect) ?? null}
          loopBlocks={loopNodes}
          onClose={() => onClosePanel("collect")}
          onSave={onUpsertBlock}
          onDelete={onDeleteNode}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SubChainConfigPanel
          open={panelIds.subchain !== null}
          node={subChainPanelNode}
          referencedChainInputs={referencedChainInputs}
          referencedChainName={
            referencedChain
              ? getChainDisplayName(referencedChain, collections)
              : undefined
          }
          chainEdges={chainEdges}
          onClose={() => onClosePanel("subchain")}
          onSave={onUpsertBlock}
          onDelete={onDeleteNode}
        />
      </Suspense>

      <ArrowConfigPanel
        open={arrowPanel.open}
        onClose={onCloseArrowPanel}
        sourceRequest={arrow.sourceRequest}
        targetRequest={arrow.targetRequest}
        existingEdge={arrow.existingEdge}
        onSave={isEdgeMode ? onUpsertEdge : noop}
        onDelete={isEdgeMode ? onDeleteEdge : noop}
        sourceRunState={arrow.sourceRunState}
        sourceResponse={arrow.sourceResponse}
        envPromotions={envPromotions}
        displayNodeId={arrowPanel.displayNodeId ?? undefined}
        existingDisplayNode={arrow.existingDisplayNode}
        chainEdges={chainEdges}
        chainBlocks={namePublishingBlocks}
        onSaveDisplayNode={arrowPanel.displayNodeId ? onUpsertBlock : undefined}
        onDeleteDisplayNode={
          arrowPanel.displayNodeId ? onDeleteNode : undefined
        }
        onRunSource={onRunSource}
      />
    </>
  );
}
