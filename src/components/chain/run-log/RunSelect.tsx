"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RunSummary } from "@/lib/chainRunHistory";
import { formatDuration, resolveAnchorLabel } from "@/lib/chainRunSummary";
import { useChainRunStore } from "@/stores/useChainRunStore";

const SUMMARY_SEPARATOR = " · ";

type RunSelectProps = {
  runs: RunSummary[];
  /** Labels of nodes currently on the canvas, keyed by node id. */
  nodeLabels?: Record<string, string>;
};

type RunOptionLabelProps = Pick<RunSelectProps, "nodeLabels"> & {
  run: RunSummary;
};

/** Same two lines as a run card: trigger, then counts and duration. */
function RunOptionLabel({ run, nodeLabels }: RunOptionLabelProps) {
  const t = useTranslations("chain");
  const anchor = resolveAnchorLabel(run, nodeLabels ?? {});
  const { passed, failed, skipped, aborted } = run.counts;
  const details = [
    t("runLogCollapsedSummary", {
      total: passed + failed + skipped + aborted,
      passed,
      failed,
      skipped,
    }),
  ];
  if (run.finishedAt !== undefined) {
    details.push(formatDuration(Math.max(0, run.finishedAt - run.startedAt)));
  }
  return (
    <span className="flex min-w-0 flex-col text-left">
      <span className="truncate text-sm font-medium">
        {t(anchor.key, anchor.values)}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {details.join(SUMMARY_SEPARATOR)}
      </span>
    </span>
  );
}

/** Compact run picker shown in place of the runs list in a narrow dock. */
export function RunSelect({ runs, nodeLabels }: RunSelectProps) {
  const t = useTranslations("chain");
  const selectedRunId = useChainRunStore((s) => s.selectedRunId);
  const selectRun = useChainRunStore((s) => s.selectRun);
  const runsById = new Map(runs.map((run) => [run.id, run]));

  return (
    <div className="shrink-0 border-b p-1">
      <Select
        value={selectedRunId}
        onValueChange={(runId) => {
          if (typeof runId === "string") selectRun(runId);
        }}
      >
        <SelectTrigger
          aria-label={t("runLogRunSelect")}
          className="h-auto min-h-10 w-full py-1"
        >
          <SelectValue>
            {(value: string | null) => {
              const run = value ? runsById.get(value) : undefined;
              return run ? (
                <RunOptionLabel run={run} nodeLabels={nodeLabels} />
              ) : (
                t("runLogRunSelect")
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {runs.map((run) => (
            <SelectItem key={run.id} value={run.id}>
              <RunOptionLabel run={run} nodeLabels={nodeLabels} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
