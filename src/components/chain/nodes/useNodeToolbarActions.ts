import { Copy, Info, Play, Settings, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ToolbarAction } from "./NodeToolbar";

type BlockActionsOptions = {
  nodeId: string;
  onConfigureNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  /** Node types with a per-type accessible name (e.g. "Configure condition") override the defaults. */
  labels?: { configure?: string; remove?: string };
};

/** Configure + remove actions shared by every non-request block node. */
export function useBlockNodeActions({
  nodeId,
  onConfigureNode,
  onDeleteNode,
  labels,
}: BlockActionsOptions): ToolbarAction[] {
  const t = useTranslations("tooltips");
  const actions: ToolbarAction[] = [];

  if (onConfigureNode) {
    actions.push({
      id: "configure",
      icon: Settings,
      label: labels?.configure ?? t("configure"),
      tooltip: t("configure"),
      onClick: () => onConfigureNode(nodeId),
    });
  }
  if (onDeleteNode) {
    actions.push({
      id: "remove",
      icon: Trash2,
      label: labels?.remove ?? t("removeFromChain"),
      tooltip: t("removeFromChain"),
      destructive: true,
      onClick: () => onDeleteNode(nodeId),
    });
  }
  return actions;
}

type RequestActionsOptions = {
  requestId: string;
  onRunNode?: (id: string) => void;
  onClickNode?: (id: string) => void;
  onDuplicateNode?: (id: string) => void;
  onDeleteNode?: (id: string) => void;
};

/** Run / details / duplicate / remove actions for an API request node. */
export function useRequestNodeActions({
  requestId,
  onRunNode,
  onClickNode,
  onDuplicateNode,
  onDeleteNode,
}: RequestActionsOptions): ToolbarAction[] {
  const t = useTranslations("tooltips");
  const actions: ToolbarAction[] = [];

  if (onRunNode) {
    actions.push({
      id: "run",
      icon: Play,
      iconClassName: "fill-current",
      label: t("runIndependently"),
      onClick: () => onRunNode(requestId),
    });
  }
  if (onClickNode) {
    actions.push({
      id: "details",
      icon: Info,
      label: t("viewDetails"),
      onClick: () => onClickNode(requestId),
    });
  }
  if (onDuplicateNode) {
    actions.push({
      id: "duplicate",
      icon: Copy,
      label: t("duplicate"),
      onClick: () => onDuplicateNode(requestId),
    });
  }
  if (onDeleteNode) {
    actions.push({
      id: "remove",
      icon: Trash2,
      label: t("removeFromChain"),
      destructive: true,
      onClick: () => onDeleteNode(requestId),
    });
  }
  return actions;
}
