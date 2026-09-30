"use client";

import { Redo2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChainStore } from "@/stores/useChainStore";

type UndoRedoPanelProps = {
  chainId: string;
};

/** Undo/redo buttons for the active chain, disabled at the ends of its history. */
export function UndoRedoPanel({ chainId }: UndoRedoPanelProps) {
  const t = useTranslations("tooltips");
  const history = useChainStore((s) => s.history[chainId]);
  const undo = useChainStore((s) => s.undo);
  const redo = useChainStore((s) => s.redo);

  const canUndo = (history?.past.length ?? 0) > 0;
  const canRedo = (history?.future.length ?? 0) > 0;

  return (
    <TooltipProvider delay={400}>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-7 w-7 bg-card"
                aria-label={t("undo")}
                disabled={!canUndo}
                onClick={() => undo(chainId)}
              />
            }
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("undo")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-7 w-7 bg-card"
                aria-label={t("redo")}
                disabled={!canRedo}
                onClick={() => redo(chainId)}
              />
            }
          >
            <Redo2 className="h-3.5 w-3.5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("redo")}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
