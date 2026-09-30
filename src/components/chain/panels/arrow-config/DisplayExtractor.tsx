"use client";

import { useEffect, useId, useRef, useState } from "react";
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
import type { RequestModel, ResponseData } from "@/types";
import type {
  ChainInjection,
  ChainNodeState,
  DisplayBlock,
} from "@/types/chain";
import { JsonPathExplorer } from "../../dialogs/JsonPathExplorer";

type TargetField = ChainInjection["targetField"];

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

export type DisplayExtractorData = {
  sourceJsonPath: string;
  targetField: TargetField;
  targetKey: string;
  targetUrl?: string;
};

type DisplayExtractorProps = {
  parsedResponseBody: unknown;
  sourceRequest: RequestModel | null;
  targetRequest: RequestModel | null;
  sourceRunState?: ChainNodeState;
  sourceResponse?: ResponseData;
  onRunSource?: (requestId: string) => void;
  existingDisplayNode?: DisplayBlock;
  panelOpen: boolean;
  panelSessionKey: string;
  onChange: (data: DisplayExtractorData, isValid: boolean) => void;
};

export function DisplayExtractor({
  parsedResponseBody,
  sourceRequest,
  targetRequest,
  sourceRunState,
  sourceResponse,
  onRunSource,
  existingDisplayNode,
  panelOpen,
  panelSessionKey,
  onChange,
}: DisplayExtractorProps) {
  const manualJsonPathInputId = useId();
  const targetKeyInputId = useId();
  const targetUrlInputId = useId();
  const targetKeyInputRef = useRef<HTMLInputElement>(null);

  const [sourceJsonPath, setSourceJsonPath] = useState(
    existingDisplayNode?.sourceJsonPath ?? "$.token",
  );
  const [targetField, setTargetField] = useState<TargetField>(
    existingDisplayNode?.targetField ?? "header",
  );
  const [targetKey, setTargetKey] = useState(
    existingDisplayNode?.targetKey ?? "",
  );
  const [targetUrl, setTargetUrl] = useState(
    existingDisplayNode?.targetUrl ?? targetRequest?.url ?? "",
  );

  // Reset when panel opens for a different display node
  useEffect(() => {
    if (!panelOpen) return;
    setSourceJsonPath(existingDisplayNode?.sourceJsonPath ?? "$.token");
    setTargetField(existingDisplayNode?.targetField ?? "header");
    setTargetKey(existingDisplayNode?.targetKey ?? "");
    setTargetUrl(existingDisplayNode?.targetUrl ?? targetRequest?.url ?? "");
    // Only trigger on open/session change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, panelSessionKey]);

  const targetKeyReserved = isReservedAlias(targetKey.trim());

  // Notify parent on every state change
  useEffect(() => {
    const isValid =
      sourceJsonPath.trim() !== "" &&
      targetKey.trim() !== "" &&
      !targetKeyReserved;
    const url =
      (targetField === "path" || targetField === "url") && targetUrl.trim()
        ? targetUrl.trim()
        : undefined;
    onChange(
      { sourceJsonPath, targetField, targetKey, targetUrl: url },
      isValid,
    );
  }, [
    sourceJsonPath,
    targetField,
    targetKey,
    targetUrl,
    targetKeyReserved,
    onChange,
  ]);

  const defaultTab = parsedResponseBody ? "explorer" : "manual";
  const isGet = targetRequest?.method === "GET";
  const availableFields: TargetField[] = isGet
    ? ["url", "path", "header"]
    : ["url", "path", "header", "body"];

  const urlMissingPlaceholder =
    targetField === "path" &&
    targetKey &&
    targetUrl &&
    !targetUrl.includes(`:${targetKey}`);

  function handleSelectJsonPath(path: string) {
    const extractedValue = resolveJsonPathFromParsed(parsedResponseBody, path);
    const newKey = jsonPathToVarName(path);
    setSourceJsonPath(path);
    if (targetField === "path") {
      const newUrl = autoReplaceUrlSegment(targetUrl, newKey, extractedValue);
      if (newUrl !== targetUrl) setTargetUrl(newUrl);
    }
    setTargetKey(newKey);
  }

  function handleTargetFieldChange(field: TargetField) {
    if (field === "path") {
      const extractedValue = resolveJsonPathFromParsed(
        parsedResponseBody,
        sourceJsonPath,
      );
      const paramName = targetKey || jsonPathToVarName(sourceJsonPath);
      const newUrl = autoReplaceUrlSegment(
        targetUrl,
        paramName,
        extractedValue,
      );
      if (newUrl !== targetUrl) setTargetUrl(newUrl);
    }
    setTargetField(field);
  }

  function handleTargetKeyChange(key: string) {
    setTargetKey(key);
    if (targetField === "path" && key) {
      const extractedValue = resolveJsonPathFromParsed(
        parsedResponseBody,
        sourceJsonPath,
      );
      const newUrl = autoReplaceUrlSegment(targetUrl, key, extractedValue);
      if (newUrl !== targetUrl) setTargetUrl(newUrl);
    }
  }

  // Guard: body not available for GET
  if (isGet && targetField === "body") {
    setTargetField("header");
  }

  return (
    <div className="flex flex-col gap-7">
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
                    selectedPath={sourceJsonPath}
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
                value={sourceJsonPath}
                onChange={(e) => setSourceJsonPath(e.target.value)}
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
              aria-pressed={targetField === field}
              aria-label={`Inject into ${field}`}
              onClick={() => handleTargetFieldChange(field)}
              className={`flex-1 min-w-[60px] rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                targetField === field
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
            {TARGET_FIELD_LABEL[targetField]}
          </Label>
          <Input
            id={targetKeyInputId}
            ref={targetKeyInputRef}
            value={targetKey}
            onChange={(e) => handleTargetKeyChange(e.target.value)}
            placeholder={TARGET_FIELD_PLACEHOLDER[targetField]}
            className="font-mono text-xs h-8"
            aria-invalid={targetKeyReserved}
          />
          {targetKeyReserved && (
            <p className="text-xs text-destructive leading-snug">
              Target key cannot start with{" "}
              <span className="font-mono">collect.</span> or{" "}
              <span className="font-mono">sub.</span> — those prefixes are
              reserved.
            </p>
          )}
          {targetField === "header" && (
            <p className="text-xs text-muted-foreground">
              Value injected verbatim — include any prefix (e.g.{" "}
              <code className="text-primary font-mono">Bearer</code>) in the
              extracted value if needed.
            </p>
          )}
        </div>

        {/* URL template — only for path/url injection */}
        {(targetField === "path" || targetField === "url") && (
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={targetUrlInputId}
              className="text-xs text-muted-foreground"
            >
              {targetField === "path"
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
            {targetField === "path" && (
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
                <code className="font-mono">:{targetKey}</code> — the value will
                be appended instead.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
