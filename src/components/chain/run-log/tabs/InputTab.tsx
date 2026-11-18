"use client";

import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";
import { MethodBadge } from "@/components/common/MethodBadge";
import type { RunStep, StepInputs } from "@/lib/chainRunHistory";
import { formatDuration } from "@/lib/utils";

const MIN_INJECTED_VALUE_LENGTH = 1;

/**
 * `RunStep.request` holds the resolved (post-substitution) request, not the
 * template — so we can't know for certain which parts of a URL/header were
 * injected. As an honest, computable signal we instead check whether any
 * `extractedValues` entry's string form appears verbatim inside the text, and
 * highlight those occurrences. This is a heuristic, not a guarantee.
 */
function highlightInjectedSubstrings(
  text: string,
  needles: string[],
): ReactNode {
  const usableNeedles = needles.filter(
    (needle) => needle.length >= MIN_INJECTED_VALUE_LENGTH,
  );
  if (usableNeedles.length === 0) return text;

  const pattern = usableNeedles
    .map((needle) => needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "g"));

  let offset = 0;
  return parts.map((part) => {
    const key = `${offset}-${part}`;
    offset += part.length;
    return usableNeedles.includes(part) ? (
      <mark
        key={key}
        data-testid="injected-value"
        className="rounded bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/30"
      >
        {part}
      </mark>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    );
  });
}

function extractedValueStrings(
  extractedValues: Record<string, unknown>,
): string[] {
  return Object.values(extractedValues)
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
    .filter((value): value is string => Boolean(value));
}

type KeyValueListProps = {
  entries: [string, string][];
  needles: string[];
};

function KeyValueList({ entries, needles }: KeyValueListProps) {
  return (
    <dl className="flex flex-col gap-0.5 font-mono text-[11px]">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1.5">
          <dt className="shrink-0 text-muted-foreground">{key}:</dt>
          <dd className="break-all text-foreground">
            {highlightInjectedSubstrings(value, needles)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type UnresolvedVarsSectionProps = {
  label: string;
  unresolvedVars: string[];
};

function UnresolvedVarsSection({
  label,
  unresolvedVars,
}: UnresolvedVarsSectionProps) {
  if (unresolvedVars.length === 0) return null;

  return (
    <div className="text-xs">
      <span className="font-medium text-foreground">{label}: </span>
      <span
        data-testid="unresolved-vars"
        className="font-mono text-amber-600 dark:text-amber-400"
      >
        {unresolvedVars.map((name) => `{{${name}}}`).join(", ")}
      </span>
    </div>
  );
}

function ApiRequestInput({ step }: { step: RunStep }) {
  const t = useTranslations("chain");
  const request = step.request;
  if (!request) return null;

  const needles = extractedValueStrings(step.extractedValues);
  const headerEntries = Object.entries(request.headers);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <MethodBadge method={request.method} />
        <span className="break-all font-mono text-[11px] text-foreground">
          {highlightInjectedSubstrings(request.url, needles)}
        </span>
      </div>

      {headerEntries.length > 0 && (
        <div>
          <div className="mb-1 font-medium text-foreground">
            {t("inputTabHeaders")}
          </div>
          <KeyValueList entries={headerEntries} needles={needles} />
        </div>
      )}

      {request.body && (
        <div>
          <div className="mb-1 font-medium text-foreground">
            {t("inputTabBody")}
          </div>
          <pre className="whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[11px] text-foreground">
            {highlightInjectedSubstrings(request.body, needles)}
          </pre>
        </div>
      )}

      <UnresolvedVarsSection
        label={t("inputTabUnresolvedVars")}
        unresolvedVars={step.unresolvedVars}
      />
    </div>
  );
}

type LabelledValue = { label: string; value: string };

function LabelledValues({ rows }: { rows: LabelledValue[] }) {
  return (
    <dl className="flex flex-col gap-1 text-xs">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex gap-1.5">
          <dt className="shrink-0 font-medium text-foreground">{label}:</dt>
          <dd className="break-all font-mono text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DelayInput({ step }: { step: RunStep }) {
  const t = useTranslations("chain");
  // Older runs never recorded the configured wait, so fall back to the measured one.
  const durationMs = step.inputs?.delayMs ?? step.durationMs;
  return (
    <LabelledValues
      rows={[
        {
          label: t("inputTabDelayDuration"),
          value: formatDuration(durationMs),
        },
      ]}
    />
  );
}

function ConditionInput({ step }: { step: RunStep }) {
  const t = useTranslations("chain");
  const condition = step.inputs?.condition;
  if (!condition) return null;
  return (
    <div className="flex flex-col gap-2">
      <LabelledValues
        rows={[
          { label: t("inputTabConditionVariable"), value: condition.variable },
          { label: t("inputTabConditionValue"), value: condition.value },
        ]}
      />
      <UnresolvedVarsSection
        label={t("inputTabUnresolvedVars")}
        unresolvedVars={step.unresolvedVars}
      />
    </div>
  );
}

function LoopInput({ loop }: { loop: NonNullable<StepInputs["loop"]> }) {
  const t = useTranslations("chain");
  return (
    <LabelledValues
      rows={[
        { label: t("inputTabLoopSource"), value: loop.sourceJsonPath },
        { label: t("inputTabLoopAlias"), value: loop.itemAlias },
        ...(loop.itemCount === undefined
          ? []
          : [{ label: t("inputTabLoopItems"), value: String(loop.itemCount) }]),
      ]}
    />
  );
}

type ValuesInputProps = {
  step: RunStep;
  /** Heading shown above the recorded values. */
  heading: string;
};

function ValuesInput({ step, heading }: ValuesInputProps) {
  const t = useTranslations("chain");
  const entries = Object.entries(step.extractedValues).map<[string, string]>(
    ([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ],
  );

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("inputTabEmpty")}</p>
    );
  }

  return (
    <div className="text-xs">
      <div className="mb-1 font-medium text-foreground">{heading}</div>
      <KeyValueList entries={entries} needles={[]} />
    </div>
  );
}

type InputTabProps = {
  step: RunStep;
};

/**
 * Renders the resolved input for a run step: the request as sent for API
 * steps, the recorded `inputs` for Delay / Condition / Loop, and otherwise the
 * closest real data on the step (older runs predate `inputs`).
 */
export function InputTab({ step }: InputTabProps) {
  const t = useTranslations("chain");

  if (step.nodeType === "api" && step.request) {
    return <ApiRequestInput step={step} />;
  }

  if (step.nodeType === "delay") {
    return <DelayInput step={step} />;
  }

  if (step.inputs?.condition) {
    return <ConditionInput step={step} />;
  }

  if (step.inputs?.loop) {
    return <LoopInput loop={step.inputs.loop} />;
  }

  if (step.nodeType === "start") {
    // Start steps record every chain input's effective value in
    // `extractedValues` (see `startExecutor`), so label them as inputs.
    return <ValuesInput step={step} heading={t("inputTabStartInputs")} />;
  }

  if (Object.keys(step.extractedValues).length > 0) {
    return <ValuesInput step={step} heading={t("inputTabEvaluatedValues")} />;
  }

  return <p className="text-xs text-muted-foreground">{t("inputTabEmpty")}</p>;
}
