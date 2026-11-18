import type { RequestModel } from "@/types";
import type { ChainEdge, ChainRunState, DisplayBlock } from "@/types/chain";
import type { ArrowPanelState } from "./hooks/useCanvasPanels";

type SourceLookup = {
  chainEdges: ChainEdge[];
  requests: RequestModel[];
  runState: ChainRunState;
};

/** The API request feeding `nodeId` through its first incoming edge, if any. */
function findUpstreamRequest(
  { chainEdges, requests }: SourceLookup,
  nodeId: string,
): RequestModel | null {
  const edge = chainEdges.find((e) => e.targetRequestId === nodeId);
  return requests.find((r) => r.id === edge?.sourceRequestId) ?? null;
}

/**
 * What ArrowConfigPanel shows for the open target: an edge (its endpoints) or a
 * Display node (its upstream request, no target). Run data is keyed by the
 * source request itself, not by whichever node's details panel was last opened.
 */
export function resolveArrowPanelData(
  arrowPanel: ArrowPanelState,
  displayNodes: DisplayBlock[],
  lookup: SourceLookup,
) {
  const { chainEdges, requests, runState } = lookup;
  const edge = chainEdges.find((e) => e.id === arrowPanel.edgeId) ?? null;
  const displayNode =
    displayNodes.find((n) => n.id === arrowPanel.displayNodeId) ?? null;

  const sourceRequest = edge
    ? (requests.find((r) => r.id === edge.sourceRequestId) ?? null)
    : displayNode && !arrowPanel.edgeId
      ? findUpstreamRequest(lookup, displayNode.id)
      : null;
  const targetRequest = edge
    ? (requests.find((r) => r.id === edge.targetRequestId) ?? null)
    : null;
  const sourceRun = sourceRequest ? runState[sourceRequest.id] : undefined;

  return {
    existingEdge: edge,
    existingDisplayNode: displayNode ?? undefined,
    sourceRequest,
    targetRequest,
    sourceRunState: sourceRun?.state,
    sourceResponse: sourceRun?.response,
  };
}

/** The Loop's upstream response body, which feeds the JSONPath explorer in its config panel. */
export function resolveLoopSourceBody(
  loopId: string | null,
  lookup: SourceLookup,
): string | undefined {
  if (!loopId) return undefined;
  const source = findUpstreamRequest(lookup, loopId);
  return source ? lookup.runState[source.id]?.response?.body : undefined;
}
