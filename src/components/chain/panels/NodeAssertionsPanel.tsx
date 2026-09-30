"use client";

import { Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  getOperatorsForSource,
  NO_VALUE_OPERATORS,
} from "@/lib/chainAssertions";
import { generateId } from "@/lib/utils";
import {
  ASSERTION_OPERATOR_LABELS,
  type AssertionOperator,
  type AssertionResult,
  type ChainAssertion,
} from "@/types/chain";

type NodeAssertionsPanelProps = {
  assertions: ChainAssertion[];
  assertionResults?: AssertionResult[];
  onChange: (assertions: ChainAssertion[]) => void;
};

const SOURCE_OPTIONS = [
  { value: "status", label: "Status Code" },
  { value: "jsonpath", label: "JSONPath" },
  { value: "header", label: "Header" },
  { value: "schema", label: "JSON Schema" },
] as const;

function makeBlankAssertion(): ChainAssertion {
  return {
    id: generateId(),
    source: "status",
    sourcePath: undefined,
    operator: "eq",
    expectedValue: "200",
    enabled: true,
  };
}

function AssertionRow({
  assertion,
  result,
  onChange,
  onDelete,
}: {
  assertion: ChainAssertion;
  result?: AssertionResult;
  onChange: (updated: ChainAssertion) => void;
  onDelete: () => void;
}) {
  const operators = getOperatorsForSource(assertion.source);
  const hideValue = NO_VALUE_OPERATORS.has(assertion.operator);
  const showSourcePath =
    assertion.source !== "status" && assertion.source !== "schema";
  const showSchema = assertion.source === "schema";

  const update = (patch: Partial<ChainAssertion>) =>
    onChange({ ...assertion, ...patch });

  const handleSourceChange = (source: ChainAssertion["source"]) => {
    // Reset path + operator when switching sources so state is clean
    const nextOperator: AssertionOperator =
      source === "status" ? "eq" : "exists";
    const nextExpected = source === "status" ? "200" : undefined;
    update({
      source,
      sourcePath: undefined,
      operator: nextOperator,
      expectedValue: nextExpected,
      schema: source === "schema" ? (assertion.schema ?? "") : undefined,
    });
  };

  const handleOperatorChange = (operator: AssertionOperator) => {
    update({
      operator,
      // Clear expected value when switching to exists/not_exists
      expectedValue: NO_VALUE_OPERATORS.has(operator)
        ? undefined
        : assertion.expectedValue,
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/50 bg-muted/10 p-3">
      {/* Top row: enable toggle + source selector + delete */}
      <div className="flex items-center gap-2">
        <Switch
          checked={assertion.enabled}
          onCheckedChange={(checked) => update({ enabled: checked })}
          aria-label="Enable assertion"
        />
        <Select
          value={assertion.source}
          onValueChange={(v) => {
            if (v !== null) handleSourceChange(v as ChainAssertion["source"]);
          }}
        >
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Result badge — only shown after a run */}
          {result !== undefined && (
            <span
              className={
                result.passed
                  ? "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30"
              }
            >
              {result.passed ? (
                <Check className="h-2.5 w-2.5" />
              ) : (
                <X className="h-2.5 w-2.5" />
              )}
              {result.passed ? "pass" : "fail"}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete assertion"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Source path input (hidden for status) */}
      {showSourcePath && (
        <Input
          value={assertion.sourcePath ?? ""}
          onChange={(e) => update({ sourcePath: e.target.value || undefined })}
          placeholder={
            assertion.source === "jsonpath" ? "$.data.token" : "x-auth-token"
          }
          className="h-7 text-xs font-mono"
          aria-label={
            assertion.source === "jsonpath"
              ? "JSONPath expression"
              : "Header name"
          }
        />
      )}

      {/* Schema editor (schema source only) */}
      {showSchema && (
        <textarea
          value={assertion.schema ?? ""}
          onChange={(e) => update({ schema: e.target.value })}
          placeholder='{"type": "object", "required": ["id"]}'
          rows={3}
          aria-label="JSON Schema"
          className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs font-mono resize-y"
        />
      )}

      {/* Operator + expected value row */}
      <div className="flex items-center gap-2">
        <Select
          value={assertion.operator}
          onValueChange={(v) => {
            if (v !== null) handleOperatorChange(v as AssertionOperator);
          }}
        >
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op} className="text-xs">
                {ASSERTION_OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!hideValue && (
          <Input
            value={assertion.expectedValue ?? ""}
            onChange={(e) =>
              update({ expectedValue: e.target.value || undefined })
            }
            placeholder="expected value"
            className="h-7 flex-1 text-xs font-mono"
            aria-label="Expected value"
          />
        )}
      </div>

      {/* Actual value received — shown after run */}
      {result !== undefined && (
        <p className="text-[10px] text-muted-foreground font-mono">
          actual:{" "}
          {result.actual === null ? (
            <span className="text-red-400 italic">not found</span>
          ) : (
            <span className="text-foreground">{result.actual}</span>
          )}
        </p>
      )}
    </div>
  );
}

export function NodeAssertionsPanel({
  assertions,
  assertionResults,
  onChange,
}: NodeAssertionsPanelProps) {
  const resultMap = new Map(
    (assertionResults ?? []).map((r) => [r.assertionId, r]),
  );

  const handleAdd = () => onChange([...assertions, makeBlankAssertion()]);

  const handleChange = (index: number, updated: ChainAssertion) => {
    const next = assertions.map((a, i) => (i === index ? updated : a));
    onChange(next);
  };

  const handleDelete = (index: number) => {
    onChange(assertions.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Assertions
        </Label>
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 text-xs"
          onClick={handleAdd}
        >
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>

      {assertions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No assertions yet. Add one to validate this node's response.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {assertions.map((assertion, i) => (
            <AssertionRow
              key={assertion.id}
              assertion={assertion}
              result={resultMap.get(assertion.id)}
              onChange={(updated) => handleChange(i, updated)}
              onDelete={() => handleDelete(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
