"use client";

import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  type PointerEventHandler,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { OpenInRelayButton } from "@/components/relay/OpenInRelayButton";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAI } from "@/hooks/useAI";
import { explainError } from "@/lib/errorExplainer";
import { explainErrorPrompt } from "@/lib/relay/prompts";

type ErrorExplainerProps = {
  status: number;
  body: string;
  responseKey: number;
  children: ReactNode;
};

export function ErrorExplainer({
  status,
  body,
  responseKey,
  children,
}: ErrorExplainerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    run: runAI,
    loading: aiLoading,
    error: aiError,
    reset: resetAI,
  } = useAI<{
    explanation: string;
  }>("explain-error");

  useEffect(() => {
    setDismissed(false);
    setAiExplanation(null);
    resetAI();
  }, [responseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const explanation = explainError(status, body);
  const relayPrompt = explainErrorPrompt({
    status,
    bodySnippet: body.slice(0, 2000),
  });

  async function handleAskAI() {
    const result = await runAI({
      status,
      bodySnippet: body.slice(0, 2000),
      contentType: "",
    });
    if (result) setAiExplanation(result.explanation);
  }

  function scheduleShow() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => setOpen(true), 100);
  }

  const scheduleHide: PointerEventHandler = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setOpen(false), 200);
  };

  function cancelHide() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  // Unknown error codes (≥ 400 but no static explanation) — AI-only path
  if (!explanation && status >= 400 && !dismissed) {
    return (
      <span
        data-testid="error-explainer"
        className="inline-flex items-center gap-1.5"
      >
        {children}
        <Popover>
          <PopoverTrigger
            data-testid="ai-explain-btn"
            className="inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={handleAskAI}
          >
            <Sparkles className="h-3 w-3" />
            Explain with AI
          </PopoverTrigger>
          <PopoverContent
            data-testid="ai-explain-content"
            className="w-80 max-h-[min(70vh,28rem)] overflow-y-auto p-3"
            side="bottom"
            align="start"
          >
            <div className="flex items-start gap-2 border-b border-border pb-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  AI explanation
                </p>
                <p className="text-sm font-semibold text-foreground">
                  HTTP {status}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="pt-2.5">
              {aiLoading && (
                <div
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                  data-testid="ai-loading"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Asking AI…
                </div>
              )}
              {aiError && (
                <p className="text-xs text-destructive" data-testid="ai-error">
                  {aiError}
                </p>
              )}
              {aiExplanation && (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="ai-explanation"
                >
                  {aiExplanation}
                </p>
              )}
              {!aiLoading && !aiError && !aiExplanation && (
                <p className="text-xs text-muted-foreground">
                  Click "Explain with AI" to get an explanation.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <OpenInRelayButton prompt={relayPrompt} />
      </span>
    );
  }

  if (!explanation || dismissed) {
    return <>{children}</>;
  }

  return (
    <span data-testid="error-explainer" className="inline-flex">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-testid="error-explainer-trigger"
          className="inline-flex cursor-help items-center gap-2 rounded-md border-0 bg-transparent p-0 text-left hover:bg-muted/40"
          onPointerEnter={scheduleShow}
          onPointerLeave={scheduleHide}
          aria-label={`${status} ${explanation.title}. Hover for details.`}
        >
          {children}
        </PopoverTrigger>
        <PopoverContent
          data-testid="error-explainer-content"
          className="w-80 max-h-[min(70vh,28rem)] overflow-y-auto p-3"
          side="bottom"
          align="start"
          onPointerEnter={cancelHide}
          onPointerLeave={scheduleHide}
        >
          <div className="flex items-start gap-2 border-b border-border pb-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p
                className="text-[11px] font-medium text-muted-foreground"
                data-testid="error-explainer-title"
              >
                Why did this fail?
              </p>
              <p className="text-sm font-semibold text-foreground">
                {explanation.title}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setDismissed(true);
                setOpen(false);
              }}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2.5 pt-2.5">
            <p className="text-xs text-muted-foreground">{explanation.cause}</p>

            <ul className="space-y-1">
              {explanation.suggestions.map((suggestion) => (
                <li
                  key={suggestion}
                  className="flex gap-1.5 text-xs text-muted-foreground"
                >
                  <span className="mt-px shrink-0 text-amber-400">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>

            {explanation.matchedHints.length > 0 && (
              <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
                {explanation.matchedHints.map((hint) => (
                  <p key={hint} className="text-xs text-amber-300">
                    {hint}
                  </p>
                ))}
              </div>
            )}

            <a
              href={explanation.mdnUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-400 underline-offset-2 hover:underline"
            >
              MDN docs for {status}
              <ExternalLink className="h-3 w-3" />
            </a>

            {/* AI context-specific insight */}
            <div className="border-t border-border pt-2">
              {!aiExplanation && !aiLoading && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-violet-400 underline-offset-2 hover:underline disabled:opacity-50"
                  onClick={handleAskAI}
                  disabled={aiLoading}
                  data-testid="ai-insight-link"
                >
                  <Sparkles className="h-3 w-3" />
                  Ask AI for context-specific insight →
                </button>
              )}
              <OpenInRelayButton prompt={relayPrompt} />
              {aiLoading && (
                <div
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  data-testid="ai-loading"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Asking AI…
                </div>
              )}
              {aiError && (
                <p className="text-xs text-destructive" data-testid="ai-error">
                  {aiError}
                </p>
              )}
              {aiExplanation && (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="ai-explanation"
                >
                  {aiExplanation}
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}
