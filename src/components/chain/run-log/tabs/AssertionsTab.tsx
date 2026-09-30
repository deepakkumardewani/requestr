"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { NO_VALUE_OPERATORS } from "@/lib/chainAssertions";
import type { RunStep } from "@/lib/chainRunHistory";
import { cn } from "@/lib/utils";
import {
  ASSERTION_OPERATOR_LABELS,
  type AssertionResult,
  type ChainAssertion,
} from "@/types/chain";

type AssertionsTabProps = {
  step: RunStep;
  /** The node's configured assertions (for expected value / operator display). Optional since not yet wired by the caller. */
  assertions?: ChainAssertion[];
};

const NO_VALUE_PLACEHOLDER = "—";

const SOURCE_LABELS: Record<ChainAssertion["source"], string> = {
  status: "Status Code",
  jsonpath: "JSONPath",
  header: "Header",
  schema: "JSON Schema",
};

function describeAssertion(
  assertion?: ChainAssertion,
  assertionId?: string,
): string {
  if (!assertion) return assertionId ?? "";

  const sourceLabel = SOURCE_LABELS[assertion.source];
  const pathSegment = assertion.sourcePath ? ` ${assertion.sourcePath}` : "";
  const operatorLabel = ASSERTION_OPERATOR_LABELS[assertion.operator];

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
}: {
  result: AssertionResult;
  assertion?: ChainAssertion;
  expectedLabel: string;
  actualLabel: string;
}) {
  const description = describeAssertion(assertion, result.assertionId);
  const actualValue = result.actual ?? NO_VALUE_PLACEHOLDER;

  return (
    <div className="flex flex-col gap-1 rounded border border-border bg-muted/30 p-2">
      <div className="flex items-center gap-1.5 font-mono">
        {result.passed ? (
          <Check
            className="h-3 w-3 shrink-0 text-emerald-600"
            aria-label="passed"
          />
        ) : (
          <X
            className="h-3 w-3 shrink-0 text-destructive"
            aria-label="failed"
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
        />
      ))}
    </div>
  );
}
