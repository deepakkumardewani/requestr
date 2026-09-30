"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  autoReplaceUrlSegment,
  jsonPathToVarName,
  resolveJsonPathFromParsed,
} from "@/lib/chainUtils";
import { isReservedAlias } from "@/lib/chainValueNamespace";
import { generateId } from "@/lib/utils";
import type { RequestModel, ResponseData } from "@/types";
import type { ChainInjection, ChainNodeState } from "@/types/chain";
import { JsonPathExplorer } from "../../dialogs/JsonPathExplorer";
import { ArrowConfigInjectionPreviewList } from "./ArrowConfigInjectionPreviewList";

type TargetField = ChainInjection["targetField"];

type InjectionRow = ChainInjection & { rowId: string };

function withRowIds(injections: ChainInjection[]): InjectionRow[] {
  return injections.map((inj) => ({ ...inj, rowId: generateId() }));
}

function stripRowIds(rows: InjectionRow[]): ChainInjection[] {
  return rows.map(({ rowId: _id, ...inj }) => inj);
}

const TARGET_FIELD_LABEL: Record<TargetField, string> = {
  url: "Query param name",
  path: "Path param name (e.g. :id)",
  header: "Header name",
  body: "Body JSONPath",
};

const TARGET_FIELD_PLACEHOLDER: Record<TargetField, string> = {
  url: "userId",
  path: "id",
  header: "Authorization",
  body: "$.userId",
};

type InjectionEditorProps = {
  parsedResponseBody: unknown;
  sourceRequest: RequestModel | null;
  targetRequest: RequestModel | null;
  sourceRunState?: ChainNodeState;
  sourceResponse?: ResponseData;
  onRunSource?: (requestId: string) => void;
  initialInjections: ChainInjection[];
  initialTargetUrl: string;
  panelOpen: boolean;
  panelSessionKey: string;
  onChange: (
    injections: ChainInjection[],
    targetUrl: string,
    isValid: boolean,
  ) => void;
};

export function InjectionEditor({
  parsedResponseBody,
  sourceRequest,
  targetRequest,
  sourceRunState,
  sourceResponse,
  onRunSource,
  initialInjections,
  initialTargetUrl,
  panelOpen,
  panelSessionKey,
  onChange,
}: InjectionEditorProps) {
  const manualJsonPathInputId = useId();
  const targetKeyInputId = useId();
  const targetUrlInputId = useId();
  const targetKeyInputRef = useRef<HTMLInputElement>(null);

  const [injections, setInjections] = useState<InjectionRow[]>(() =>
    withRowIds(initialInjections),
  );
  const [targetUrl, setTargetUrl] = useState(initialTargetUrl);
  const [activeIdx, setActiveIdx] = useState(0);

  // Reset when panel opens for a different edge
  useEffect(() => {
    if (!panelOpen) return;
    setInjections(withRowIds(initialInjections));
    setTargetUrl(initialTargetUrl);
    setActiveIdx(0);
    // Only trigger on open/session change, not on every initialInjections reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, panelSessionKey]);

  // Notify parent on every state change
  useEffect(() => {
    const plain = stripRowIds(injections);
    const isValid = plain.every(
      (inj) =>
        inj.sourceJsonPath.trim() !== "" &&
        inj.targetKey.trim() !== "" &&
        !isReservedAlias(inj.targetKey.trim()),
    );
    onChange(plain, targetUrl, isValid);
  }, [injections, targetUrl, onChange]);

  const active = injections[activeIdx] ?? injections[0];
  const activeTargetKeyReserved = isReservedAlias(
    (active?.targetKey ?? "").trim(),
  );
  const defaultTab = parsedResponseBody ? "explorer" : "manual";
  const isGet = targetRequest?.method === "GET";
  const availableFields: TargetField[] = isGet
    ? ["url", "path", "header"]
    : ["url", "path", "header", "body"];

  const urlMissingPlaceholder =
    active?.targetField === "path" &&
    active.targetKey &&
    targetUrl &&
    !targetUrl.includes(`:${active.targetKey}`);

  function updateActive(patch: Partial<ChainInjection>) {
    setInjections((prev) =>
      prev.map((inj, i) => (i === activeIdx ? { ...inj, ...patch } : inj)),
    );
  }

  function handleSelectJsonPath(path: string) {
    const extractedValue = resolveJsonPathFromParsed(parsedResponseBody, path);
    const newKey = jsonPathToVarName(path);
    if (active.targetField === "path") {
      const newUrl = autoReplaceUrlSegment(targetUrl, newKey, extractedValue);
      if (newUrl !== targetUrl) setTargetUrl(newUrl);
    }
    updateActive({ sourceJsonPath: path, targetKey: newKey });
  }

  function handleTargetFieldChange(field: TargetField) {
    if (field === "path") {
      const extractedValue = resolveJsonPathFromParsed(
        parsedResponseBody,
        active.sourceJsonPath,
      );
      const paramName =
        active.targetKey || jsonPathToVarName(active.sourceJsonPath);
      const newUrl = autoReplaceUrlSegment(
        targetUrl,
        paramName,
        extractedValue,
      );
      if (newUrl !== targetUrl) setTargetUrl(newUrl);
    }
    updateActive({ targetField: field });
  }

  function handleTargetKeyChange(key: string) {
    updateActive({ targetKey: key });
    if (active.targetField === "path" && key) {
      const extractedValue = resolveJsonPathFromParsed(
        parsedResponseBody,
        active.sourceJsonPath,
      );
      const newUrl = autoReplaceUrlSegment(targetUrl, key, extractedValue);
      if (newUrl !== targetUrl) setTargetUrl(newUrl);
    }
  }

  function addInjection() {
    setInjections((prev) => {
      const row: InjectionRow = {
        sourceJsonPath: "$.value",
        targetField: "header",
        targetKey: "",
        rowId: generateId(),
      };
      setActiveIdx(prev.length);
      return [...prev, row];
    });
  }

  function removeInjection(idx: number) {
    setInjections((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) => Math.max(0, prev >= idx ? prev - 1 : prev));
  }

  // Guard: body field is not available for GET requests
  if (isGet && active?.targetField === "body") {
    updateActive({ targetField: "header" });
  }

  const buildInjectionPreview = useCallback(
    (inj: ChainInjection): string => {
      const varName = jsonPathToVarName(inj.sourceJsonPath);
      const rawUrl =
        inj.targetField === "path" || inj.targetField === "url"
          ? targetUrl.trim() ||
            targetRequest?.url ||
            "https://api.example.com/endpoint"
          : (targetRequest?.url ?? "https://api.example.com/endpoint");
      if (inj.targetField === "url") {
        const sep = rawUrl.includes("?") ? "&" : "?";
        return `${rawUrl}${sep}${inj.targetKey}={{${varName}}}`;
      }
      if (inj.targetField === "path") {
        const placeholder = `:${inj.targetKey}`;
        if (rawUrl.includes(placeholder)) {
          return rawUrl.replace(placeholder, `{{${varName}}}`);
        }
        return `${rawUrl.replace(/\/$/, "")}/{{${varName}}}`;
      }
      if (inj.targetField === "header") {
        return `${inj.targetKey}: {{${varName}}}`;
      }
      return `${inj.targetKey}: {{${varName}}}`;
    },
    [targetUrl, targetRequest?.url],
  );

  return (
    <div className="flex flex-col gap-7">
      {/* ── Injection pills ──────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground">
            Injections
          </Label>
          <button
            type="button"
            onClick={addInjection}
            className="text-xs text-primary hover:text-primary/80 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-label="Add injection"
          >
            + Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {injections.map((inj, idx) => {
            const isActive = idx === activeIdx;
            const label = inj.sourceJsonPath
              ? `${jsonPathToVarName(inj.sourceJsonPath)} → ${inj.targetField}:${inj.targetKey || "?"}`
              : `Injection ${idx + 1}`;
            return (
              <div key={inj.rowId} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`Select injection ${label}`}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-mono cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:text-foreground"
                  }`}
                  onClick={() => setActiveIdx(idx)}
                >
                  <span className="truncate max-w-[160px]">{label}</span>
                </button>
                {injections.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove injection ${label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeInjection(idx);
                    }}
                    className="text-muted-foreground hover:text-destructive ml-0.5 leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Extraction group ─────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold text-foreground">
          Extract from source response
        </Label>
        <p className="text-xs text-muted-foreground -mt-1.5">
          Pull a value from{" "}
          <span className="font-medium text-foreground">
            {sourceRequest?.name}
          </span>
          {"'s response"}
        </p>

        {!sourceResponse ? (
          <div className="rounded-md border border-border/50 bg-muted/20 px-4 py-3 flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Run the source request first to use the visual explorer.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs self-start"
              onClick={() => onRunSource?.(sourceRequest?.id ?? "")}
              disabled={sourceRunState === "running" || !sourceRequest}
            >
              {sourceRunState === "running" ? "Running..." : "Run Source API"}
            </Button>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab}>
            <TabsList className="h-7 text-xs">
              <TabsTrigger
                value="explorer"
                className="text-xs h-6 px-3"
                disabled={!parsedResponseBody}
              >
                Explorer
              </TabsTrigger>
              <TabsTrigger value="manual" className="text-xs h-6 px-3">
                Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="explorer" className="mt-2 flex flex-col gap-2">
              {parsedResponseBody ? (
                <>
                  <JsonPathExplorer
                    data={parsedResponseBody}
                    selectedPath={active.sourceJsonPath}
                    onSelect={handleSelectJsonPath}
                    onDrop={handleSelectJsonPath}
                    dropZoneRef={targetKeyInputRef}
                  />
                  <p className="text-xs text-muted-foreground">
                    Click, drag, or use &quot;Use&quot; to select its path.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Response is not JSON — use the Manual tab to enter a JSONPath.
                </p>
              )}
            </TabsContent>

            <TabsContent value="manual" className="mt-2 flex flex-col gap-2">
              <Label htmlFor={manualJsonPathInputId} className="sr-only">
                JSONPath to extract from source response
              </Label>
              <Input
                id={manualJsonPathInputId}
                value={active.sourceJsonPath}
                onChange={(e) =>
                  updateActive({ sourceJsonPath: e.target.value })
                }
                placeholder="$.token"
                className="font-mono text-xs h-8"
              />
              <p className="text-xs text-muted-foreground">
                e.g.{" "}
                <code className="text-primary font-mono">$.data.token</code> or{" "}
                <code className="text-primary font-mono">$.user.id</code>
              </p>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Connector */}
      <div className="flex items-center gap-3 -my-1">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          then inject as
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {/* ── Injection group ───────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold text-foreground">
          Inject into target
        </Label>
        <p className="text-xs text-muted-foreground -mt-1.5">
          Where to place the value in{" "}
          <span className="font-medium text-foreground">
            {targetRequest?.name}
          </span>
        </p>

        {/* Field selector */}
        <div className="flex flex-wrap gap-1.5">
          {availableFields.map((field) => (
            <button
              key={field}
              type="button"
              aria-pressed={active?.targetField === field}
              aria-label={`Inject into ${field}`}
              onClick={() => handleTargetFieldChange(field)}
              className={`flex-1 min-w-[60px] rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active?.targetField === field
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              {field === "url"
                ? "Query"
                : field === "path"
                  ? "Path"
                  : field === "header"
                    ? "Header"
                    : "Body"}
            </button>
          ))}
        </div>

        {/* Key input */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor={targetKeyInputId}
            className="text-xs text-muted-foreground"
          >
            {TARGET_FIELD_LABEL[active?.targetField ?? "header"]}
          </Label>
          <Input
            id={targetKeyInputId}
            ref={targetKeyInputRef}
            value={active?.targetKey ?? ""}
            onChange={(e) => handleTargetKeyChange(e.target.value)}
            placeholder={
              TARGET_FIELD_PLACEHOLDER[active?.targetField ?? "header"]
            }
            className="font-mono text-xs h-8"
            aria-invalid={activeTargetKeyReserved}
          />
          {activeTargetKeyReserved && (
            <p className="text-xs text-destructive leading-snug">
              Target key cannot start with{" "}
              <span className="font-mono">collect.</span> or{" "}
              <span className="font-mono">sub.</span> — those prefixes are
              reserved.
            </p>
          )}
          {active?.targetField === "header" && (
            <p className="text-xs text-muted-foreground">
              Value injected verbatim — include any prefix (e.g.{" "}
              <code className="text-primary font-mono">Bearer</code>) in the
              extracted value if needed.
            </p>
          )}
        </div>

        {/* URL template — only for path/url injection */}
        {(active?.targetField === "path" || active?.targetField === "url") && (
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={targetUrlInputId}
              className="text-xs text-muted-foreground"
            >
              {active.targetField === "path"
                ? "URL template (add :param placeholders)"
                : "Base URL"}
            </Label>
            <Input
              id={targetUrlInputId}
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder={
                targetRequest?.url ?? "https://api.example.com/todos/:id"
              }
              className={`font-mono text-xs h-8 ${urlMissingPlaceholder ? "border-amber-500/60" : ""}`}
            />
            {active.targetField === "path" && (
              <p className="text-xs text-muted-foreground">
                Replace static segments with{" "}
                <code className="text-primary font-mono">:paramName</code> —
                e.g. change <code className="font-mono">/todos/101</code> to{" "}
                <code className="text-primary font-mono">/todos/:id</code>
              </p>
            )}
            {urlMissingPlaceholder && (
              <p className="text-xs text-amber-400">
                URL doesn{"'t"} contain{" "}
                <code className="font-mono">:{active.targetKey}</code> — the
                value will be appended instead.
              </p>
            )}
          </div>
        )}
      </div>

      <ArrowConfigInjectionPreviewList
        injections={injections}
        sourceRequestName={sourceRequest?.name}
        buildPreview={buildInjectionPreview}
        jsonPathToVarName={jsonPathToVarName}
      />
    </div>
  );
}
