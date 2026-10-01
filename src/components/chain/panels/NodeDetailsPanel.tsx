"use client";

import {
  CheckCircle,
  Clock,
  Loader2,
  SkipForward,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { prettyPrintJson } from "@/lib/chainJson";
import {
  isDetailedExtractionKey,
  jsonPathToVarName,
  parseDetailedExtractionKey,
} from "@/lib/chainUtils";
import { cn } from "@/lib/utils";
import type { ResponseData } from "@/types";
import type {
  AssertionResult,
  ChainAssertion,
  ChainNodeState,
  EnvPromotion,
} from "@/types/chain";
import { PromoteToEnvPopover } from "../dialogs/PromoteToEnvPopover";
import { CopyButton } from "./CopyButton";
import { NodeAssertionsPanel } from "./NodeAssertionsPanel";
import { SectionHeading } from "./SectionHeading";
import { useEditableBody } from "./useEditableBody";

type ActiveTab = "details" | "assertions";

type NodeDetailsPanelProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  method: string;
  url: string;
  state: ChainNodeState;
  response?: ResponseData;
  extractedValues?: Record<string, string | null>;
  error?: string;
  assertionResults?: AssertionResult[];
  assertions?: ChainAssertion[];
  onAssertionsChange?: (assertions: ChainAssertion[]) => void;
  /** Body content to edit (for POST/PUT/PATCH nodes) */
  bodyContent?: string;
  /** Called when user saves an edited body */
  onSaveBody?: (body: string) => void;
  envPromotions?: EnvPromotion[];
  onSavePromotion?: (promotion: EnvPromotion) => void;
  onRemovePromotion?: (edgeId: string) => void;
};

function StatusBadge({ status }: { status: number }) {
  const ok = status >= 200 && status < 300;
  const redirect = status >= 300 && status < 400;
  const clientErr = status >= 400 && status < 500;
  const color = ok
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : redirect
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : clientErr || status >= 500
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        color,
      )}
    >
      {status}
    </span>
  );
}

function StateIndicator({ state }: { state: ChainNodeState }) {
  const t = useTranslations("chain");
  switch (state) {
    case "passed":
      return (
        <div className="flex items-center gap-1.5 text-emerald-400">
          <CheckCircle className="h-3.5 w-3.5" aria-hidden />
          <span className="text-xs font-medium">{t("runLogFilterPassed")}</span>
        </div>
      );
    case "failed":
      return (
        <div className="flex items-center gap-1.5 text-red-400">
          <XCircle className="h-3.5 w-3.5" aria-hidden />
          <span className="text-xs font-medium">{t("runLogFilterFailed")}</span>
        </div>
      );
    case "running":
      return (
        <div
          className="flex items-center gap-1.5 text-blue-400"
          role="status"
          aria-live="polite"
        >
          <Loader2
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          <span className="text-xs font-medium">{t("runLogLiveLabel")}</span>
        </div>
      );
    case "skipped":
      return (
        <div className="flex items-center gap-1.5 text-zinc-500">
          <SkipForward className="h-3.5 w-3.5" aria-hidden />
          <span className="text-xs font-medium">
            {t("runLogFilterSkipped")}
          </span>
        </div>
      );
    default:
      return (
        <span className="text-xs text-muted-foreground">{t("notYetRun")}</span>
      );
  }
}

export function NodeDetailsPanel({
  open,
  onClose,
  name,
  method,
  url,
  state,
  response,
  extractedValues,
  error,
  assertionResults,
  assertions = [],
  onAssertionsChange,
  bodyContent,
  onSaveBody,
  envPromotions,
  onSavePromotion,
  onRemovePromotion,
}: NodeDetailsPanelProps) {
  const t = useTranslations("chain");
  const requestBodySectionId = useId();
  const hasExtractions =
    extractedValues && Object.keys(extractedValues).length > 0;

  const [activeTab, setActiveTab] = useState<ActiveTab>("details");

  // Reset to details tab whenever a different node is opened
  useEffect(() => {
    setActiveTab("details");
  }, [name]);

  const {
    editedBody,
    setEditedBody,
    isDirty: bodyChanged,
  } = useEditableBody(bodyContent, name);
  const hasBodyEditor =
    onSaveBody !== undefined &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());

  const prettyBody = useMemo(() => {
    const raw = response?.body ?? "";
    return prettyPrintJson(raw);
  }, [response?.body]);

  const isEmpty = !response && !error && !hasExtractions && !hasBodyEditor;

  const failedAssertionCount =
    assertionResults?.filter((r) => !r.passed).length ?? 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] border-l border-border bg-card flex flex-col p-0"
      >
        {/* ── Header ─────────────────────────────────────── */}
        <SheetHeader className="px-5 pt-5 pb-4 pr-10 border-b border-border shrink-0">
          {/* Row 1: name + state indicator — pr-10 keeps both clear of the X button */}
          <div className="flex items-start justify-between gap-2">
            <SheetTitle className="text-sm font-semibold tracking-tight leading-snug">
              {name}
            </SheetTitle>
            <div className="shrink-0 pt-0.5">
              <StateIndicator state={state} />
            </div>
          </div>
          {/* Row 2: method badge + full URL (wraps, no ellipsis) */}
          <div className="flex items-start gap-1.5 mt-2">
            <span className="mt-0.5 inline-flex h-5 min-w-[3.25rem] shrink-0 items-center justify-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tabular-nums tracking-wide text-muted-foreground">
              {method}
            </span>
            <span className="text-xs text-muted-foreground font-mono break-all leading-relaxed">
              {url}
            </span>
          </div>
        </SheetHeader>

        {/* ── Tab bar ────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label={t("nodeDetailsTabsAriaLabel")}
          className="flex shrink-0 border-b border-border px-5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "details"}
            id="node-details-tab-details"
            onClick={() => setActiveTab("details")}
            className={cn(
              "pb-2 pt-3 text-xs font-medium border-b-2 mr-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-sm",
              activeTab === "details"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t("nodeDetailsTabDetails")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "assertions"}
            id="node-details-tab-assertions"
            onClick={() => setActiveTab("assertions")}
            className={cn(
              "pb-2 pt-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-sm",
              activeTab === "assertions"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t("runLogTabAssertions")}
            {assertions.length > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  failedAssertionCount > 0
                    ? "bg-red-500/20 text-red-400"
                    : assertionResults !== undefined
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {assertions.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-7">
          {activeTab === "assertions" ? (
            <NodeAssertionsPanel
              assertions={assertions}
              assertionResults={assertionResults}
              onChange={onAssertionsChange ?? (() => {})}
            />
          ) : (
            <>
              {/* ── Request body editor (POST/PUT/PATCH only) ───── */}
              {hasBodyEditor && (
                <section className="flex flex-col gap-3">
                  <SectionHeading id={requestBodySectionId}>
                    {t("nodeDetailsRequestBody")}
                  </SectionHeading>
                  <Textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="font-mono text-xs min-h-[140px] resize-y bg-muted/20 border-border/50"
                    placeholder='{"key": "value"}'
                    spellCheck={false}
                    aria-labelledby={requestBodySectionId}
                  />
                  <Button
                    size="sm"
                    disabled={!bodyChanged}
                    onClick={() => onSaveBody?.(editedBody)}
                    className="self-end"
                  >
                    {t("nodeDetailsSaveBody")}
                  </Button>
                </section>
              )}

              {/* ── Response section ──────────────────────────── */}
              {response && (
                <section className="flex flex-col gap-4">
                  <SectionHeading>{t("nodeDetailsResponse")}</SectionHeading>

                  {/* Status metric row — most important info, prominent */}
                  <div className="flex items-center gap-3">
                    <StatusBadge status={response.status} />
                    <span className="text-xs text-muted-foreground">
                      {response.statusText}
                    </span>
                    <div className="ml-auto flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs font-mono tabular-nums">
                        {response.duration}ms
                      </span>
                    </div>
                  </div>

                  {/* Headers sub-section — tight internal gap */}
                  {Object.keys(response.headers).length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        {t("inputTabHeaders")}
                      </p>
                      <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2.5 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                        {Object.entries(response.headers).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-start gap-2 font-mono text-xs"
                          >
                            <span className="text-muted-foreground shrink-0">
                              {k}:
                            </span>
                            <span className="text-foreground break-all">
                              {v}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Body sub-section */}
                  {prettyBody && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground font-medium">
                          {t("nodeDetailsResponseBody")}
                        </p>
                        <CopyButton text={prettyBody} />
                      </div>
                      <pre className="rounded-md border border-border/50 bg-muted/20 px-3 py-2.5 text-xs font-mono text-foreground overflow-x-auto max-h-72 whitespace-pre-wrap break-all leading-relaxed">
                        {prettyBody}
                      </pre>
                    </div>
                  )}
                </section>
              )}

              {/* ── Error section ─────────────────────────────── */}
              {error && (
                <section className="flex flex-col gap-3">
                  <SectionHeading>{t("runLogTabError")}</SectionHeading>
                  <div className="rounded-md border border-red-500/30 bg-red-950/20 px-3 py-2.5">
                    <p className="text-xs font-mono text-red-300 whitespace-pre-wrap break-all leading-relaxed">
                      {error}
                    </p>
                  </div>
                </section>
              )}

              {/* ── Extracted values section ───────────────────── */}
              {hasExtractions && (
                <section className="flex flex-col gap-3">
                  <SectionHeading>
                    {t("nodeDetailsExtractedValues")}
                  </SectionHeading>
                  <div className="flex flex-col gap-1.5">
                    {Object.entries(extractedValues)
                      // Filter out bare edge keys — only display detailed keys with JSONPath
                      // Bare keys (edge.id only) are retained in extractedValues as a
                      // fallback lookup target but not shown to user
                      .filter(([key]) => isDetailedExtractionKey(key))
                      .map(([key, val]) => {
                        const parsed = parseDetailedExtractionKey(key);
                        if (!parsed) return null; // Should not happen due to filter, but safety check

                        const { edgeId, sourceJsonPath } = parsed;
                        const label = sourceJsonPath;
                        const suggestedName = jsonPathToVarName(label);
                        const existingPromotion = envPromotions?.find(
                          (p) => p.edgeId === edgeId,
                        );
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-2 font-mono text-xs px-3 py-2 rounded-md border border-border/40 bg-muted/10"
                          >
                            <span className="text-primary shrink-0">
                              {label}
                            </span>
                            <span className="text-muted-foreground mx-0.5">
                              =
                            </span>
                            {val === null ? (
                              <span className="text-red-400 italic flex-1">
                                {t("nodeAssertionsActualNotFound")}
                              </span>
                            ) : (
                              <span className="text-emerald-400 break-all flex-1">
                                {val}
                              </span>
                            )}
                            {onSavePromotion && onRemovePromotion && (
                              <PromoteToEnvPopover
                                edgeId={edgeId}
                                suggestedVarName={suggestedName}
                                extractedValue={val}
                                existingPromotion={existingPromotion}
                                onSave={onSavePromotion}
                                onRemove={onRemovePromotion}
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </section>
              )}

              {/* ── Empty / skipped states ─────────────────────── */}
              {isEmpty && state === "idle" && (
                <div className="rounded-md border border-border/40 bg-muted/10 px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    {t("nodeDetailsRunToSeeResults")}
                  </p>
                </div>
              )}

              {state === "skipped" && !error && (
                <div className="rounded-md border border-zinc-700/40 bg-zinc-900/20 px-4 py-4 flex items-center gap-2.5">
                  <SkipForward className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  <p className="text-xs text-zinc-500">
                    {t("nodeDetailsSkippedUpstream")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
