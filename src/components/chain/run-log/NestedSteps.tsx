"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { RunStep } from "@/lib/chainRunHistory";
import { StepRow } from "./StepRow";
import { useToggleSet } from "./useToggleSet";

/** Extra left indent in px per nesting level below the first. */
const NESTING_INDENT_PX = 12;

const GROUP_TOGGLE_CLASS =
  "flex w-full items-center gap-2 border-b border-border bg-muted/30 px-2 py-1 pl-6 text-left text-xs text-muted-foreground hover:bg-muted/50";

type NestedStepsProps = {
  /** The step whose nested steps (Loop iterations / Sub-chain run) render below it. */
  parent: RunStep;
  /** Every visible step; children are found by matching `parentStepId` to `parent.id`. */
  steps: RunStep[];
  selectedStepId: string | null;
  onSelect: (stepId: string) => void;
  /** 0 for direct children of a top-level step. */
  depth?: number;
};

type GroupToggleProps = {
  testId: string;
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
};

function GroupToggle({
  testId,
  label,
  count,
  isExpanded,
  onToggle,
}: GroupToggleProps) {
  const Chevron = isExpanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      data-testid={testId}
      aria-expanded={isExpanded}
      onClick={onToggle}
      className={GROUP_TOGGLE_CLASS}
    >
      <Chevron className="size-3 shrink-0" aria-hidden />
      <span>{label}</span>
      <span className="ml-auto tabular-nums">{count}</span>
    </button>
  );
}

type NestedStepGroupProps = {
  testId: string;
  label: string;
  steps: RunStep[];
  isExpanded: boolean;
  onToggle: () => void;
  style: React.CSSProperties;
  renderChild: (step: RunStep, index: number) => React.ReactNode;
};

/** One collapsible group of nested steps (a Loop iteration or a Sub-chain run). */
function NestedStepGroup({
  testId,
  label,
  steps,
  isExpanded,
  onToggle,
  style,
  renderChild,
}: NestedStepGroupProps) {
  return (
    <div style={style}>
      <GroupToggle
        testId={testId}
        label={label}
        count={steps.length}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
      {isExpanded && steps.map(renderChild)}
    </div>
  );
}

const byStartedAt = (a: RunStep, b: RunStep) => a.startedAt - b.startedAt;

/**
 * Renders a step's nested steps, recursing so a Loop inside a Loop, a
 * Sub-chain inside a Sub-chain, or any mix, nests to arbitrary depth. Loop
 * children (which carry `iteration`) group per iteration; Sub-chain children
 * form one flat group.
 */
export function NestedSteps({
  parent,
  steps,
  selectedStepId,
  onSelect,
  depth = 0,
}: NestedStepsProps) {
  const t = useTranslations("chain");
  const { has: isExpanded, toggle } = useToggleSet();

  const { iterations, subChainSteps } = useMemo(() => {
    const children = steps
      .filter((step) => step.parentStepId === parent.id)
      .sort(byStartedAt);
    const byIteration = new Map<number, RunStep[]>();
    const flat: RunStep[] = [];
    for (const child of children) {
      if (child.iteration === undefined) {
        flat.push(child);
        continue;
      }
      byIteration.set(child.iteration, [
        ...(byIteration.get(child.iteration) ?? []),
        child,
      ]);
    }
    const sorted = [...byIteration.entries()].sort(([a], [b]) => a - b);
    return { iterations: sorted, subChainSteps: flat };
  }, [steps, parent.id]);

  const indent = { paddingLeft: depth * NESTING_INDENT_PX };

  const renderGroup = (
    key: string,
    groupProps: { testId: string; label: string; children: RunStep[] },
  ) => (
    <NestedStepGroup
      key={key}
      testId={groupProps.testId}
      label={groupProps.label}
      steps={groupProps.children}
      isExpanded={isExpanded(key)}
      onToggle={() => toggle(key)}
      style={indent}
      renderChild={(child, index) => (
        <div key={child.id}>
          <StepRow
            step={child}
            index={index}
            isSelected={child.id === selectedStepId}
            onSelect={onSelect}
            nested
          />
          <NestedSteps
            parent={child}
            steps={steps}
            selectedStepId={selectedStepId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        </div>
      )}
    />
  );

  return (
    <>
      {iterations.map(([iteration, children]) =>
        renderGroup(`${parent.id}:${iteration}`, {
          testId: `iteration-toggle-${parent.id}-${iteration}`,
          label: t("runLogIterationLabel", { iteration: iteration + 1 }),
          children,
        }),
      )}
      {subChainSteps.length > 0 &&
        renderGroup(parent.id, {
          testId: `subchain-toggle-${parent.id}`,
          label: t("runLogSubChainSteps"),
          children: subChainSteps,
        })}
    </>
  );
}
