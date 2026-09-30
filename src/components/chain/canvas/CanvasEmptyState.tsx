"use client";

import { Plus, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type CanvasEmptyStateProps = {
  onAddFromCollection: () => void;
  onAddBlock: () => void;
};

/**
 * Shown when a chain has zero nodes. Explains the canvas model (requests,
 * Success/Fail handles, edge-click data mapping) and offers the two ways to
 * add the first node, both reachable without hover — satisfying touch parity.
 */
export function CanvasEmptyState({
  onAddFromCollection,
  onAddBlock,
}: CanvasEmptyStateProps) {
  const t = useTranslations("chain");

  return (
    <div
      data-testid="canvas-empty-state"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      <div className="pointer-events-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card/95 p-6 text-center shadow-lg">
        <p className="text-sm text-muted-foreground">
          {t("canvasEmptyStateLineOne")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("canvasEmptyStateLineTwo")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("canvasEmptyStateLineThree")}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onAddFromCollection}
          >
            <Zap className="h-3.5 w-3.5" aria-hidden />
            {t("canvasEmptyStateAddFromCollection")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddBlock}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("canvasEmptyStateAddBlock")}
          </Button>
        </div>
      </div>
    </div>
  );
}
