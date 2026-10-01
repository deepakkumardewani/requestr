"use client";

import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";
import { generateId } from "@/lib/utils";
import type {
  CollectBlock,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayBlock,
  EvaluateBlock,
  LoopBlock,
  MergeBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";
import { CHAIN_HANDLE_IDS } from "@/types/chain";

type GhostPlacementHandlerProps = {
  pendingNodeType:
    | "delay"
    | "condition"
    | "display"
    | "evaluate"
    | "validate"
    | "merge"
    | "loop"
    | "collect"
    | "subchain"
    | null;
  cursorPos: { x: number; y: number };
  onUpsertDelayNode: (node: DelayNodeConfig) => void;
  onUpsertConditionNode: (node: ConditionNodeConfig) => void;
  onUpsertDisplayNode: (node: DisplayBlock) => void;
  onUpsertEvaluateNode: (node: EvaluateBlock) => void;
  onUpsertValidateNode: (node: ValidateBlock) => void;
  onUpsertMergeNode: (node: MergeBlock) => void;
  onUpsertLoopNode: (node: LoopBlock) => void;
  onUpsertCollectNode: (node: CollectBlock) => void;
  onUpsertSubChainNode: (node: SubChainBlock) => void;
  onUpdateNodePosition: (nodeId: string, pos: { x: number; y: number }) => void;
  onOpenConditionPanel: (nodeId: string) => void;
  onOpenEvaluatePanel: (nodeId: string) => void;
  onOpenValidatePanel: (nodeId: string) => void;
  onOpenMergePanel: (nodeId: string) => void;
  onOpenLoopPanel: (nodeId: string) => void;
  onOpenCollectPanel: (nodeId: string) => void;
  onOpenSubChainPicker: (nodeId: string) => void;
  onClearPending: () => void;
};

export function GhostPlacementHandler({
  pendingNodeType,
  cursorPos,
  onUpsertDelayNode,
  onUpsertConditionNode,
  onUpsertDisplayNode,
  onUpsertEvaluateNode,
  onUpsertValidateNode,
  onUpsertMergeNode,
  onUpsertLoopNode,
  onUpsertCollectNode,
  onUpsertSubChainNode,
  onUpdateNodePosition,
  onOpenConditionPanel,
  onOpenEvaluatePanel,
  onOpenValidatePanel,
  onOpenMergePanel,
  onOpenLoopPanel,
  onOpenCollectPanel,
  onOpenSubChainPicker,
  onClearPending,
}: GhostPlacementHandlerProps) {
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    if (!pendingNodeType) return;

    function handlePaneClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const isPaneClick =
        target.classList.contains("react-flow__pane") ||
        target.closest(".react-flow__pane") !== null;
      if (!isPaneClick) return;

      const pos = screenToFlowPosition({ x: cursorPos.x, y: cursorPos.y });
      const id = generateId();

      if (pendingNodeType === "delay") {
        onUpsertDelayNode({ id, type: "delay", delayMs: 1000 });
        onUpdateNodePosition(id, pos);
      } else if (pendingNodeType === "display") {
        onUpsertDisplayNode({
          id,
          type: "display",
          sourceJsonPath: "",
          targetField: "header",
          targetKey: "",
        });
        onUpdateNodePosition(id, pos);
      } else if (pendingNodeType === "evaluate") {
        onUpsertEvaluateNode({
          id,
          type: "evaluate",
          code: "return data;",
          outputAlias: "result",
        });
        onUpdateNodePosition(id, pos);
        onOpenEvaluatePanel(id);
      } else if (pendingNodeType === "validate") {
        onUpsertValidateNode({
          id,
          type: "validate",
          schema: "{}",
          sourceJsonPath: "",
        });
        onUpdateNodePosition(id, pos);
        onOpenValidatePanel(id);
      } else if (pendingNodeType === "merge") {
        onUpsertMergeNode({ id, type: "merge", mode: "all" });
        onUpdateNodePosition(id, pos);
        onOpenMergePanel(id);
      } else if (pendingNodeType === "loop") {
        onUpsertLoopNode({
          id,
          type: "loop",
          sourceJsonPath: "",
          itemAlias: "item",
          maxIterations: 100,
        });
        onUpdateNodePosition(id, pos);
        onOpenLoopPanel(id);
      } else if (pendingNodeType === "collect") {
        onUpsertCollectNode({
          id,
          type: "collect",
          loopId: "",
        });
        onUpdateNodePosition(id, pos);
        onOpenCollectPanel(id);
      } else if (pendingNodeType === "subchain") {
        onUpsertSubChainNode({
          id,
          type: "subchain",
          chainId: "",
          inputBindings: {},
        });
        onUpdateNodePosition(id, pos);
        onOpenSubChainPicker(id);
      } else {
        onUpsertConditionNode({
          id,
          type: "condition",
          variable: "{{value}}",
          branches: [
            { id: generateId(), label: "branch 1", expression: "== 'value'" },
            { id: generateId(), label: CHAIN_HANDLE_IDS.ELSE, expression: "" },
          ],
        });
        onUpdateNodePosition(id, pos);
        onOpenConditionPanel(id);
      }

      onClearPending();
    }

    window.addEventListener("click", handlePaneClick);
    return () => window.removeEventListener("click", handlePaneClick);
  }, [
    pendingNodeType,
    cursorPos,
    screenToFlowPosition,
    onUpsertDelayNode,
    onUpsertConditionNode,
    onUpsertDisplayNode,
    onUpsertEvaluateNode,
    onUpsertValidateNode,
    onUpsertMergeNode,
    onUpsertLoopNode,
    onUpsertCollectNode,
    onUpsertSubChainNode,
    onUpdateNodePosition,
    onOpenConditionPanel,
    onOpenEvaluatePanel,
    onOpenValidatePanel,
    onOpenMergePanel,
    onOpenLoopPanel,
    onOpenCollectPanel,
    onOpenSubChainPicker,
    onClearPending,
  ]);

  return null;
}
