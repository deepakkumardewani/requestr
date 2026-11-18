"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  autoReplaceUrlSegment,
  jsonPathToVarName,
  resolveJsonPathFromParsed,
} from "@/lib/chainUtils";
import {
  detectChainAliasCollisions,
  isReservedAlias,
} from "@/lib/chainValueNamespace";
import type { RequestModel, ResponseData } from "@/types";
import type {
  ChainBlock,
  ChainEdge,
  ChainNodeState,
  DisplayBlock,
} from "@/types/chain";
import {
  DEFAULT_SOURCE_JSON_PATH,
  INJECTION_TARGET_FIELDS,
  type InjectionTargetField,
} from "@/types/chain";
import { JsonPathExplorer } from "../../dialogs/JsonPathExplorer";
import { AliasCollisionWarning } from "../AliasCollisionWarning";
import {
  TARGET_FIELD_BUTTON_KEYS,
  TARGET_FIELD_LABEL_KEYS,
} from "./targetFieldKeys";

type TargetField = InjectionTargetField;

const TARGET_FIELD_PLACEHOLDER: Record<TargetField, string> = {
  url: "userId",
  path: "id",
  header: "Authorization",
  body: "$.userId",
};

/** Stands in for a Display block that has no id yet, so its draft targetKey still counts in collision checks. */
const NEW_DISPLAY_FALLBACK_ID = "__edited-display__";

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
  /** Every edge/block in the chain, used to warn when this targetKey is published by another producer. */
  chainEdges?: ChainEdge[];
  chainBlocks?: ChainBlock[];
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
  chainEdges = [],
  chainBlocks = [],
  onChange,
}: DisplayExtractorProps) {
  const t = useTranslations("chain");
  const manualJsonPathInputId = useId();
  const targetKeyInputId = useId();
  const targetUrlInputId = useId();
  const targetKeyInputRef = useRef<HTMLInputElement>(null);

  const [sourceJsonPath, setSourceJsonPath] = useState(
    existingDisplayNode?.sourceJsonPath ?? DEFAULT_SOURCE_JSON_PATH,
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

  // Checked against the live (unsaved) targetKey so the warning appears as
  // the user types; a new Display block has no id yet, so a stand-in is used.
  const displayId = existingDisplayNode?.id ?? NEW_DISPLAY_FALLBACK_ID;
  const aliasCollisions = useMemo(() => {
    const draft: DisplayBlock = {
      id: displayId,
      type: "display",
      sourceJsonPath,
      targetField,
      targetKey,
    };
    const others = chainBlocks.filter((b) => b.id !== displayId);
    const collisions = detectChainAliasCollisions(
      [...others, draft],
      chainEdges,
    );
    return Object.fromEntries(
      Object.entries(collisions).filter(([, sources]) =>
        sources.some((s) => s.kind === "display" && s.id === displayId),
      ),
    );
  }, [
    chainBlocks,
    chainEdges,
    displayId,
    sourceJsonPath,
    targetField,
    targetKey,
  ]);

  const defaultTab = parsedResponseBody ? "explorer" : "manual";
  const isGet = targetRequest?.method === "GET";
  const availableFields: readonly TargetField[] = isGet
    ? INJECTION_TARGET_FIELDS.filter((field) => field !== "body")
    : INJECTION_TARGET_FIELDS;

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
          {t("injectionEditorExtractTitle")}
        </Label>
        <p className="text-xs text-muted-foreground -mt-1.5">
          {t.rich("injectionEditorExtractDescription", {
            name: sourceRequest?.name ?? "",
            strong: (chunks) => (
              <span className="font-medium text-foreground">{chunks}</span>
            ),
          })}
        </p>

        {!sourceResponse ? (
          <div className="rounded-md border border-border/50 bg-muted/20 px-4 py-3 flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {t("injectionEditorRunSourceFirst")}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs self-start"
              onClick={() => onRunSource?.(sourceRequest?.id ?? "")}
              disabled={sourceRunState === "running" || !sourceRequest}
            >
              {sourceRunState === "running"
                ? t("arrowConfigRunning")
                : t("arrowConfigRunSource")}
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
                {t("injectionEditorTabExplorer")}
              </TabsTrigger>
              <TabsTrigger value="manual" className="text-xs h-6 px-3">
                {t("injectionEditorTabManual")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="explorer" className="mt-2 flex flex-col gap-2">
              {parsedResponseBody ? (
                <>
                  <div data-testid="extractor-picker">
                    <JsonPathExplorer
                      data={parsedResponseBody}
                      selectedPath={sourceJsonPath}
                      onSelect={handleSelectJsonPath}
                      onDrop={handleSelectJsonPath}
                      dropZoneRef={targetKeyInputRef}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("injectionEditorExplorerHint", {
                      use: t("jsonPathExplorerUseButton"),
                    })}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("injectionEditorNotJson")}
                </p>
              )}
            </TabsContent>

            <TabsContent value="manual" className="mt-2 flex flex-col gap-2">
              <Label htmlFor={manualJsonPathInputId} className="sr-only">
                {t("injectionEditorManualPathLabel")}
              </Label>
              <Input
                id={manualJsonPathInputId}
                value={sourceJsonPath}
                onChange={(e) => setSourceJsonPath(e.target.value)}
                placeholder={DEFAULT_SOURCE_JSON_PATH}
                className="font-mono text-xs h-8"
              />
              <p className="text-xs text-muted-foreground">
                {t.rich("injectionEditorManualPathExamples", {
                  first: "$.data.token",
                  second: "$.user.id",
                  code: (chunks) => (
                    <code className="text-primary font-mono">{chunks}</code>
                  ),
                })}
              </p>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Connector */}
      <div className="flex items-center gap-3 -my-1">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {t("injectionEditorThenInjectAs")}
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {/* ── Injection group ───────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold text-foreground">
          {t("injectionEditorInjectTitle")}
        </Label>
        <p className="text-xs text-muted-foreground -mt-1.5">
          {t.rich("injectionEditorInjectDescription", {
            name: targetRequest?.name ?? "",
            strong: (chunks) => (
              <span className="font-medium text-foreground">{chunks}</span>
            ),
          })}
        </p>

        {/* Field selector */}
        <div className="flex flex-wrap gap-1.5">
          {availableFields.map((field) => (
            <button
              key={field}
              type="button"
              data-testid={`extractor-target-field-${field}`}
              aria-pressed={targetField === field}
              aria-label={t("injectionEditorInjectIntoAriaLabel", {
                field: t(TARGET_FIELD_BUTTON_KEYS[field]),
              })}
              onClick={() => handleTargetFieldChange(field)}
              className={`flex-1 min-w-[60px] rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                targetField === field
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              {t(TARGET_FIELD_BUTTON_KEYS[field])}
            </button>
          ))}
        </div>

        {/* Key input */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor={targetKeyInputId}
            className="text-xs text-muted-foreground"
          >
            {t(TARGET_FIELD_LABEL_KEYS[targetField])}
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
              {t.rich("injectionEditorTargetKeyReserved", {
                code: (chunks) => <span className="font-mono">{chunks}</span>,
              })}
            </p>
          )}
          <AliasCollisionWarning collisions={aliasCollisions} />
          {targetField === "header" && (
            <p className="text-xs text-muted-foreground">
              {t.rich("injectionEditorHeaderVerbatim", {
                example: "Bearer",
                code: (chunks) => (
                  <code className="text-primary font-mono">{chunks}</code>
                ),
              })}
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
                ? t("injectionEditorUrlTemplateLabel")
                : t("injectionEditorBaseUrlLabel")}
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
                {t.rich("injectionEditorPathHint", {
                  param: ":paramName",
                  from: "/todos/101",
                  to: "/todos/:id",
                  code: (chunks) => (
                    <code className="text-primary font-mono">{chunks}</code>
                  ),
                })}
              </p>
            )}
            {urlMissingPlaceholder && (
              <p className="text-xs text-amber-400">
                {t.rich("injectionEditorUrlMissingPlaceholder", {
                  param: `:${targetKey}`,
                  code: (chunks) => <code className="font-mono">{chunks}</code>,
                })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
