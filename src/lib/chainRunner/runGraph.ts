import { blocksOfType } from "@/lib/chainBlocks";
import type { RequestModel } from "@/types";
import type {
  ChainBlock,
  ChainEdge,
  ChainNodeType,
  CollectBlock,
  ConditionBlock,
  DelayBlock,
  DisplayBlock,
  EvaluateBlock,
  HistoryBlock,
  LoopBlock,
  MergeBlock,
  StartBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";
import type { RunChainOptions } from "./types";

/**
 * The slice of `RunChainOptions` that describes *what* to run (as opposed to
 * how): request nodes, edges and every block collection. Spreading it into
 * `runChain` options keeps run entry points from re-listing block types.
 */
export type ChainGraph = Required<
  Pick<
    RunChainOptions,
    | "requests"
    | "edges"
    | "delayNodes"
    | "conditionNodes"
    | "displayNodes"
    | "evaluateNodes"
    | "validateNodes"
    | "mergeNodes"
    | "loopNodes"
    | "collectNodes"
    | "subChainBlocks"
  >
> &
  Pick<RunChainOptions, "startBlock">;

/** Any subset of a graph's block collections; `RunChainOptions` and `ChainGraph` both satisfy it. */
export type BlockCollections = Partial<
  Pick<
    ChainGraph,
    | "delayNodes"
    | "conditionNodes"
    | "displayNodes"
    | "evaluateNodes"
    | "validateNodes"
    | "mergeNodes"
    | "loopNodes"
    | "collectNodes"
    | "subChainBlocks"
  >
>;

export type BlockGroup = readonly [
  ChainNodeType,
  ReadonlyArray<{ id: string }>,
];

/**
 * Non-API, non-Start block groups in scheduler tie-break order. The single
 * source for every "all control-flow ids" list (page, runner, hook) so a new
 * block type cannot be missed by cycle detection.
 */
export function blockGroups(graph: BlockCollections): BlockGroup[] {
  return [
    ["delay", graph.delayNodes ?? []],
    ["condition", graph.conditionNodes ?? []],
    ["display", graph.displayNodes ?? []],
    ["evaluate", graph.evaluateNodes ?? []],
    ["validate", graph.validateNodes ?? []],
    ["merge", graph.mergeNodes ?? []],
    ["loop", graph.loopNodes ?? []],
    ["collect", graph.collectNodes ?? []],
    ["subchain", graph.subChainBlocks ?? []],
  ];
}

/** Ids of every non-request, non-Start block — the "extra" ids topological ordering needs. */
export function controlFlowNodeIds(graph: BlockCollections): string[] {
  return blockGroups(graph).flatMap(([, nodes]) => nodes.map((n) => n.id));
}

/** Ids of every node in the graph, including the Start block. */
export function graphNodeIds(graph: ChainGraph): string[] {
  return [
    ...graph.requests.map((r) => r.id),
    ...controlFlowNodeIds(graph),
    ...(graph.startBlock ? [graph.startBlock.id] : []),
  ];
}

/**
 * Restricts a graph to `ids`. The Start block is deliberately dropped: partial
 * runs (run up to / from here, re-run) never re-resolve chain inputs.
 */
export function filterGraphByNodeIds(
  graph: ChainGraph,
  ids: ReadonlySet<string>,
): ChainGraph {
  const keep = <T extends { id: string }>(nodes: T[]): T[] =>
    nodes.filter((n) => ids.has(n.id));
  return {
    requests: keep(graph.requests),
    edges: graph.edges.filter(
      (e) => ids.has(e.sourceRequestId) && ids.has(e.targetRequestId),
    ),
    delayNodes: keep(graph.delayNodes),
    conditionNodes: keep(graph.conditionNodes),
    displayNodes: keep(graph.displayNodes),
    evaluateNodes: keep(graph.evaluateNodes),
    validateNodes: keep(graph.validateNodes),
    mergeNodes: keep(graph.mergeNodes),
    loopNodes: keep(graph.loopNodes),
    collectNodes: keep(graph.collectNodes),
    subChainBlocks: keep(graph.subChainBlocks),
  };
}

/** A chain's `blocks` split into the typed collections the canvas and runner consume. */
export type BlockViews = {
  delayNodes: DelayBlock[];
  conditionNodes: ConditionBlock[];
  displayNodes: DisplayBlock[];
  evaluateNodes: EvaluateBlock[];
  validateNodes: ValidateBlock[];
  mergeNodes: MergeBlock[];
  loopNodes: LoopBlock[];
  collectNodes: CollectBlock[];
  subChainNodes: SubChainBlock[];
  historyBlocks: HistoryBlock[];
  startBlock: StartBlock | undefined;
};

/** The one place a chain's `blocks` are sorted into per-type collections. */
export function groupBlocks(blocks: ChainBlock[]): BlockViews {
  return {
    delayNodes: blocksOfType<DelayBlock>(blocks, "delay"),
    conditionNodes: blocksOfType<ConditionBlock>(blocks, "condition"),
    displayNodes: blocksOfType<DisplayBlock>(blocks, "display"),
    evaluateNodes: blocksOfType<EvaluateBlock>(blocks, "evaluate"),
    validateNodes: blocksOfType<ValidateBlock>(blocks, "validate"),
    mergeNodes: blocksOfType<MergeBlock>(blocks, "merge"),
    loopNodes: blocksOfType<LoopBlock>(blocks, "loop"),
    collectNodes: blocksOfType<CollectBlock>(blocks, "collect"),
    subChainNodes: blocksOfType<SubChainBlock>(blocks, "subchain"),
    historyBlocks: blocksOfType<HistoryBlock>(blocks, "history"),
    startBlock: blocksOfType<StartBlock>(blocks, "start")[0],
  };
}

/** Assembles the runnable graph from a chain's blocks plus its resolved requests and edges. */
export function graphFromBlocks(
  blocks: ChainBlock[],
  requests: RequestModel[],
  edges: ChainEdge[],
): ChainGraph {
  const views = groupBlocks(blocks);
  return {
    requests,
    edges,
    delayNodes: views.delayNodes,
    conditionNodes: views.conditionNodes,
    displayNodes: views.displayNodes,
    evaluateNodes: views.evaluateNodes,
    validateNodes: views.validateNodes,
    mergeNodes: views.mergeNodes,
    loopNodes: views.loopNodes,
    collectNodes: views.collectNodes,
    subChainBlocks: views.subChainNodes,
    startBlock: views.startBlock,
  };
}
