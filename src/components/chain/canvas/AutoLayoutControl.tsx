"use client";

import type { Edge, Node } from "@xyflow/react";
import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useAutoLayout } from "./hooks/useAutoLayout";

export type LayoutNode = Node<{ [key: string]: unknown }>;

type AutoLayoutControlProps = {
  chainId: string;
  nodes: LayoutNode[];
  edges: Edge[];
  disabled: boolean;
  onUpdateNodePosition: (nodeId: string, pos: { x: number; y: number }) => void;
  setNodes: React.Dispatch<React.SetStateAction<LayoutNode[]>>;
};

export function AutoLayoutControl({
  chainId,
  nodes,
  edges,
  disabled,
  onUpdateNodePosition,
  setNodes,
}: AutoLayoutControlProps) {
  const t = useTranslations("chain");
  const handleAutoLayout = useAutoLayout({
    chainId,
    nodes,
    edges,
    setNodes,
    onUpdateNodePosition,
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 text-xs bg-card"
      onClick={handleAutoLayout}
      disabled={disabled}
      aria-label={t("autoLayoutAriaLabel")}
    >
      <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
      {t("autoLayoutButton")}
    </Button>
  );
}
