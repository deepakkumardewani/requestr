"use client";

import { AlertCircle, Braces, Play, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { runInWorker } from "@/lib/chainEvalHost";
import { isReservedAlias } from "@/lib/chainValueNamespace";
import type { EvaluateBlock } from "@/types/chain";

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
   * The `data` object the last run built for this node (aliased upstream values plus
   * `response`) — passed through unchanged to `runInWorker` by "Test with last run".
   * `undefined` until a run has completed.
   */
  testData?: unknown;
};

type TestOutcome = { output: unknown } | { error: string } | null;

export function EvaluateConfigPanel({
  open,
  node,
  onClose,
  onSave,
  onDelete,
  testData,
}: EvaluateConfigPanelProps) {
  const [code, setCode] = useState("");
  const [outputAlias, setOutputAlias] = useState("");
  const [testOutcome, setTestOutcome] = useState<TestOutcome>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!node) return;
    setCode(node.code);
    setOutputAlias(node.outputAlias);
    setTestOutcome(null);
  }, [node]);

  if (!node) return null;

  const aliasReserved = isReservedAlias(outputAlias.trim());
  const aliasEmpty = outputAlias.trim().length === 0;
  const aliasInvalid = aliasEmpty || aliasReserved;

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
        data: testData ?? {},
        inputs: {},
        env: {},
      });
      setTestOutcome(result);
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="right" className="w-[440px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Braces className="h-4 w-4 text-sky-400" />
            Configure Evaluate
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Output alias */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Output alias
            </Label>
            <Input
              value={outputAlias}
              onChange={(e) => setOutputAlias(e.target.value)}
              placeholder="e.g. token"
              className="h-8 text-sm font-mono"
              aria-invalid={aliasInvalid}
            />
            {aliasReserved && (
              <p className="flex items-center gap-1 text-[10px] text-destructive leading-snug">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Alias cannot start with{" "}
                <span className="font-mono">collect.</span> or{" "}
                <span className="font-mono">sub.</span> — those prefixes are
                reserved.
              </p>
            )}
            {!aliasReserved && aliasEmpty && (
              <p className="text-[10px] text-muted-foreground leading-snug">
                Downstream nodes reference the result via this alias.
              </p>
            )}
          </div>

          {/* Code */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">JavaScript</Label>
            <div className="h-48 overflow-hidden rounded-md border border-border">
              <CodeEditor
                value={code}
                onChange={setCode}
                language="javascript"
                placeholder="return data.response.token"
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Runs sandboxed with <span className="font-mono">data</span>,{" "}
              <span className="font-mono">inputs</span>, and{" "}
              <span className="font-mono">env</span> in scope.
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
              {isTesting ? "Testing…" : "Test with last run"}
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
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={aliasInvalid}
          >
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onClose}
          >
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete node
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
