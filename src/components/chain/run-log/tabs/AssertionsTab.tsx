"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { NO_VALUE_OPERATORS } from "@/lib/chainAssertions";
import type { RunStep } from "@/lib/chainRunHistory";
import { cn } from "@/lib/utils";
import {
  ASSERTION_OPERATOR_LABEL_KEYS,
  type AssertionResult,
  type ChainAssertion,
} from "@/types/chain";

type AssertionsTabProps = {
  step: RunStep;
  /** The assertion definitions the step was evaluated against (`RunStep.assertions`); absent on older runs, which fall back to the raw id. */
  assertions?: ChainAssertion[];
};

const NO_VALUE_PLACEHOLDER = "—";

const SOURCE_LABEL_KEYS: Record<ChainAssertion["source"], string> = {
  status: "runLogAssertionSourceStatus",
  jsonpath: "runLogAssertionSourceJsonpath",
  header: "runLogAssertionSourceHeader",
  schema: "runLogAssertionSourceSchema",
};

function describeAssertion(
  t: (key: string) => string,
  assertion?: ChainAssertion,
  assertionId?: string,
): string {
  if (!assertion) return assertionId ?? "";

  const sourceLabel = t(SOURCE_LABEL_KEYS[assertion.source]);
  const pathSegment = assertion.sourcePath ? ` ${assertion.sourcePath}` : "";
  const operatorLabel = t(ASSERTION_OPERATOR_LABEL_KEYS[assertion.operator]);

  return `${sourceLabel}${pathSegment} ${operatorLabel}`;
}

function getExpectedValue(assertion?: ChainAssertion): string {
  if (!assertion) return NO_VALUE_PLACEHOLDER;
  if (NO_VALUE_OPERATORS.has(assertion.operator)) return NO_VALUE_PLACEHOLDER;
  return assertion.expectedValue ?? NO_VALUE_PLACEHOLDER;
}

function AssertionRow({
  result,
  assertion,
  expectedLabel,
  actualLabel,
  t,
}: {
  result: AssertionResult;
  assertion?: ChainAssertion;
  expectedLabel: string;
  actualLabel: string;
  t: (key: string) => string;
}) {
  const description = describeAssertion(t, assertion, result.assertionId);
  const actualValue = result.actual ?? NO_VALUE_PLACEHOLDER;

  return (
    <div className="flex flex-col gap-1 rounded border border-border bg-muted/30 p-2">
      <div className="flex items-center gap-1.5 font-mono">
        {result.passed ? (
          <Check
            className="h-3 w-3 shrink-0 text-emerald-600"
            aria-label={t("nodeAssertionsResultPass")}
          />
        ) : (
          <X
            className="h-3 w-3 shrink-0 text-destructive"
            aria-label={t("nodeAssertionsResultFail")}
          />
        )}
        <span
          className={cn(result.passed ? "text-foreground" : "text-destructive")}
        >
          {description}
        </span>
      </div>
      <div className="flex gap-1.5">
        <span className="shrink-0 text-muted-foreground">{expectedLabel}:</span>
        <span className="break-all font-mono text-foreground">
          {getExpectedValue(assertion)}
        </span>
      </div>
      <div className="flex gap-1.5">
        <span className="shrink-0 text-muted-foreground">{actualLabel}:</span>
        <span className="break-all font-mono text-foreground">
          {actualValue}
        </span>
      </div>
    </div>
  );
}

export function AssertionsTab({ step, assertions }: AssertionsTabProps) {
  const t = useTranslations("chain");
  const results = step.assertionResults;

  if (!results || results.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("runLogAssertionsEmpty")}
      </p>
    );
  }

  const assertionMap = new Map((assertions ?? []).map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-2 text-xs">
      {results.map((result) => (
        <AssertionRow
          key={result.assertionId}
          result={result}
          assertion={assertionMap.get(result.assertionId)}
          expectedLabel={t("runLogAssertionsExpectedLabel")}
          actualLabel={t("runLogAssertionsActualLabel")}
          t={t}
        />
      ))}
    </div>
  );
}
