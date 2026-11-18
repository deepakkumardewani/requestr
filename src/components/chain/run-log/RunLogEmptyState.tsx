"use client";

import { useTranslations } from "next-intl";
import { getRunBlockTitleKey } from "@/app/chain/[collectionId]/ChainPageHeader";
import { Button } from "@/components/ui/button";
import type { RunBlockReason } from "@/lib/chainRunBlock";
import type { RunLogEmptyKind } from "@/lib/chainRunSummary";

type RunLogEmptyStateProps = {
  kind: RunLogEmptyKind;
  /** Why Run is disabled (from `getRunBlockReason`); null when runnable. */
  runBlockReason?: RunBlockReason | null;
  /** Load failure detail shown for `error`. */
  errorMessage?: string;
  onRunFlow?: () => void;
  onClearFilter?: () => void;
  onRetry?: () => void;
};

function SkeletonRows() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1.5 p-2">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-6 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

/** Placeholder for every run-log situation with nothing to render; see `getRunLogEmptyKind`. */
export function RunLogEmptyState({
  kind,
  runBlockReason = null,
  errorMessage = "",
  onRunFlow,
  onClearFilter,
  onRetry,
}: RunLogEmptyStateProps) {
  const t = useTranslations("chain");

  if (kind === "loading") return <SkeletonRows />;

  const blockTitleKey = getRunBlockTitleKey(runBlockReason);
  const isBlocked = runBlockReason !== null;

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground"
    >
      {kind === "error" && (
        <>
          <span>{t("runLogLoadError", { message: errorMessage })}</span>
          <Button type="button" size="xs" variant="outline" onClick={onRetry}>
            {t("retry")}
          </Button>
        </>
      )}
      {kind === "noRuns" && (
        <>
          <span>{t("runLogNoRunsYet")}</span>
          {/* Wrapper carries the tooltip: disabled buttons swallow hover events. */}
          <span title={blockTitleKey ? t(blockTitleKey) : undefined}>
            <Button
              type="button"
              size="xs"
              disabled={isBlocked}
              onClick={onRunFlow}
            >
              {t("runLogRunFlow")}
            </Button>
          </span>
        </>
      )}
      {kind === "noSteps" && <span>{t("runLogStepsEmpty")}</span>}
      {kind === "filtered" && (
        <>
          <span>{t("runLogStepsEmptyFiltered")}</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onClearFilter}
          >
            {t("runLogClearFilter")}
          </Button>
        </>
      )}
      {kind === "noStepSelected" && <span>{t("runLogSelectStepPrompt")}</span>}
    </div>
  );
}
