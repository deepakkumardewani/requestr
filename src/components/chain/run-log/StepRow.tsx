"use client";

import {
  Circle,
  Clock,
  GitBranch,
  GitMerge,
  Globe,
  ListChecks,
  Monitor,
  PlayCircle,
  Repeat,
  ShieldCheck,
  SquareFunction,
} from "lucide-react";
import { memo } from "react";
import { MethodBadge } from "@/components/common/MethodBadge";
import type { RunStep } from "@/lib/chainRunHistory";
import { cn, formatDuration } from "@/lib/utils";
import { StateIcon } from "../nodes/nodeStateStyles";

const NODE_TYPE_ICON = {
  api: Globe,
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

/** Tailwind color per lane index; cycles if more lanes than colors exist. */
const LANE_COLORS = [
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-fuchsia-500",
] as const;

type StepRowProps = {
  step: RunStep;
  index: number;
  isSelected: boolean;
  onSelect: (stepId: string) => void;
  /** Lane index assigned by interval scheduling; 0 when steps run sequentially. */
  lane?: number;
  /** Whether any step in the current run overlaps another — hides the lane dot when false. */
  showLane?: boolean;
  /** True for a loop-iteration sub-step, rendered indented under its Loop's iteration group (P8.8). */
  nested?: boolean;
};

function StepRowImpl({
  step,
  index,
  isSelected,
  onSelect,
  lane = 0,
  showLane = false,
  nested = false,
}: StepRowProps) {
  const NodeIcon = NODE_TYPE_ICON[step.nodeType] ?? Circle;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      data-step-id={step.id}
      onClick={() => onSelect(step.id)}
      className={cn(
        "flex cursor-pointer items-center gap-2 border-b border-border px-2 py-1.5 text-xs",
        nested && "pl-8",
        isSelected ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <span className="w-4 shrink-0 text-right text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      {showLane && (
        <span
          data-testid={`step-lane-${lane}`}
          role="img"
          aria-label={`Lane ${lane + 1}`}
          className={cn(
            "size-2 shrink-0 rounded-full",
            LANE_COLORS[lane % LANE_COLORS.length],
          )}
        />
      )}
      <NodeIcon
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span className="flex-1 truncate text-foreground">{step.label}</span>
      {step.nodeType === "api" && step.request && (
        <MethodBadge method={step.request.method} />
      )}
      <StateIcon state={step.state} size="h-3.5 w-3.5" />
      <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">
        {formatDuration(step.durationMs)}
      </span>
    </div>
  );
}

export const StepRow = memo(StepRowImpl);
