import type { NodeTypes } from "@xyflow/react";
import {
  Braces,
  GitBranch,
  GitMerge,
  Inbox,
  Monitor,
  Repeat2,
  Rocket,
  ShieldCheck,
  Timer,
  Workflow,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  CHAIN_NODE_TYPES,
  type ChainBlock,
  type ChainNodeType,
} from "@/types/chain";
import { ChainNode } from "./nodes/ChainNode";
import { CollectNode } from "./nodes/CollectNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { DelayNode } from "./nodes/DelayNode";
import { DisplayNode } from "./nodes/DisplayNode";
import { EvaluateNode } from "./nodes/EvaluateNode";
import { LoopNode } from "./nodes/LoopNode";
import { MergeNode } from "./nodes/MergeNode";
import { StartNode } from "./nodes/StartNode";
import { SubChainNode } from "./nodes/SubChainNode";
import { ValidateNode } from "./nodes/ValidateNode";

/** Keys under the `chain` i18n namespace that name and describe a block in the BlockMenu. */
export type BlockLabelKey =
  | "blockMenuApiName"
  | "blockMenuConditionName"
  | "blockMenuDelayName"
  | "blockMenuDisplayName"
  | "blockMenuStartName"
  | "blockMenuEvaluateName"
  | "blockMenuValidateName"
  | "blockMenuMergeName"
  | "blockMenuLoopName"
  | "blockMenuCollectName"
  | "blockMenuSubChainName";

export type BlockDescKey =
  | "blockMenuApiDescription"
  | "blockMenuConditionDescription"
  | "blockMenuDelayDescription"
  | "blockMenuDisplayDescription"
  | "blockMenuStartDescription"
  | "blockMenuEvaluateDescription"
  | "blockMenuValidateDescription"
  | "blockMenuMergeDescription"
  | "blockMenuLoopDescription"
  | "blockMenuCollectDescription"
  | "blockMenuSubChainDescription";

export type BlockCategoryKey =
  | "blockMenuCategoryPrimitives"
  | "blockMenuCategoryLogic";

/**
 * How the BlockMenu adds a block: `request` opens the request picker, `start`
 * inserts the (single) Start block directly, `ghost` enters click-to-place mode.
 */
export type BlockAddAction = "request" | "start" | "ghost";

type FlowNodeComponent = NodeTypes[string];

export type BlockDefinition = {
  /** The React Flow `node.type` key this block renders under. */
  flowNodeType: string;
  labelKey: BlockLabelKey;
  descKey: BlockDescKey;
  categoryKey: BlockCategoryKey;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  nodeComponent: FlowNodeComponent;
  addAction: BlockAddAction;
  /** Context menu offers "Configure" (opens the block's config surface). */
  configurable: boolean;
  /** Context menu offers "Duplicate". Start is excluded: at most one per chain. */
  canDuplicate: boolean;
  /** Context menu offers "Run up to here" / "Run from here". */
  canRun: boolean;
  /** Context menu offers "Add API after this". */
  canAddAfter: boolean;
};

const PRIMITIVES = "blockMenuCategoryPrimitives";
const LOGIC = "blockMenuCategoryLogic";

/**
 * Single source of truth for per-block-type behaviour. Declaration order is
 * the BlockMenu display order. Adding a block type to `CHAIN_NODE_TYPES`
 * fails to compile until it is registered here.
 */
export const BLOCK_REGISTRY: Record<ChainNodeType, BlockDefinition> = {
  api: {
    flowNodeType: "chainNode",
    labelKey: "blockMenuApiName",
    descKey: "blockMenuApiDescription",
    categoryKey: PRIMITIVES,
    icon: Zap,
    iconClassName: "text-blue-400",
    nodeComponent: ChainNode,
    addAction: "request",
    configurable: false,
    canDuplicate: false,
    canRun: true,
    canAddAfter: true,
  },
  condition: {
    flowNodeType: "conditionNode",
    labelKey: "blockMenuConditionName",
    descKey: "blockMenuConditionDescription",
    categoryKey: LOGIC,
    icon: GitBranch,
    iconClassName: "text-violet-400",
    nodeComponent: ConditionNode,
    addAction: "ghost",
    configurable: true,
    canDuplicate: true,
    canRun: true,
    canAddAfter: false,
  },
  delay: {
    flowNodeType: "delayNode",
    labelKey: "blockMenuDelayName",
    descKey: "blockMenuDelayDescription",
    categoryKey: LOGIC,
    icon: Timer,
    iconClassName: "text-amber-400",
    nodeComponent: DelayNode,
    addAction: "ghost",
    configurable: false,
    canDuplicate: true,
    canRun: true,
    canAddAfter: false,
  },
  display: {
    flowNodeType: "displayNode",
    labelKey: "blockMenuDisplayName",
    descKey: "blockMenuDisplayDescription",
    categoryKey: LOGIC,
    icon: Monitor,
    iconClassName: "text-violet-400",
    nodeComponent: DisplayNode,
    addAction: "ghost",
    configurable: true,
    canDuplicate: true,
    canRun: false,
    canAddAfter: false,
  },
  start: {
    flowNodeType: "startNode",
    labelKey: "blockMenuStartName",
    descKey: "blockMenuStartDescription",
    categoryKey: PRIMITIVES,
    icon: Rocket,
    iconClassName: "text-sky-400",
    nodeComponent: StartNode,
    addAction: "start",
    configurable: true,
    canDuplicate: false,
    canRun: true,
    canAddAfter: false,
  },
  evaluate: {
    flowNodeType: "evaluateNode",
    labelKey: "blockMenuEvaluateName",
    descKey: "blockMenuEvaluateDescription",
    categoryKey: LOGIC,
    icon: Braces,
    iconClassName: "text-sky-400",
    nodeComponent: EvaluateNode,
    addAction: "ghost",
    configurable: true,
    canDuplicate: true,
    canRun: true,
    canAddAfter: false,
  },
  validate: {
    flowNodeType: "validateNode",
    labelKey: "blockMenuValidateName",
    descKey: "blockMenuValidateDescription",
    categoryKey: LOGIC,
    icon: ShieldCheck,
    iconClassName: "text-emerald-400",
    nodeComponent: ValidateNode,
    addAction: "ghost",
    configurable: true,
    canDuplicate: true,
    canRun: true,
    canAddAfter: false,
  },
  merge: {
    flowNodeType: "mergeNode",
    labelKey: "blockMenuMergeName",
    descKey: "blockMenuMergeDescription",
    categoryKey: LOGIC,
    icon: GitMerge,
    iconClassName: "text-violet-400",
    nodeComponent: MergeNode,
    addAction: "ghost",
    configurable: true,
    canDuplicate: true,
    canRun: true,
    canAddAfter: false,
  },
  loop: {
    flowNodeType: "loopNode",
    labelKey: "blockMenuLoopName",
    descKey: "blockMenuLoopDescription",
    categoryKey: LOGIC,
    icon: Repeat2,
    iconClassName: "text-amber-400",
    nodeComponent: LoopNode,
    addAction: "ghost",
    configurable: true,
    canDuplicate: true,
    canRun: true,
    canAddAfter: false,
  },
  collect: {
    flowNodeType: "collectNode",
    labelKey: "blockMenuCollectName",
    descKey: "blockMenuCollectDescription",
    categoryKey: LOGIC,
    icon: Inbox,
    iconClassName: "text-blue-400",
    nodeComponent: CollectNode,
    addAction: "ghost",
    configurable: true,
    canDuplicate: false,
    canRun: true,
    canAddAfter: false,
  },
  subchain: {
    flowNodeType: "subchainNode",
    labelKey: "blockMenuSubChainName",
    descKey: "blockMenuSubChainDescription",
    categoryKey: LOGIC,
    icon: Workflow,
    iconClassName: "text-emerald-400",
    nodeComponent: SubChainNode,
    addAction: "ghost",
    configurable: true,
    canDuplicate: true,
    canRun: true,
    canAddAfter: false,
  },
};

/** Block types in BlockMenu display order. */
export const BLOCK_TYPES_IN_MENU_ORDER = Object.keys(
  BLOCK_REGISTRY,
) as ChainNodeType[];

/** Block types placed via click-to-place ghost mode (`addAction: "ghost"`). */
export type GhostBlockType = Exclude<ChainNodeType, "api" | "start">;

/** Whether the BlockMenu places `type` via click-to-place ghost mode. */
export function isGhostBlockType(type: ChainNodeType): type is GhostBlockType {
  return BLOCK_REGISTRY[type].addAction === "ghost";
}

/** Block types whose context-menu "Configure" opens a config surface. */
export type ConfigurableBlockType = Exclude<ChainNodeType, "api" | "delay">;

export function isConfigurableBlockType(
  type: ChainNodeType,
): type is ConfigurableBlockType {
  return BLOCK_REGISTRY[type].configurable;
}

/** `nodeTypes` map for React Flow, derived once so its identity is stable. */
export const FLOW_NODE_TYPES: Record<string, FlowNodeComponent> =
  Object.fromEntries(
    BLOCK_TYPES_IN_MENU_ORDER.map((type) => [
      BLOCK_REGISTRY[type].flowNodeType,
      BLOCK_REGISTRY[type].nodeComponent,
    ]),
  );

function isChainNodeType(type: string): type is ChainNodeType {
  return (CHAIN_NODE_TYPES as readonly string[]).includes(type);
}

/**
 * The block type of `id` within `blocks`. Plain requests are not blocks (and
 * legacy `history` blocks have no canvas node), so any other id is `api`.
 */
export function getNodeType(
  blocks: readonly ChainBlock[],
  id: string,
): ChainNodeType {
  const type = blocks.find((block) => block.id === id)?.type;
  return type !== undefined && isChainNodeType(type) ? type : "api";
}
