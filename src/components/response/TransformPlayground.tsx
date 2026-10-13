"use client";

import { Copy, Loader2, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { OpenInRelayButton } from "@/components/relay/OpenInRelayButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";
import { useAI } from "@/hooks/useAI";
import {
  JSONPATH_DEFAULT_DESCRIPTION,
  suggestJsonpathPrompt,
} from "@/lib/relay/prompts";
import { runJs, runJsonPath } from "@/lib/transformRunner";
import type { PlaygroundMode } from "@/stores/usePlaygroundStore";
import { usePlaygroundStore } from "@/stores/usePlaygroundStore";

const CodeEditor = dynamic(() => import("@/components/request/CodeEditor"), {
  ssr: false,
});

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB

type TransformPlaygroundProps = {
  tabId: string;
  responseBody: string | null;
  responseStatus: number | null;
  responseHeaders: Record<string, string>;
};

const MODE_LABELS: Record<PlaygroundMode, string> = {
  jsonpath: "JSONPath",
  js: "JavaScript",
};

const JSONPATH_PLACEHOLDER = "data[*].email\n// ($. is auto-added)";
const JS_PLACEHOLDER =
  "data[0].email\n// (return response.json. is auto-added)\n// Or custom map: return response.json.map(x => x);";

export function TransformPlayground({
  tabId,
  responseBody,
  responseStatus,
  responseHeaders,
}: TransformPlaygroundProps) {
  const [showAiBar, setShowAiBar] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const { run: runAI, loading: aiLoading } = useAI<{ expression: string }>(
    "suggest-jsonpath",
  );
  const { getPlayground, setMode, setCode, setResult } = usePlaygroundStore();
  const playground = getPlayground(tabId);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExecutingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const isTooLarge =
    responseBody !== null && responseBody.length > MAX_RESPONSE_BYTES;
  const hasResponse = responseBody !== null && responseBody.length > 0;

  const execute = useCallback(
    async (code: string, mode: PlaygroundMode, body: string) => {
      if (!code.trim()) {
        setResult(tabId, null, null);
        return;
      }

      isExecutingRef.current = true;

      const responseObj = {
        text: body,
        json: (() => {
          try {
            return JSON.parse(body);
          } catch {
            return null;
          }
        })(),
        status: responseStatus ?? 0,
        headers: responseHeaders,
      };

      const result =
        mode === "jsonpath"
          ? await runJsonPath(code, body)
          : await runJs(code, responseObj);

      isExecutingRef.current = false;

      if ("error" in result) {
        setResult(tabId, null, result.error);
      } else {
        setResult(tabId, result.output, null);
      }
    },
    [tabId, responseStatus, responseHeaders, setResult],
  );

  function handleCodeChange(code: string) {
    setCode(tabId, code);

    if (!hasResponse || isTooLarge) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      execute(code, playground.mode, responseBody ?? "");
    }, 300);
  }

  useEffect(() => {
    if (!hasResponse || !playground.code.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    execute(playground.code, playground.mode, responseBody ?? "");
    // intentionally run only when responseBody changes
  }, [responseBody]);

  function handleModeSwitch(mode: PlaygroundMode) {
    setMode(tabId, mode);
  }

  async function handleCopyOutput() {
    if (!playground.output) return;
    try {
      await navigator.clipboard.writeText(playground.output);
      toast.success("Output copied");
    } catch {
      toast.error("Failed to copy");
    }
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    const result = await runAI({
      description: aiPrompt.trim(),
      bodySnippet: responseBody?.slice(0, 2000) ?? "",
    });
    if (!result?.expression) {
      toast.error("AI could not generate a JSONPath expression");
      return;
    }
    setCode(tabId, result.expression);
    setAiPrompt("");
    setShowAiBar(false);
  }

  const editorDisabled = !hasResponse || isTooLarge;
  const editorLanguage =
    playground.mode === "js" ? ("javascript" as const) : ("text" as const);

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      data-testid="transform-playground"
    >
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <div className="flex overflow-hidden rounded-md border text-xs">
          {(["jsonpath", "js"] as PlaygroundMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleModeSwitch(m)}
              className={`px-2.5 py-1 transition-colors ${
                playground.mode === m
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {playground.mode === "jsonpath" && hasResponse && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowAiBar((v) => !v)}
              data-testid="jsonpath-ai-btn"
            >
              <Sparkles className="h-3 w-3" />
              Ask AI
            </Button>
          )}
          {playground.mode === "jsonpath" && hasResponse && (
            <OpenInRelayButton
              tabId={tabId}
              prompt={suggestJsonpathPrompt({
                description: aiPrompt.trim() || JSONPATH_DEFAULT_DESCRIPTION,
                bodySnippet: responseBody?.slice(0, 2000),
              })}
            />
          )}
          <TooltipIconButton
            label="Copy output"
            onClick={handleCopyOutput}
            disabled={!playground.output}
          >
            <Copy className="h-3.5 w-3.5" />
          </TooltipIconButton>
        </div>
      </div>

      {showAiBar && playground.mode === "jsonpath" && hasResponse && (
        <div
          className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5"
          data-testid="jsonpath-ai-bar"
        >
          <Input
            className="h-7 flex-1 text-xs"
            placeholder="Describe the value you want to extract..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAiGenerate();
            }}
            autoFocus
            data-testid="jsonpath-ai-input"
          />
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => void handleAiGenerate()}
            disabled={aiLoading || !aiPrompt.trim()}
            data-testid="jsonpath-ai-generate-btn"
          >
            {aiLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Generate"
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setShowAiBar(false);
              setAiPrompt("");
            }}
            data-testid="jsonpath-ai-close-btn"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {!hasResponse && (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Send a request to use the Transform Playground
        </div>
      )}

      {hasResponse && isTooLarge && (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Response too large (&gt; 5MB) — download and transform locally
        </div>
      )}

      {hasResponse && !isTooLarge && (
        <div className="grid min-h-0 flex-1 grid-cols-2 divide-x">
          <div
            className={`min-h-0 overflow-hidden ${playground.error ? "ring-1 ring-inset ring-destructive" : ""}`}
          >
            <CodeEditor
              value={playground.code}
              language={editorLanguage}
              onChange={handleCodeChange}
              readOnly={editorDisabled}
              placeholder={
                playground.mode === "jsonpath"
                  ? JSONPATH_PLACEHOLDER
                  : JS_PLACEHOLDER
              }
            />
          </div>

          <div className="min-h-0 overflow-auto p-3 text-xs font-mono">
            {playground.error ? (
              <span className="text-destructive">{playground.error}</span>
            ) : playground.output === "[]" ? (
              <span className="text-muted-foreground">[]</span>
            ) : playground.output ? (
              <pre className="whitespace-pre-wrap break-all text-foreground">
                {playground.output}
              </pre>
            ) : (
              <span className="text-muted-foreground">
                Output will appear here
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
