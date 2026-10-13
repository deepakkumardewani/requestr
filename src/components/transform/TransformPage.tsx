"use client";

import {
  ArrowUpToLine,
  Braces,
  Eraser,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { OpenInRelayButton } from "@/components/relay/OpenInRelayButton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";
import { useAI } from "@/hooks/useAI";
import { formatJson } from "@/lib/jsonDiff";
import { buildJsonPathSuggestionsFromText } from "@/lib/jsonStructurePaths";
import {
  JSONPATH_DEFAULT_DESCRIPTION,
  suggestJsonpathPrompt,
} from "@/lib/relay/prompts";
import type { StructureCompletionState } from "@/lib/structureCompletion";
import { runJs, runJsonPath } from "@/lib/transformRunner";
import {
  type TransformMode,
  useTransformStore,
} from "@/stores/useTransformStore";

const CodeEditor = dynamic(() => import("@/components/request/CodeEditor"), {
  ssr: false,
});

const DEBOUNCE_MS = 300;

export function TransformPage() {
  const {
    inputBody,
    codeJsonPath,
    codeJs,
    mode,
    output,
    error,
    setInputBody,
    setCode,
    setMode,
    setResult,
    clear,
  } = useTransformStore();

  const [showAiBar, setShowAiBar] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const { run: runAI, loading: aiLoading } = useAI<{ expression: string }>(
    "suggest-jsonpath",
  );

  const hasInput = inputBody.trim().length > 0;

  const code = mode === "js" ? codeJs : codeJsonPath;

  useLayoutEffect(() => {
    const raw = useTransformStore.getState().inputBody;
    if (!raw.trim()) return;
    const next = formatJson(raw);
    if (next !== raw) {
      setInputBody(next);
    }
  }, [setInputBody]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExecutingRef = useRef(false);
  const leftInputEditorWrapRef = useRef<HTMLDivElement | null>(null);

  /** Wired to CodeEditor; apply is gated by `ENABLE_STRUCTURE_COMPLETION` in CodeEditor until we ship. */
  const structureCompletionRef = useRef<StructureCompletionState | null>(null);

  const structurePaths = useMemo(() => {
    return buildJsonPathSuggestionsFromText(inputBody, {
      maxDepth: 8,
      maxPaths: 500,
      maxArrayNumericSamples: 2,
    });
  }, [inputBody]);

  const structureCompletionPaths = useMemo(() => {
    if (mode === "js") {
      return [
        ...new Set([...structurePaths, "json", "text", "status", "headers"]),
      ];
    }
    return structurePaths;
  }, [mode, structurePaths]);

  structureCompletionRef.current = {
    mode: mode === "js" ? "js" : "jsonpath",
    paths: structureCompletionPaths,
  };

  const parsedInputJson = useMemo(() => {
    try {
      return JSON.parse(inputBody);
    } catch {
      return null;
    }
  }, [inputBody]);

  const execute = useCallback(
    async (currentCode: string, currentMode: TransformMode) => {
      if (!currentCode.trim()) {
        setResult(null, null);
        return;
      }

      isExecutingRef.current = true;

      const responseObj = {
        text: inputBody,
        json: parsedInputJson,
        status: 200,
        headers: {},
      };

      const result =
        currentMode === "jsonpath"
          ? await runJsonPath(currentCode, inputBody)
          : await runJs(currentCode, responseObj);

      isExecutingRef.current = false;

      if ("error" in result) {
        setResult(null, result.error);
      } else {
        setResult(result.output, null);
      }
    },
    [setResult, inputBody, parsedInputJson],
  );

  // Debounced execution when code, mode, or inputBody changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      execute(code, mode);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code, mode, inputBody, execute]);

  const handleFormatJson = useCallback(() => {
    if (!inputBody.trim()) return;
    if (parsedInputJson !== null) {
      setInputBody(JSON.stringify(parsedInputJson, null, 2));
    }
  }, [inputBody, parsedInputJson, setInputBody]);

  const handleScrollInputToTop = useCallback(() => {
    const scroller =
      leftInputEditorWrapRef.current?.querySelector<HTMLElement>(
        ".cm-scroller",
      );
    scroller?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  function computePlaceholder(
    text: string,
    currentMode: TransformMode,
  ): string {
    if (!text.trim()) {
      return currentMode === "jsonpath"
        ? "data[*].email\n// ($. is auto-added)"
        : "data[0].email\n// (return response.json. is auto-added)\n// Or custom map: return response.json.map(x => x);";
    }

    const snippet = text.slice(0, 5000).trim();
    if (!snippet.startsWith("{") && !snippet.startsWith("[")) {
      return currentMode === "jsonpath"
        ? "// Note: Input does not seem like valid JSON\ndata[*]"
        : "return response.text.split('\\n')[0];";
    }

    const isArray = snippet.startsWith("[");
    const keys: string[] = [];
    const regex = /"([a-zA-Z0-9_]+)"\s*:/g;
    let match: RegExpExecArray | null = regex.exec(snippet);
    while (match !== null && keys.length < 3) {
      if (!keys.includes(match[1])) {
        keys.push(match[1]);
      }
      match = regex.exec(snippet);
    }

    if (currentMode === "jsonpath") {
      if (isArray) {
        return keys.length > 0
          ? `// Examples ($. is auto-added):\n// [*].${keys[0]}\n// [0].${keys[0]}\n// [*]`
          : `// Examples ($. is auto-added):\n// [*]\n// [0]`;
      }
      if (keys.length > 0) {
        const topKey = keys[0];
        return keys.length > 1
          ? `// Examples ($. is auto-added):\n// ${topKey}\n// ..${keys[1]}`
          : `// Examples ($. is auto-added):\n// ${topKey}\n// ..${topKey}`;
      }
      return `// Examples ($. is auto-added):\n// data\n// ..id`;
    }

    // JS mode
    if (isArray) {
      return keys.length > 0
        ? `// Examples (return response.json. is auto-added):\n// map(x => x.${keys[0]})\n// [0]`
        : `// Examples (return response.json. is auto-added):\n// [0]\n// filter(x => x)`;
    }
    return keys.length > 0
      ? `// Examples (return response.json. is auto-added):\n// ${keys[0]}\n// return Object.keys(response.json);`
      : `// Examples (return response.json. is auto-added):\n// return response.json;\n// return response.headers;`;
  }

  const editorLanguage = mode === "js" ? "javascript" : "text";

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    const result = await runAI({
      description: aiPrompt.trim(),
      bodySnippet: inputBody.slice(0, 2000),
    });
    if (!result?.expression) {
      toast.error("AI could not generate a JSONPath expression");
      return;
    }
    setCode(result.expression);
    setAiPrompt("");
    setShowAiBar(false);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground px-2">
          <Braces className="h-4 w-4 text-theme-accent" />
          Transform Playground
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        {/* Left: Input Payload */}
        <ResizablePanel defaultSize="50%" maxSize="70%">
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/20">
              <span className="text-xs font-medium text-muted-foreground">
                Input Data (JSON)
              </span>
              <div className="flex items-center gap-0.5">
                <TooltipIconButton
                  label="Scroll to top"
                  onClick={handleScrollInputToTop}
                  disabled={!inputBody.trim()}
                >
                  <ArrowUpToLine className="h-3.5 w-3.5" />
                </TooltipIconButton>
                <TooltipIconButton
                  label="Clear all"
                  onClick={clear}
                  disabled={
                    !inputBody.trim() &&
                    !codeJsonPath.trim() &&
                    !codeJs.trim() &&
                    !output &&
                    !error
                  }
                >
                  <Eraser className="h-3.5 w-3.5" />
                </TooltipIconButton>
                <TooltipIconButton
                  label="Format JSON"
                  onClick={handleFormatJson}
                  disabled={!inputBody.trim()}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                </TooltipIconButton>
              </div>
            </div>
            <div
              ref={leftInputEditorWrapRef}
              className="flex-1 overflow-hidden min-h-0"
            >
              <CodeEditor
                value={inputBody}
                language="json"
                onChange={setInputBody}
                placeholder='{ "paste": "your JSON here" }'
                jsonAutoFormatOnPaste
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Code Editor & Output */}
        <ResizablePanel defaultSize="50%" minSize="30%" maxSize="50%">
          <ResizablePanelGroup orientation="vertical">
            {/* Top Right: Code */}
            <ResizablePanel defaultSize="30%" minSize="30%" maxSize="50%">
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex items-center gap-2 border-b px-3 py-1 bg-muted/20">
                  <div className="flex rounded-md border overflow-hidden text-xs">
                    {(["jsonpath", "js"] as TransformMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`px-3 py-1 transition-colors ${
                          mode === m
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {m === "jsonpath" ? "JSONPath" : "JavaScript"}
                      </button>
                    ))}
                  </div>
                  {mode === "jsonpath" && hasInput && (
                    <button
                      type="button"
                      className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => setShowAiBar((v) => !v)}
                      data-testid="jsonpath-ai-btn"
                    >
                      <Sparkles className="h-3 w-3" />
                      Ask AI
                    </button>
                  )}
                  {mode === "jsonpath" && hasInput && (
                    <OpenInRelayButton
                      prompt={suggestJsonpathPrompt({
                        description:
                          aiPrompt.trim() || JSONPATH_DEFAULT_DESCRIPTION,
                        bodySnippet: inputBody.slice(0, 2000),
                      })}
                    />
                  )}
                </div>
                {showAiBar && mode === "jsonpath" && hasInput && (
                  <div
                    className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5"
                    data-testid="jsonpath-ai-bar"
                  >
                    <input
                      className="h-7 flex-1 rounded border border-input bg-transparent px-2.5 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                      placeholder="Describe the value you want to extract..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleAiGenerate();
                      }}
                      data-testid="jsonpath-ai-input"
                    />
                    <button
                      type="button"
                      className="flex h-7 items-center rounded bg-primary px-3 text-xs text-primary-foreground transition-opacity disabled:opacity-50"
                      onClick={() => void handleAiGenerate()}
                      disabled={aiLoading || !aiPrompt.trim()}
                      data-testid="jsonpath-ai-generate-btn"
                    >
                      {aiLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Generate"
                      )}
                    </button>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        setShowAiBar(false);
                        setAiPrompt("");
                      }}
                      data-testid="jsonpath-ai-close-btn"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div
                  className={`flex-1 overflow-hidden min-h-0 ${error ? "ring-1 ring-inset ring-destructive/50" : ""}`}
                >
                  <CodeEditor
                    value={code}
                    language={editorLanguage}
                    onChange={setCode}
                    placeholder={computePlaceholder(inputBody, mode)}
                    structureCompletionRef={structureCompletionRef}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Bottom Right: Output */}
            <ResizablePanel defaultSize="70%" minSize="50%" maxSize="70%">
              <div className="flex h-full flex-col overflow-hidden bg-muted/5">
                <div className="border-b px-3 py-1.5 flex flex-col justify-center bg-muted/20 h-[37px]">
                  <span className="text-xs font-medium text-muted-foreground">
                    Output
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-3 text-xs font-mono">
                  {error ? (
                    <span className="text-destructive break-words whitespace-pre-wrap">
                      {error}
                    </span>
                  ) : output === "[]" ? (
                    <span className="text-muted-foreground">[]</span>
                  ) : output ? (
                    <pre className="whitespace-pre-wrap break-all text-foreground text-sm">
                      {output}
                    </pre>
                  ) : (
                    <span className="text-muted-foreground/60 italic">
                      Output will appear here...
                    </span>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
