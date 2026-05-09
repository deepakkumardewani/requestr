"use client";

import {
  AlertTriangle,
  Braces,
  ChevronDown,
  Copy,
  Download,
  FileCode2,
  GitCompare,
  Loader2,
  Network,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";
import { useAI } from "@/hooks/useAI";
import { formatJson } from "@/lib/jsonDiff";
import {
  estimateHeaderBlockBytes,
  estimateHttpTabRequestBytes,
} from "@/lib/responseMetrics";
import { cn, formatBytes, formatDuration } from "@/lib/utils";
import { useDataSchemaStore } from "@/stores/useDataSchemaStore";
import { useJsonCompareStore } from "@/stores/useJsonCompareStore";
import { useJsonVisualizeStore } from "@/stores/useJsonVisualizeStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useTransformStore } from "@/stores/useTransformStore";
import { useUIStore } from "@/stores/useUIStore";
import type { ResponseData } from "@/types";
import { AssertionsTab } from "./AssertionsTab";
import { ConsoleViewer } from "./ConsoleViewer";
import { DataSchemaDialog } from "./DataSchemaDialog";
import { ErrorExplainer } from "./ErrorExplainer";
import { HeadersViewer } from "./HeadersViewer";
import { PreviewFrame } from "./PreviewFrame";
import { TimingWaterfall } from "./TimingWaterfall";
import { TransformPlayground } from "./TransformPlayground";

const PrettyViewer = dynamic(
  () => import("./PrettyViewer").then((m) => ({ default: m.PrettyViewer })),
  { ssr: false },
);
const RawViewer = dynamic(
  () => import("./RawViewer").then((m) => ({ default: m.RawViewer })),
  { ssr: false },
);

type ResponsePanelProps = {
  tabId: string;
  onSendForce: () => void;
};

type UnresolvedVarsBannerProps = {
  vars: string[];
  onSendAnyway: () => void;
  onDismiss: () => void;
  onFix: () => void;
};

function UnresolvedVarsBanner({
  vars,
  onSendAnyway,
  onDismiss,
  onFix,
}: UnresolvedVarsBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs"
      data-testid="unresolved-vars-banner"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
          Unresolved variables
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {vars.map((v) => (
            <code
              key={v}
              className="mr-1 rounded bg-amber-500/10 px-1 font-mono text-amber-600 dark:text-amber-400"
            >
              {`{{${v}}}`}
            </code>
          ))}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px] border-amber-500/40 hover:bg-amber-500/10"
            onClick={onSendAnyway}
          >
            Send anyway
          </Button>
          <button
            type="button"
            onClick={onFix}
            className="flex items-center gap-1 text-[11px] text-amber-600 hover:underline dark:text-amber-400"
          >
            <Settings2 className="h-3 w-3" />
            Fix in Environment Manager
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const SESSION_STORAGE_SEED_KEY = "json-compare-seed-left";

// Stable empty array — prevents Zustand selector from returning a new reference
// each render when the tabId has no assertion results yet (which would cause an
// infinite loop via the "getSnapshot should be cached" React invariant).
const EMPTY_ASSERTION_RESULTS: import("@/types/chain").AssertionResult[] = [];

// Stable empty array — same pattern as EMPTY_ASSERTION_RESULTS above.
// Without this, `?? []` in the selector creates a new reference every render,
// causing React's useSyncExternalStore to schedule immediate re-renders (infinite loop).
const EMPTY_UNRESOLVED_VARS: string[] = [];

type ViewMode = "pretty" | "raw" | "preview";

const PRIMARY_TABS = ["response", "headers", "timing"] as const;
const MORE_TABS = ["console", "tests"] as const;
type PrimaryTab = (typeof PRIMARY_TABS)[number];
type MoreTab = (typeof MORE_TABS)[number];

function detectViewMode(contentType: string): ViewMode {
  if (contentType.includes("text/html")) return "preview";
  if (contentType.includes("text/plain")) return "raw";
  return "pretty";
}

function formatTimingMs(ms: number): string {
  return `${Math.round(ms * 100) / 100} ms`;
}

function TimingDetailTooltip({ response }: { response: ResponseData }) {
  const t = useTranslations("response");
  const timing = response.timing;
  const total = timing?.total ?? response.duration;

  const rows: { label: string; value: number | null }[] = timing
    ? [
        { label: t("timing.dns"), value: timing.dns },
        { label: t("timing.tcp"), value: timing.tcp },
        { label: t("timing.tls"), value: timing.tls },
        { label: t("timing.ttfb"), value: timing.ttfb },
        { label: t("timing.download"), value: timing.download },
      ]
    : [{ label: t("timing.total"), value: response.duration }];

  const denom = total > 0 ? total : 1;

  return (
    <div className="w-72 space-y-2 p-1" data-testid="response-timing-tooltip">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("timing.title")}
      </p>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const v = row.value;
          const pct =
            v !== null && v > 0 ? Math.min(100, (v / denom) * 100) : 0;
          return (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto] gap-x-2 text-xs"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      v === null
                        ? "text-muted-foreground/70"
                        : "text-muted-foreground"
                    }
                  >
                    {row.label}
                  </span>
                </div>
                {v !== null && v > 0 && (
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-emerald-500/15">
                    <div
                      className="h-full rounded-full bg-emerald-500/80"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  v === null ? "text-muted-foreground/60" : "text-emerald-400",
                )}
              >
                {v === null ? "—" : formatTimingMs(v)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs">
        <span className="text-muted-foreground">{t("timing.total")}</span>
        <span className="font-medium tabular-nums text-emerald-400">
          {formatTimingMs(total)}
        </span>
      </div>
    </div>
  );
}

function SizeDetailTooltip({
  response,
  tabId,
}: {
  response: ResponseData;
  tabId: string;
}) {
  const { tabs } = useTabsStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const t = useTranslations("response");

  const respHeaders = estimateHeaderBlockBytes(response.headers);
  const respBody = response.size;
  const respTotal = respHeaders + respBody;

  let reqHeaders = 0;
  let reqBody = 0;
  if (tab?.type === "http") {
    const est = estimateHttpTabRequestBytes(tab);
    reqHeaders = est.headers;
    reqBody = est.body;
  }
  const reqTotal = reqHeaders + reqBody;

  function Row({
    label,
    value,
    muted,
  }: {
    label: string;
    value: number;
    muted?: boolean;
  }) {
    return (
      <div
        className={cn(
          "flex items-center justify-between text-[11px]",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        <span>{label}</span>
        <span className="tabular-nums">{formatBytes(value)}</span>
      </div>
    );
  }

  function SectionHeader({
    title,
    total,
    accent,
  }: {
    title: string;
    total: number;
    accent: boolean;
  }) {
    return (
      <div
        className={cn(
          "flex items-center justify-between text-[11px] font-medium",
          accent ? "text-emerald-400" : "text-muted-foreground",
        )}
      >
        <span>{title}</span>
        <span className="tabular-nums">{formatBytes(total)}</span>
      </div>
    );
  }

  return (
    <div className="w-72 space-y-2 p-1" data-testid="response-size-tooltip">
      <div className="space-y-1">
        <SectionHeader
          title={t("size.responseSize")}
          total={respTotal}
          accent
        />
        <Row label={t("size.body")} value={respBody} />
        <Row label={t("size.headers")} value={respHeaders} />
      </div>
      <div className="space-y-1 border-t border-border pt-2">
        <SectionHeader
          title={t("size.requestSize")}
          total={reqTotal}
          accent={false}
        />
        <Row label={t("size.body")} value={reqBody} muted />
        <Row label={t("size.headers")} value={reqHeaders} muted />
      </div>
      <p className="border-t border-border pt-2 text-xs text-muted-foreground">
        {t("size.disclaimer")}
      </p>
    </div>
  );
}

export function ResponsePanel({ tabId, onSendForce }: ResponsePanelProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<string | null>(null);
  const [activeResponseTab, setActiveResponseTab] = useState<
    PrimaryTab | MoreTab
  >("response");
  const [viewMode, setViewMode] = useState<ViewMode>("pretty");
  const {
    run: summarize,
    loading: summarizeLoading,
    reset: resetSummary,
  } = useAI<{ summary: string }>("summarize-response");
  const {
    responses,
    loading,
    errors,
    scriptLogs,
    clearResponse,
    setUnresolvedVars,
  } = useResponseStore();
  const unresolvedVarsList = useResponseStore(
    (s) => s.unresolvedVars[tabId] ?? EMPTY_UNRESOLVED_VARS,
  );

  const { setEnvManagerOpen } = useUIStore();

  const { tabs } = useTabsStore();
  const activeTab = tabs.find((t) => t.tabId === tabId);
  const assertionResults = useResponseStore(
    (s) => s.assertionResults[tabId] ?? EMPTY_ASSERTION_RESULTS,
  );

  const response = responses[tabId] ?? null;
  const isLoading = loading[tabId] ?? false;
  const error = errors[tabId] ?? null;
  const tabLogs = scriptLogs[tabId] ?? [];

  const t = useTranslations("response");
  const et = useTranslations("errors");
  const assertionFailedCount = assertionResults.filter((r) => !r.passed).length;

  // Auto-detect view mode based on content-type when a new response arrives
  const prevResponseTimestampRef = useRef<number | null>(null);
  useEffect(() => {
    if (response && response.timestamp !== prevResponseTimestampRef.current) {
      prevResponseTimestampRef.current = response.timestamp;
      setViewMode(detectViewMode(response.headers["content-type"] ?? ""));
    }
  }, [response]);

  const hasUnresolvedVars = unresolvedVarsList.length > 0;

  function handleSendAnyway() {
    setUnresolvedVars(tabId, []);
    onSendForce();
  }

  function handleDismissVarsBanner() {
    setUnresolvedVars(tabId, []);
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex h-full flex-col gap-2 p-4"
      >
        <span className="sr-only">Loading response</span>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="response-error-state"
        className="flex h-full flex-col"
      >
        <EmptyState
          title={t("error.title")}
          description={error.message}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearResponse(tabId)}
            >
              {t("error.dismiss")}
            </Button>
          }
        />
        {hasUnresolvedVars && (
          <UnresolvedVarsBanner
            vars={unresolvedVarsList}
            onSendAnyway={handleSendAnyway}
            onDismiss={handleDismissVarsBanner}
            onFix={() => setEnvManagerOpen(true)}
          />
        )}
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1">
        <div data-testid="response-empty-state" className="h-full">
          <EmptyState
            title={t("emptyState.title")}
            description={t("emptyState.description")}
            className="text-center"
          />
        </div>
        <div
          data-testid="response-empty-state"
          className="flex h-full flex-col"
        >
          {hasUnresolvedVars && (
            <UnresolvedVarsBanner
              vars={unresolvedVarsList}
              onSendAnyway={handleSendAnyway}
              onDismiss={handleDismissVarsBanner}
              onFix={() => setEnvManagerOpen(true)}
            />
          )}
        </div>
      </div>
    );
  }

  const contentType = response.headers["content-type"] ?? "";

  async function handleSummarize() {
    if (!response) return;
    setSummary(null);
    resetSummary();
    const result = await summarize({
      status: response.status,
      headers: response.headers,
      bodySnippet: response.body.slice(0, 2000),
    });
    if (result) setSummary(result.summary);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(response?.body ?? "");
      toast.success(et("responseCopied"));
    } catch {
      toast.error(et("failedToCopy"));
    }
  }

  function handleCompare() {
    const raw = (response?.body ?? "").trim();
    const left = raw === "" ? "" : formatJson(raw);
    const {
      setLeftInput,
      setRightInput,
      setLeftError,
      setRightError,
      setDiffResult,
    } = useJsonCompareStore.getState();
    setLeftError(null);
    setRightError(null);
    setDiffResult(null);
    setLeftInput(left);
    setRightInput("");
    if (left) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_SEED_KEY, left);
      } catch {
        // QuotaExceededError or private mode: compare still works from store.
      }
    }
    router.push("/json-compare");
  }

  function handleTransform() {
    const raw = (response?.body ?? "").trim();
    const input = raw === "" ? "" : formatJson(raw);
    useTransformStore.getState().setInputBody(input);
    router.push("/transform");
  }

  function handleVisualize() {
    const raw = (response?.body ?? "").trim();
    const input = raw === "" ? "" : formatJson(raw);
    const store = useJsonVisualizeStore.getState();
    store.setFormat("json");
    store.setInputBody(input);
    router.push("/json-visualize");
  }

  function handleDownload() {
    const ext = contentType.includes("json")
      ? "json"
      : contentType.includes("html")
        ? "html"
        : "txt";
    const blob = new Blob([response?.body ?? ""], {
      type: contentType || "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusRow = (
    <>
      <StatusBadge
        status={response.status}
        data-testid="response-status-badge"
      />
      <span
        className="text-xs text-muted-foreground"
        data-testid="response-status-text"
      >
        {response.statusText}
      </span>
    </>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {hasUnresolvedVars && (
        <UnresolvedVarsBanner
          vars={unresolvedVarsList}
          onSendAnyway={handleSendAnyway}
          onDismiss={handleDismissVarsBanner}
          onFix={() => setEnvManagerOpen(true)}
        />
      )}
      {/* Meta row */}
      <TooltipProvider delay={250}>
        <div
          className="flex items-center gap-3 border-b px-3 py-1.5"
          data-testid="response-meta"
        >
          {response.status >= 400 ? (
            <ErrorExplainer
              status={response.status}
              body={response.body}
              responseKey={response.timestamp}
            >
              {statusRow}
            </ErrorExplainer>
          ) : (
            statusRow
          )}
          <Tooltip>
            <TooltipTrigger
              type="button"
              className="cursor-help border-0 bg-transparent p-0 text-left text-xs text-muted-foreground underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
              data-testid="response-duration"
            >
              {formatDuration(response.duration)}
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="max-w-none border border-border bg-popover p-2 text-popover-foreground shadow-md"
            >
              <TimingDetailTooltip response={response} />
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              type="button"
              className="cursor-help border-0 bg-transparent p-0 text-left text-xs text-muted-foreground underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
              data-testid="response-size"
            >
              {formatBytes(response.size)}
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="max-w-none border border-border bg-popover p-2 text-popover-foreground shadow-md"
            >
              <SizeDetailTooltip response={response} tabId={tabId} />
            </TooltipContent>
          </Tooltip>
          <div className="ml-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleSummarize}
                    disabled={summarizeLoading}
                    data-testid="summarize-btn"
                  />
                }
              >
                {summarizeLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Summarize
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Summarize response with AI
              </TooltipContent>
            </Tooltip>
            <TooltipIconButton
              label={t("actions.dataSchema")}
              onClick={() => useDataSchemaStore.getState().open()}
              data-testid="response-schema-btn"
            >
              <FileCode2 className="h-3.5 w-3.5" />
            </TooltipIconButton>
            <TooltipIconButton
              label={t("actions.compareJson")}
              onClick={handleCompare}
              data-testid="response-compare-btn"
            >
              <GitCompare className="h-3.5 w-3.5" />
            </TooltipIconButton>
            <TooltipIconButton
              label={t("actions.openTransform")}
              onClick={handleTransform}
              data-testid="response-transform-btn"
            >
              <Braces className="h-3.5 w-3.5" />
            </TooltipIconButton>
            <TooltipIconButton
              label={t("actions.copy")}
              onClick={handleVisualize}
              data-testid="response-visualize-btn"
            >
              <Network className="h-3.5 w-3.5" />
            </TooltipIconButton>
            <TooltipIconButton
              label="Copy"
              onClick={handleCopy}
              data-testid="response-copy-btn"
            >
              <Copy className="h-3.5 w-3.5" />
            </TooltipIconButton>
            <TooltipIconButton
              label={t("actions.download")}
              onClick={handleDownload}
              data-testid="response-download-btn"
            >
              <Download className="h-3.5 w-3.5" />
            </TooltipIconButton>
            <TooltipIconButton
              label={t("actions.clear")}
              onClick={() => clearResponse(tabId)}
              data-testid="response-clear-btn"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </TooltipIconButton>
          </div>
        </div>
      </TooltipProvider>

      {/* AI summary banner */}
      {summary && (
        <div
          className="flex items-start gap-2 border-b border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs"
          data-testid="summary-banner"
        >
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
          <p
            className="flex-1 text-muted-foreground"
            data-testid="summary-text"
          >
            {summary}
          </p>
          <button
            type="button"
            onClick={() => setSummary(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss summary"
            data-testid="summary-dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Response tabs */}
      <Tabs
        value={activeResponseTab}
        onValueChange={(v) => setActiveResponseTab(v as PrimaryTab | MoreTab)}
        className="flex flex-col overflow-hidden"
        style={{ flex: "1 1 0", minHeight: 0 }}
      >
        <TabsList className="h-8 shrink-0 rounded-none border-b bg-transparent px-3 justify-start gap-0">
          <TabsTrigger
            value="response"
            data-testid="response-tab-response"
            className="h-7 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
          >
            {t("tabs.response")}
          </TabsTrigger>
          <TabsTrigger
            value="headers"
            data-testid="response-tab-headers"
            className="h-7 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
          >
            {t("tabs.headers")}
            <span className="ml-1 text-xs text-muted-foreground">
              ({Object.keys(response.headers).length})
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="timing"
            data-testid="response-tab-timing"
            className="h-7 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
          >
            {t("tabs.timing")}
          </TabsTrigger>
          {/* Hidden triggers so base-ui registers "console"/"tests" as valid tab values */}
          <TabsTrigger value="console" className="sr-only" tabIndex={-1}>
            {t("tabs.console")}
          </TabsTrigger>
          <TabsTrigger value="tests" className="sr-only" tabIndex={-1}>
            Tests
          </TabsTrigger>
          {/* "More" dropdown for Console + Tests */}
          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="response-tab-more"
              className={cn(
                "flex h-7 items-center gap-1 rounded-none border-b-2 border-transparent px-3 text-xs text-muted-foreground hover:text-foreground",
                (activeResponseTab === "console" ||
                  activeResponseTab === "tests") &&
                  "border-b-theme-accent text-theme-accent",
              )}
            >
              More
              {(tabLogs.length > 0 || assertionFailedCount > 0) && (
                <span className="h-1.5 w-1.5 rounded-full bg-theme-accent" />
              )}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[120px]">
              <DropdownMenuItem
                onClick={() => setActiveResponseTab("console")}
                data-testid="response-more-console"
                className="gap-2 text-xs"
              >
                Console
                {tabLogs.length > 0 && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-theme-accent" />
                )}
              </DropdownMenuItem>
              {activeTab?.type === "http" && (
                <DropdownMenuItem
                  onClick={() => setActiveResponseTab("tests")}
                  data-testid="response-more-tests"
                  className="gap-2 text-xs"
                >
                  Tests
                  {assertionFailedCount > 0 && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-destructive" />
                  )}
                  {assertionResults.length > 0 &&
                    assertionFailedCount === 0 && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="response" className="mt-0 h-full overflow-hidden">
            {/* View mode toggle in top-right */}
            <div className="relative h-full">
              <div className="absolute right-2 top-2 z-10 flex items-center rounded-md border border-border bg-background p-0.5">
                {(["pretty", "raw", "preview"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    data-testid={`view-mode-${mode}`}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] capitalize transition-colors",
                      viewMode === mode
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {viewMode === "pretty" && (
                <PrettyViewer body={response.body} contentType={contentType} />
              )}
              {viewMode === "raw" && <RawViewer body={response.body} />}
              {viewMode === "preview" && (
                <PreviewFrame body={response.body} contentType={contentType} />
              )}
            </div>
          </TabsContent>
          <TabsContent value="headers" className="mt-0 h-full overflow-hidden">
            <HeadersViewer headers={response.headers} />
          </TabsContent>
          <TabsContent value="timing" className="mt-0 h-full overflow-auto">
            {response.timing ? (
              <TimingWaterfall timing={response.timing} />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t("timing.noData")}
              </div>
            )}
          </TabsContent>
          <TabsContent value="console" className="mt-0 h-full overflow-hidden">
            <ConsoleViewer logs={tabLogs} />
          </TabsContent>
          <TabsContent value="tests" className="mt-0 h-full overflow-hidden">
            <AssertionsTab tabId={tabId} />
          </TabsContent>
        </div>
      </Tabs>

      <TransformPlayground
        tabId={tabId}
        responseBody={response.body}
        responseStatus={response.status}
        responseHeaders={response.headers}
      />
      <DataSchemaDialog responseBody={response.body} />
    </div>
  );
}
