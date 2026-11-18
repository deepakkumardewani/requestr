"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RunSummary } from "@/lib/chainRunHistory";

type RunCardMenuProps = {
  run: RunSummary;
  /** Result of `canRerun`; false when the run's anchor node no longer exists. */
  rerunEnabled: boolean;
  onRerun: (run: RunSummary) => void;
  onCopySummary: (run: RunSummary) => void;
  onDelete: (run: RunSummary) => void;
};

function RunCardMenuInner({
  run,
  rerunEnabled,
  onRerun,
  onCopySummary,
  onDelete,
}: RunCardMenuProps) {
  const t = useTranslations("chain");
  const rerunItem = (
    <DropdownMenuItem
      disabled={!rerunEnabled}
      onClick={() => onRerun(run)}
      // Disabled items swallow hover on some engines; the title keeps the reason reachable.
      title={rerunEnabled ? undefined : t("runLogRerunDisabledNodeGone")}
    >
      {t("runLogRerun")}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("runLogRowMenu")}
          />
        }
      >
        <MoreHorizontal className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {rerunEnabled ? (
          rerunItem
        ) : (
          <Tooltip>
            <TooltipTrigger render={<div />}>{rerunItem}</TooltipTrigger>
            <TooltipContent side="left">
              {t("runLogRerunDisabledNodeGone")}
            </TooltipContent>
          </Tooltip>
        )}
        <DropdownMenuItem onClick={() => onCopySummary(run)}>
          {t("runLogCopySummary")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(run)}>
          {t("runLogDeleteRun")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const RunCardMenu = memo(RunCardMenuInner);
