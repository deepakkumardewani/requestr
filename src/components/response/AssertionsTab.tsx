"use client";

import {
  CheckCircle2,
  HelpCircle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAI } from "@/hooks/useAI";
import { assertionsSummary } from "@/lib/chainAssertions";
import { generateId } from "@/lib/utils";
import { useResponseStore } from "@/stores/useResponseStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { TabState } from "@/types";
import {
  ASSERTION_OPERATOR_LABEL_KEYS,
  type AssertionOperator,
  type ChainAssertion,
} from "@/types/chain";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

const SOURCE_OPTIONS = [
  { value: "status", labelKey: "responseAssertionsSourceStatus" },
  { value: "header", labelKey: "runLogAssertionSourceHeader" },
  { value: "jsonpath", labelKey: "runLogAssertionSourceJsonpath" },
] as const;

const OPERATORS: AssertionOperator[] = [
  "eq",
  "neq",
  "contains",
  "not_contains",
  "gt",
  "lt",
  "exists",
  "not_exists",
  "matches_regex",
];

const OPERATORS_WITHOUT_VALUE: AssertionOperator[] = ["exists", "not_exists"];

const TEST_EXAMPLES = [
  {
    labelKey: "responseAssertionsExampleStatus",
    source: "status",
    operator: "eq",
    value: "200",
  },
  {
    labelKey: "responseAssertionsExampleBodyKey",
    source: "jsonpath",
    sourcePath: "$.id",
    operator: "exists",
    value: "",
  },
  {
    labelKey: "responseAssertionsExampleHeader",
    source: "header",
    sourcePath: "content-type",
    operator: "contains",
    value: "json",
  },
];

type AssertionsTabProps = {
  tabId: string;
};

function AssertionRow({
  assertion,
  result,
  onChange,
  onRemove,
}: {
  assertion: ChainAssertion;
  result?: { passed: boolean; actual: string | null };
  onChange: (updated: ChainAssertion) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("chain");
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const { run: runAI, loading: aiLoading } = useAI<{ expression: string }>(
    "suggest-jsonpath",
  );

  const needsPath =
    assertion.source === "jsonpath" || assertion.source === "header";
  const needsValue = !OPERATORS_WITHOUT_VALUE.includes(assertion.operator);

  async function handleJsonpathAI() {
    if (!aiPrompt.trim()) return;
    const aiResult = await runAI({ description: aiPrompt.trim() });
    if (!aiResult?.expression) {
      toast.error(t("responseAssertionsAiFailed"));
      return;
    }
    onChange({ ...assertion, sourcePath: aiResult.expression });
    setAiPrompt("");
    setAiPopoverOpen(false);
  }

  return (
    <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2">
      {/* Pass/fail badge */}
      {result ? (
        result.passed ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="flex cursor-help items-center border-0 bg-transparent p-0"
              >
                <XCircle className="h-4 w-4 shrink-0 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>
                {t("responseAssertionsActual")}{" "}
                <span className="font-mono">{result.actual ?? "null"}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      ) : (
        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-border" />
      )}

      {/* Source selector */}
      <Select
        value={assertion.source}
        onValueChange={(v) =>
          onChange({
            ...assertion,
            source: v as ChainAssertion["source"],
            sourcePath: undefined,
          })
        }
      >
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {t(opt.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Source path (header name or JSONPath) */}
      {needsPath && (
        <div className="flex items-center gap-1">
          <Input
            className="h-7 w-36 text-xs font-mono"
            placeholder={
              assertion.source === "jsonpath" ? "$.data.id" : "content-type"
            }
            value={assertion.sourcePath ?? ""}
            onChange={(e) =>
              onChange({ ...assertion, sourcePath: e.target.value })
            }
          />
          {assertion.source === "jsonpath" && (
            <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
              <PopoverTrigger
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={t("responseAssertionsAskAi")}
                data-testid="jsonpath-row-ai-btn"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="start">
                <p className="mb-2 text-xs font-medium">
                  {t("responseAssertionsAskAi")}
                </p>
                <div className="flex gap-2">
                  <Input
                    className="h-7 flex-1 text-xs"
                    placeholder={t("responseAssertionsAiPlaceholder")}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleJsonpathAI();
                    }}
                    autoFocus
                    data-testid="jsonpath-row-ai-input"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => void handleJsonpathAI()}
                    disabled={aiLoading || !aiPrompt.trim()}
                    data-testid="jsonpath-row-ai-confirm"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      t("responseAssertionsAiGo")
                    )}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {/* Operator */}
      <Select
        value={assertion.operator}
        onValueChange={(v) =>
          onChange({ ...assertion, operator: v as AssertionOperator })
        }
      >
        <SelectTrigger className="h-7 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map((op) => (
            <SelectItem key={op} value={op} className="text-xs">
              {t(ASSERTION_OPERATOR_LABEL_KEYS[op])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Expected value */}
      {needsValue && (
        <Input
          className="h-7 min-w-0 flex-1 text-xs font-mono"
          placeholder={t("nodeAssertionsExpectedPlaceholder")}
          value={assertion.expectedValue ?? ""}
          onChange={(e) =>
            onChange({ ...assertion, expectedValue: e.target.value })
          }
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label={t("nodeAssertionsDeleteAriaLabel")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

type SuggestedAssertion = {
  source: "status" | "jsonpath" | "header";
  sourcePath?: string;
  operator: AssertionOperator;
  expectedValue?: string;
};

export function AssertionsTab({ tabId }: AssertionsTabProps) {
  const t = useTranslations("chain");
  const { tabs, updateTabState } = useTabsStore();
  const { assertionResults, responses } = useResponseStore();
  const { run, loading } = useAI<SuggestedAssertion[]>("suggest-assertions");

  const tab = tabs.find((candidate) => candidate.tabId === tabId);
  if (!tab || tab.type !== "http") return null;

  const assertions = tab.assertions ?? [];
  const results = assertionResults[tabId] ?? [];
  const response = responses[tabId] ?? null;
  const summary = results.length > 0 ? assertionsSummary(results) : null;

  async function handleSuggest() {
    if (!response) return;
    const result = await run({
      status: response.status,
      headers: response.headers,
      bodySnippet: response.body.slice(0, 2000),
    });
    if (!result) return;

    const newAssertions: ChainAssertion[] = result.map((a) => ({
      id: generateId(),
      source: a.source,
      sourcePath: a.sourcePath,
      operator: a.operator,
      expectedValue: a.expectedValue,
      enabled: true,
    }));

    if (newAssertions.length === 0) {
      toast.info(t("responseAssertionsNoSuggestions"));
      return;
    }

    updateAssertions([...assertions, ...newAssertions]);
    toast.success(
      t("responseAssertionsAdded", { count: newAssertions.length }),
    );
  }

  function getResult(assertionId: string) {
    return results.find((r) => r.assertionId === assertionId);
  }

  function updateAssertions(updated: ChainAssertion[]) {
    updateTabState(tabId, { assertions: updated } as Partial<TabState>);
  }

  function addAssertion() {
    const newAssertion: ChainAssertion = {
      id: generateId(),
      source: "status",
      operator: "eq",
      expectedValue: "200",
      enabled: true,
    };
    updateAssertions([...assertions, newAssertion]);
  }

  function updateAssertion(id: string, updated: ChainAssertion) {
    updateAssertions(assertions.map((a) => (a.id === id ? updated : a)));
  }

  function removeAssertion(id: string) {
    updateAssertions(assertions.filter((a) => a.id !== id));
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      {/* Summary bar */}
      {summary && (
        <div className="flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2 text-xs">
          <span className="font-medium">
            {t("responseAssertionsSummary", {
              passed: summary.passed,
              total: summary.total,
            })}
          </span>
          {summary.failed > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              {t("responseAssertionsFailedBadge", { count: summary.failed })}
            </Badge>
          )}
          {summary.failed === 0 && (
            <Badge className="h-5 bg-emerald-500/20 px-1.5 text-[10px] text-emerald-600 hover:bg-emerald-500/20">
              {t("responseAssertionsAllPassed")}
            </Badge>
          )}
        </div>
      )}

      {/* Assertion rows */}
      <div className="flex flex-col gap-2">
        {assertions.map((assertion) => (
          <AssertionRow
            key={assertion.id}
            assertion={assertion}
            result={getResult(assertion.id)}
            onChange={(updated) => updateAssertion(assertion.id, updated)}
            onRemove={() => removeAssertion(assertion.id)}
          />
        ))}
      </div>

      {/* Add / AI suggest buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-1.5 text-xs"
          onClick={addAssertion}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("responseAssertionsAdd")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => void handleSuggest()}
          disabled={loading || !response}
          data-testid="suggest-assertions-btn"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {t("responseAssertionsSuggest")}
        </Button>
      </div>

      {/* Help section */}
      {assertions.length === 0 && (
        <div className="rounded border border-dashed border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
            {t("responseAssertionsHelpTitle")}
          </div>
          <div className="space-y-2">
            {TEST_EXAMPLES.map((ex) => (
              <div key={ex.labelKey} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">
                  {t(ex.labelKey)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            {t("responseAssertionsHelpNote")}
          </p>
        </div>
      )}
    </div>
  );
}
