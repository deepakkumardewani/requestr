"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { ChainNodeType } from "@/types/chain";

type CanvasEmptyStateProps = {
  /** Opens the request picker (the primary way to add the first node). */
  onAddApi: () => void;
  /** Shared add-block command; called without a position so the block lands at the viewport center. */
  onAddBlock: (type: ChainNodeType) => void;
};

/**
 * Compact call-to-action shown when a chain has zero nodes. The root lets
 * pointer events through to the canvas (wheel, drag, right-click); only the
 * card captures them. The full block list lives in the "+ Block" menu.
 */
export function CanvasEmptyState({
  onAddApi,
  onAddBlock,
}: CanvasEmptyStateProps) {
  const t = useTranslations("chain");

  return (
    <div
      data-testid="chain-empty-state"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6"
    >
      <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card/95 p-6 text-center shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">
            {t("emptyCanvasTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("emptyCanvasDescription")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            data-testid="empty-add-api-btn"
            onClick={onAddApi}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("emptyCanvasAddApi")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="empty-add-start-btn"
            onClick={() => onAddBlock("start")}
          >
            {t("emptyCanvasAddStart")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t.rich("emptyCanvasQuickHint", {
            kbd: (chunks) => <Kbd>{chunks}</Kbd>,
          })}
        </p>
      </div>
    </div>
  );
}
