"use client";

import {
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { OpenInRelayButton } from "@/components/relay/OpenInRelayButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAI } from "@/hooks/useAI";
import { useEnvVariableKeys } from "@/hooks/useEnvVariableKeys";
import {
  WRITE_SCRIPT_DEFAULT_DESCRIPTION,
  writeScriptPrompt,
} from "@/lib/relay/prompts";
import { checkSyntax } from "@/lib/scriptLinter";
import { useResponseStore } from "@/stores/useResponseStore";
import { useTabsStore } from "@/stores/useTabsStore";

const CodeEditor = dynamic(() => import("./CodeEditor"), { ssr: false });

type LintStatus =
  | { state: "idle" }
  | { state: "ok" }
  | { state: "error"; message: string; line?: number; column?: number };

type ScriptEditorProps = {
  tabId: string;
};

type ScriptResponse = { status: number; body: string } | null | undefined;

function parseTopLevelKeys(body: string): string[] {
  try {
    return Object.keys(JSON.parse(body) as Record<string, unknown>);
  } catch {
    return [];
  }
}

function postScriptContext(response: ScriptResponse) {
  return {
    status: response?.status,
    topLevelResponseKeys: response?.body
      ? parseTopLevelKeys(response.body)
      : [],
  };
}

export function ScriptEditor({ tabId }: ScriptEditorProps) {
  const { tabs, updateTabState } = useTabsStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const envVariables = useEnvVariableKeys();
  const response = useResponseStore((s) => s.responses[tabId]);

  const [activeScript, setActiveScript] = useState<"pre" | "post">("pre");
  const [lintStatus, setLintStatus] = useState<LintStatus>({ state: "idle" });
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const { run, loading, error, reset } = useAI<{ code: string }>(
    "write-script",
  );

  if (!tab) return null;
  if (tab.type !== "http") return null;

  function handleCheckSyntax() {
    if (!tab || tab.type !== "http") return;
    const code = activeScript === "pre" ? tab.preScript : tab.postScript;
    const result = checkSyntax(code ?? "");
    if (result.ok) {
      setLintStatus({ state: "ok" });
    } else {
      setLintStatus({
        state: "error",
        message: result.message,
        line: result.line,
        column: result.column,
      });
    }
  }

  function handleTabChange(value: string) {
    setActiveScript(value as "pre" | "post");
    setLintStatus({ state: "idle" });
    setAiOpen(false);
    setAiPrompt("");
    reset();
  }

  function handleOpenAI() {
    setAiOpen(true);
    setAiPrompt("");
    reset();
  }

  function handleCloseAI() {
    setAiOpen(false);
    setAiPrompt("");
    reset();
  }

  async function handleGenerate() {
    if (!tab || tab.type !== "http") return;

    const context =
      activeScript === "pre"
        ? {
            url: tab.url,
            method: tab.method,
            headers: tab.headers,
            params: tab.params,
          }
        : postScriptContext(response);

    const result = await run({
      scriptType: activeScript,
      description: aiPrompt,
      context,
    });
    if (!result) return;

    const existing = activeScript === "pre" ? tab.preScript : tab.postScript;
    const separator = existing?.trim() ? "\n\n" : "";
    const updated = `${existing ?? ""}${separator}${result.code}`;

    if (activeScript === "pre") {
      updateTabState(tabId, { preScript: updated });
    } else {
      updateTabState(tabId, { postScript: updated });
    }

    const lintResult = checkSyntax(updated);
    if (lintResult.ok) {
      setLintStatus({ state: "ok" });
    } else {
      setLintStatus({
        state: "error",
        message: lintResult.message,
        line: lintResult.line,
        column: lintResult.column,
      });
    }

    handleCloseAI();
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs
        value={activeScript}
        onValueChange={handleTabChange}
        className="flex h-full flex-col"
      >
        <div className="flex items-center border-b">
          <TabsList className="h-8 shrink-0 rounded-none bg-transparent px-3">
            <TabsTrigger
              value="pre"
              data-testid="script-tab-pre"
              className="h-6 text-xs"
            >
              Pre-Request
            </TabsTrigger>
            <TabsTrigger
              value="post"
              data-testid="script-tab-post"
              className="h-6 text-xs"
            >
              Post-Response
            </TabsTrigger>
          </TabsList>

          <div className="ml-auto flex items-center gap-2 px-3">
            {lintStatus.state === "ok" && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                No errors
              </span>
            )}
            {lintStatus.state === "error" && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                <ShieldAlert className="h-3 w-3" />
                {lintStatus.line != null
                  ? `Line ${lintStatus.line}:${lintStatus.column ?? 0} — `
                  : ""}
                {lintStatus.message}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={handleOpenAI}
              data-testid="ask-ai-btn"
            >
              <Sparkles className="h-3 w-3" />
              Ask AI
            </Button>
            <OpenInRelayButton
              tabId={tabId}
              prompt={writeScriptPrompt({
                scriptType: activeScript,
                description:
                  aiPrompt.trim() || WRITE_SCRIPT_DEFAULT_DESCRIPTION,
                // Header values can be secrets, so a pre-request script only shares the request line.
                context:
                  activeScript === "pre"
                    ? { url: tab.url, method: tab.method }
                    : postScriptContext(response),
              })}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1.5 text-[11px]"
              onClick={handleCheckSyntax}
              data-testid="check-syntax-btn"
            >
              <Wand2 className="h-3 w-3" />
              Check Syntax
            </Button>
          </div>
        </div>

        {/* AI inline prompt bar */}
        {aiOpen && (
          <div
            className="flex items-center gap-2 border-b px-3 py-1.5"
            data-testid="ai-script-bar"
          >
            <Input
              autoFocus
              className="h-7 flex-1 text-xs"
              placeholder="Describe what the script should do…"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) void handleGenerate();
                if (e.key === "Escape") handleCloseAI();
              }}
              data-testid="ai-script-input"
            />
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => void handleGenerate()}
              disabled={loading || !aiPrompt.trim()}
              data-testid="ai-script-generate-btn"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Generate
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleCloseAI}
              aria-label="Close AI bar"
              data-testid="ai-script-close-btn"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            {error && (
              <p
                className="text-xs text-destructive"
                data-testid="ai-script-error"
              >
                {error}
              </p>
            )}
          </div>
        )}

        <TabsContent value="pre" className="mt-0 flex-1 overflow-hidden">
          <div data-testid="pre-script-editor" className="h-full">
            <CodeEditor
              value={tab.preScript}
              language="javascript"
              onChange={(value) => {
                updateTabState(tabId, { preScript: value });
                setLintStatus({ state: "idle" });
              }}
              envVariables={envVariables}
            />
          </div>
        </TabsContent>

        <TabsContent value="post" className="mt-0 flex-1 overflow-hidden">
          <div data-testid="post-script-editor" className="h-full">
            <CodeEditor
              value={tab.postScript}
              language="javascript"
              onChange={(value) => {
                updateTabState(tabId, { postScript: value });
                setLintStatus({ state: "idle" });
              }}
              envVariables={envVariables}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
