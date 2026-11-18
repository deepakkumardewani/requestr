"use client";

import { useEffect, useId, useState } from "react";
import { runJsonPath } from "@/lib/transformRunner";
import { cn } from "@/lib/utils";
import { DemoFrame, DemoPicker } from "./DemoFrame";
import { useDemoCycle } from "./useDemoCycle";

const CYCLE_MS = 3200;
const SAMPLE = {
  orders: [
    {
      id: "ord_1042",
      customer: "Ada",
      total: 129.5,
      items: [{ sku: "KB-01" }],
    },
    { id: "ord_1043", customer: "Linus", total: 18, items: [{ sku: "MS-07" }] },
    {
      id: "ord_1044",
      customer: "Grace",
      total: 64.25,
      items: [{ sku: "KB-01" }, { sku: "CB-12" }],
    },
  ],
};
const SAMPLE_TEXT = JSON.stringify(SAMPLE, null, 2);
const PRESETS = [
  { id: "ids", label: "every id", expression: "$.orders[*].id" },
  {
    id: "filter",
    label: "total > 50",
    expression: "$.orders[?(@.total > 50)].customer",
  },
  { id: "deep", label: "every sku", expression: "$..sku" },
] as const;

type Result = { output: string } | { error: string };

/** Runs the expression with the playground's own runner, dropping stale answers. */
function useJsonPathResult(expression: string): Result | null {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let current = true;
    runJsonPath(expression, SAMPLE_TEXT)
      .then((next) => current && setResult(next))
      .catch((error: unknown) => {
        if (!current) return;
        setResult({
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      current = false;
    };
  }, [expression]);

  return result;
}

function OutputPane({ result }: { result: Result | null }) {
  const failed = result !== null && "error" in result;
  return (
    <output
      aria-live="polite"
      aria-label="Output"
      className={cn(
        "block h-full overflow-auto whitespace-pre p-4 font-mono text-xs leading-relaxed",
        failed ? "text-[var(--method-delete)]" : "text-[var(--method-get)]",
      )}
    >
      {result === null ? "" : "error" in result ? result.error : result.output}
    </output>
  );
}

/** A small Transform Playground: a fixed payload and a JSONPath you can edit. */
export function TransformDemo() {
  const cycle = useDemoCycle({ count: PRESETS.length, intervalMs: CYCLE_MS });
  const [draft, setDraft] = useState<string | null>(null);
  const expression = draft ?? PRESETS[cycle.index].expression;
  const result = useJsonPathResult(expression);
  const inputId = useId();

  function pick(index: number) {
    setDraft(null);
    cycle.pick(index);
  }

  return (
    <DemoFrame
      label="Transform playground example"
      title="transform · JSONPath"
      frameRef={cycle.ref}
      controls={
        <DemoPicker
          label="Example expressions"
          options={PRESETS}
          activeIndex={draft === null ? cycle.index : -1}
          onPick={pick}
        />
      }
    >
      <div className="border-b border-border px-4 py-3">
        <label htmlFor={inputId} className="sr-only">
          JSONPath expression
        </label>
        <input
          id={inputId}
          value={expression}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            cycle.stop();
            setDraft(event.target.value);
          }}
          className="w-full rounded-md border border-input bg-input/30 px-3 py-2 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="grid h-[20rem] grid-rows-2 sm:h-[16rem] sm:grid-cols-2 sm:grid-rows-1">
        <pre
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling pane must be reachable by keyboard
          tabIndex={0}
          className="overflow-auto border-b border-border p-4 font-mono text-xs leading-relaxed text-muted-foreground sm:border-r sm:border-b-0"
        >
          {SAMPLE_TEXT}
        </pre>
        <OutputPane result={result} />
      </div>
    </DemoFrame>
  );
}
