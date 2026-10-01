"use client";

import { AlertCircle, Braces, Play } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runInWorker } from "@/lib/chainEvalHost";
import type { EvaluateSandboxInput } from "@/lib/chainRunner/evaluateData";
import {
  isReservedAlias,
  listNamespaceProducers,
} from "@/lib/chainValueNamespace";
import type { ChainBlock, ChainEdge, EvaluateBlock } from "@/types/chain";
import { ConfigPanelShell } from "./ConfigPanelShell";
import { useSyncOnNode } from "./useSyncOnNode";

const CodeEditor = dynamic(() => import("@/components/request/CodeEditor"), {
  ssr: false,
});

type EvaluateConfigPanelProps = {
  open: boolean;
  node: EvaluateBlock | null;
  onClose: () => void;
  onSave: (node: EvaluateBlock) => void;
  onDelete: (nodeId: string) => void;
  /**
   * The `{ data, inputs, env }` built from the last run for this node (aliased upstream
   * values plus `response`, chain inputs, env vars) — passed to `runInWorker` by
   * "Test with last run". Falls back to empty values when absent.
   */
  testInput?: EvaluateSandboxInput;
  /** Whole-chain blocks and edges, used to reject an alias another producer already publishes. */
  chainBlocks?: ChainBlock[];
  chainEdges?: ChainEdge[];
};

type TestOutcome = { output: unknown } | { error: string } | null;

export function EvaluateConfigPanel({
  open,
  node,
  onClose,
  onSave,
  onDelete,
  testInput,
  chainBlocks = [],
  chainEdges = [],
}: EvaluateConfigPanelProps) {
  const t = useTranslations("chain");
  const [code, setCode] = useState("");
  const [outputAlias, setOutputAlias] = useState("");
  const [testOutcome, setTestOutcome] = useState<TestOutcome>(null);
  const [isTesting, setIsTesting] = useState(false);

  useSyncOnNode(node, (n) => {
    setCode(n.code);
    setOutputAlias(n.outputAlias);
    setTestOutcome(null);
  });

  if (!node) return null;

  const aliasReserved = isReservedAlias(outputAlias.trim());
  const aliasEmpty = outputAlias.trim().length === 0;
  // Other producers only: this node's own saved alias is not a collision.
  const aliasTaken = listNamespaceProducers(chainBlocks, chainEdges).some(
    ({ name, source }) =>
      name === outputAlias.trim() &&
      !(source.kind === "evaluate" && source.id === node.id),
  );
  const aliasInvalid = aliasEmpty || aliasReserved || aliasTaken;

  function handleSave() {
    if (!node || aliasInvalid) return;
    onSave({ ...node, code, outputAlias: outputAlias.trim() });
    onClose();
  }

  async function handleTest() {
    setIsTesting(true);
    setTestOutcome(null);
    try {
      const result = await runInWorker({
        code,
        data: testInput?.data ?? {},
        inputs: testInput?.inputs ?? {},
        env: testInput?.env ?? {},
      });
      setTestOutcome(result);
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <ConfigPanelShell
      open={open}
      title={t("evaluateConfigTitle")}
      icon={Braces}
      iconClassName="text-sky-400"
      widthClass="w-[440px]"
      canSave={!aliasInvalid}
      onSave={handleSave}
      onDelete={() => onDelete(node.id)}
      onClose={onClose}
    >
      {/* Output alias */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("evaluateConfigOutputAliasLabel")}
        </Label>
        <Input
          value={outputAlias}
          onChange={(e) => setOutputAlias(e.target.value)}
          placeholder={t("evaluateConfigOutputAliasPlaceholder")}
          className="h-8 text-sm font-mono"
          aria-invalid={aliasInvalid}
        />
        {aliasReserved && (
          <p className="flex items-center gap-1 text-[10px] text-destructive leading-snug">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {t.rich("evaluateConfigAliasReserved", {
              code: (chunks) => <span className="font-mono">{chunks}</span>,
            })}
          </p>
        )}
        {!aliasReserved && aliasTaken && (
          <p className="flex items-center gap-1 text-[10px] text-destructive leading-snug">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {t("evaluateConfigAliasTaken", { alias: outputAlias.trim() })}
          </p>
        )}
        {!aliasReserved && aliasEmpty && (
          <p className="text-[10px] text-muted-foreground leading-snug">
            {t("evaluateConfigAliasHint")}
          </p>
        )}
      </div>

      {/* Code */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("evaluateConfigJavascriptLabel")}
        </Label>
        <div className="h-48 overflow-hidden rounded-md border border-border">
          <CodeEditor
            value={code}
            onChange={setCode}
            language="javascript"
            placeholder={t("evaluateConfigCodePlaceholder")}
          />
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {t.rich("evaluateConfigSandboxHint", {
            code: (chunks) => <span className="font-mono">{chunks}</span>,
          })}
        </p>
      </div>

      {/* Test with last run */}
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleTest}
          disabled={isTesting}
        >
          <Play className="h-3 w-3" />
          {isTesting
            ? t("evaluateConfigTesting")
            : t("evaluateConfigTestButton")}
        </Button>

        {testOutcome && "output" in testOutcome && (
          <pre
            data-testid="evaluate-test-output"
            className="max-h-40 overflow-auto rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-[10px] text-emerald-400"
          >
            {JSON.stringify(testOutcome.output, null, 2)}
          </pre>
        )}
        {testOutcome && "error" in testOutcome && (
          <p
            data-testid="evaluate-test-error"
            className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[10px] text-destructive leading-snug"
          >
            {testOutcome.error}
          </p>
        )}
      </div>
    </ConfigPanelShell>
  );
}
