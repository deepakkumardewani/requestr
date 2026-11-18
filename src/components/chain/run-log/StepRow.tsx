"use client";

import {
  Circle,
  Clock,
  GitBranch,
  GitMerge,
  ListChecks,
  Monitor,
  PlayCircle,
  Repeat,
  ShieldCheck,
  SquareFunction,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { MethodBadge } from "@/components/common/MethodBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChainErrorMessage } from "@/hooks/useChainErrorMessage";
import type { RunStep } from "@/lib/chainRunHistory";
import { cn, formatDuration } from "@/lib/utils";
import { StateIcon } from "../nodes/nodeStateStyles";

const NODE_TYPE_ICON = {
  delay: Clock,
  condition: GitBranch,
  display: Monitor,
  // Full run-log rendering owned by P5.9 — icon here keeps this map exhaustive.
  start: PlayCircle,
  evaluate: SquareFunction,
  validate: ShieldCheck,
  merge: GitMerge,
  // Nested run-log rendering (iteration grouping) owned by P8.8 — icon here
  // keeps this map exhaustive.
  loop: Repeat,
  collect: ListChecks,
  // Nested run-log rendering (parent step grouping) owned by P9.8 — icon
  // here keeps this map exhaustive.
  subchain: GitBranch,
} as const;

/** i18n key naming each non-API node type, shown as the icon's tooltip. */
const NODE_TYPE_LABEL_KEY: Partial<Record<RunStep["nodeType"], string>> = {
  api: "blockMenuApiName",
  delay: "blockMenuDelayName",
  condition: "blockMenuConditionName",
  display: "blockMenuDisplayName",
  start: "blockMenuStartName",
  evaluate: "blockMenuEvaluateName",
  validate: "blockMenuValidateName",
  merge: "blockMenuMergeName",
  loop: "blockMenuLoopName",
  collect: "blockMenuCollectName",
  subchain: "blockMenuSubChainName",
};

const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;
const HTTP_SUCCESS_MIN = 200;
const HTTP_REDIRECT_MIN = 300;

/** Text color for an HTTP status: green 2xx, amber 4xx, red 5xx, muted otherwise. */
export function getHttpStatusClass(status: number): string {
  if (status >= HTTP_SERVER_ERROR_MIN) return "text-destructive";
  if (status >= HTTP_CLIENT_ERROR_MIN) return "text-amber-500";
  if (status >= HTTP_SUCCESS_MIN && status < HTTP_REDIRECT_MIN)
    return "text-emerald-500";
  return "text-muted-foreground";
}

/** Tailwind color per lane index; cycles if more lanes than colors exist. */
const LANE_COLORS = [
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-fuchsia-500",
] as const;

/** Stable DOM id so the listbox can point `aria-activedescendant` at a row. */
export function getStepRowId(stepId: string): string {
  return `step-row-${stepId}`;
}

type StepRowProps = {
  step: RunStep;
  index: number;
  isSelected: boolean;
  onSelect: (stepId: string) => void;
  /** Called after `onSelect` for a step with an error, so the detail pane opens its Error tab. */
  onOpenError?: (stepId: string) => void;
  /** Lane index assigned by interval scheduling; 0 when steps run sequentially. */
  lane?: number;
  /** Whether any step in the current run overlaps another — hides the lane dot when false. */
  showLane?: boolean;
  /** True for a loop-iteration sub-step, rendered indented under its Loop's iteration group (P8.8). */
  nested?: boolean;
  /** True when the step's node no longer exists on the canvas. */
  nodeRemoved?: boolean;
};

const FAILED_STATES: ReadonlySet<RunStep["state"]> = new Set([
  "failed",
  "aborted",
]);

/** Resolves the second-line text for a failed/aborted step, or null when there is nothing to show. */
function useStepErrorLine(step: RunStep): string | null {
  const t = useTranslations("chain");
  const getErrorMessage = useChainErrorMessage();
  if (!FAILED_STATES.has(step.state)) return null;
  const message = getErrorMessage(step.errorCode, step.errorParams, step.error);
  if (message) return message;
  const failedCount =
    step.assertionResults?.filter((result) => !result.passed).length ?? 0;
  return failedCount > 0
    ? t("runLogAssertionsFailed", { count: failedCount })
    : null;
}

function StepRowImpl({
  step,
  index,
  isSelected,
  onSelect,
  onOpenError,
  lane = 0,
  showLane = false,
  nested = false,
  nodeRemoved = false,
}: StepRowProps) {
  const t = useTranslations("chain");
  const errorLine = useStepErrorLine(step);
  const typeLabelKey = NODE_TYPE_LABEL_KEY[step.nodeType];
  const typeLabel = typeLabelKey ? t(typeLabelKey) : undefined;
  const isApi = step.nodeType === "api";
  const NodeIcon =
    NODE_TYPE_ICON[step.nodeType as keyof typeof NODE_TYPE_ICON] ?? Circle;
  const status = step.response?.status;

  const handleClick = () => {
    onSelect(step.id);
    if (errorLine !== null) onOpenError?.(step.id);
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      id={getStepRowId(step.id)}
      data-step-id={step.id}
      onClick={handleClick}
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 border-b border-border px-2 py-1.5 text-xs",
        nested && "pl-8",
        isSelected ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">
          {index + 1}
        </span>
        {showLane && (
          <span
            data-testid={`step-lane-${lane}`}
            role="img"
            aria-label={t("runLogLaneAriaLabel", { lane: lane + 1 })}
            className={cn(
              "size-2 shrink-0 rounded-full",
              LANE_COLORS[lane % LANE_COLORS.length],
            )}
          />
        )}
        <StateIcon state={step.state} size="h-3.5 w-3.5" />
        {isApi ? (
          step.request && <MethodBadge method={step.request.method} />
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <span data-testid="step-type-icon" className="shrink-0" />
              }
            >
              <NodeIcon
                className="size-3.5 text-muted-foreground"
                aria-label={typeLabel}
              />
            </TooltipTrigger>
            <TooltipContent>{typeLabel}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="min-w-0 flex-1 truncate text-foreground" />
            }
          >
            {step.label}
          </TooltipTrigger>
          <TooltipContent>{step.label}</TooltipContent>
        </Tooltip>
        {nodeRemoved && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t("runLogNodeRemoved")}
          </span>
        )}
        {status !== undefined && (
          <span
            data-testid="step-http-status"
            className={cn(
              "w-8 shrink-0 text-right tabular-nums",
              getHttpStatusClass(status),
            )}
          >
            {status}
          </span>
        )}
        <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">
          {formatDuration(step.durationMs)}
        </span>
      </div>
      {errorLine !== null && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                data-testid="step-error-line"
                className="line-clamp-1 pl-8 text-left text-destructive"
              />
            }
          >
            {errorLine}
          </TooltipTrigger>
          <TooltipContent>{errorLine}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export const StepRow = memo(StepRowImpl);
