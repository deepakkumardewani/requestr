"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { parseJsonObject } from "@/lib/chainJson";
import { generateId } from "@/lib/utils";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { RequestModel, ResponseData } from "@/types";
import type {
  ChainBlock,
  ChainEdge,
  ChainInjection,
  ChainNodeState,
  DisplayBlock,
  EnvPromotion,
} from "@/types/chain";
import { CHAIN_HANDLE_IDS, DEFAULT_SOURCE_JSON_PATH } from "@/types/chain";
import {
  DisplayExtractor,
  type DisplayExtractorData,
} from "./DisplayExtractor";
import { InjectionEditor } from "./InjectionEditor";

const DEFAULT_INJECTION: ChainInjection = {
  sourceJsonPath: DEFAULT_SOURCE_JSON_PATH,
  targetField: "header",
  targetKey: "Authorization",
};

export type ArrowConfigPanelBodyProps = {
  onClose: () => void;
  sourceRequest: RequestModel | null;
  targetRequest: RequestModel | null;
  existingEdge: ChainEdge | null;
  onSave: (edge: ChainEdge) => void | Promise<void>;
  onDelete: (edgeId: string) => void;
  sourceRunState?: ChainNodeState;
  sourceResponse?: ResponseData;
  onRunSource?: (requestId: string) => void;
  envPromotions?: EnvPromotion[];
  /** Set when this panel is configuring a DisplayNode instead of an edge. */
  displayNodeId?: string;
  existingDisplayNode?: DisplayBlock;
  onSaveDisplayNode?: (node: DisplayBlock) => void;
  onDeleteDisplayNode?: (nodeId: string) => void;
  /** The chain's edges/blocks, so a new (unsaved) edge is checked live against the rest of the chain. */
  chainEdges?: ChainEdge[];
  chainBlocks?: ChainBlock[];
  onViewResponse: () => void;
};

type InjectionDraft = { injections: ChainInjection[]; targetUrl: string };

function initialInjectionDraft(
  existingEdge: ChainEdge | null,
  targetRequest: RequestModel | null,
): InjectionDraft {
  const injections = existingEdge?.injections?.length
    ? existingEdge.injections.map((inj) => ({ ...inj }))
    : [{ ...DEFAULT_INJECTION }];
  return {
    injections,
    targetUrl: existingEdge?.targetUrl ?? targetRequest?.url ?? "",
  };
}

function initialDisplayDraft(
  existing: DisplayBlock | undefined,
): DisplayExtractorData {
  return {
    sourceJsonPath:
      existing?.sourceJsonPath ?? DEFAULT_INJECTION.sourceJsonPath,
    targetField: existing?.targetField ?? DEFAULT_INJECTION.targetField,
    targetKey: existing?.targetKey ?? DEFAULT_INJECTION.targetKey,
    targetUrl: existing?.targetUrl,
  };
}

/**
 * Header, editor and footer of the arrow/display config panel. The parent keys
 * it on the open session, so its draft state is seeded once per session and
 * never needs a reset effect.
 */
export function ArrowConfigPanelBody({
  onClose,
  sourceRequest,
  targetRequest,
  existingEdge,
  onSave,
  onDelete,
  sourceRunState,
  sourceResponse,
  onRunSource,
  envPromotions,
  displayNodeId,
  existingDisplayNode,
  onSaveDisplayNode,
  onDeleteDisplayNode,
  chainEdges,
  chainBlocks,
  onViewResponse,
}: ArrowConfigPanelBodyProps) {
  const t = useTranslations("chain");
  const environments = useEnvironmentsStore((s) => s.environments);
  const [initialInjections] = useState(() =>
    initialInjectionDraft(existingEdge, targetRequest),
  );
  const [injDraft, setInjDraft] = useState<InjectionDraft>(initialInjections);
  const [dispDraft, setDispDraft] = useState<DisplayExtractorData>(() =>
    initialDisplayDraft(existingDisplayNode),
  );
  const [isValid, setIsValid] = useState(true);
  const [branchId, setBranchId] = useState(existingEdge?.branchId);
  const isDisplayNodeMode = Boolean(displayNodeId);

  const parsedResponseBody = useMemo(
    () => parseJsonObject(sourceResponse?.body ?? ""),
    [sourceResponse?.body],
  );

  const handleInjChange = useCallback(
    (injections: ChainInjection[], targetUrl: string, valid: boolean) => {
      setInjDraft({ injections, targetUrl });
      setIsValid(valid);
    },
    [],
  );

  const handleDispChange = useCallback(
    (data: DisplayExtractorData, valid: boolean) => {
      setDispDraft(data);
      setIsValid(valid);
    },
    [],
  );

  const handleSave = async () => {
    if (!isValid) return;

    if (displayNodeId) {
      onSaveDisplayNode?.({
        id: displayNodeId,
        type: "display",
        sourceJsonPath: dispDraft.sourceJsonPath.trim(),
        targetField: dispDraft.targetField,
        targetKey: dispDraft.targetKey.trim(),
        targetUrl: dispDraft.targetUrl,
      });
      onClose();
      return;
    }

    const { injections, targetUrl } = injDraft;
    const hasPathInjection = injections.some(
      (inj) => inj.targetField === "path",
    );
    const starterUntouched =
      !existingEdge?.injections?.length &&
      injections.length === 1 &&
      injections[0]?.sourceJsonPath.trim() ===
        DEFAULT_INJECTION.sourceJsonPath &&
      injections[0]?.targetField === DEFAULT_INJECTION.targetField &&
      injections[0]?.targetKey.trim() === DEFAULT_INJECTION.targetKey;
    // `sourceRequest`/`targetRequest` are looked up from the API request list,
    // so they're null when the edge's endpoint is a control-flow node
    // (Evaluate/Validate/Delay/Condition/Display) — fall back to the edge's
    // existing endpoint ids so saving an edge never blanks them out.
    // Spread the existing edge so routing fields (`branchId`) and any future
    // edge field survive a save; only the edited fields are overridden.
    const edge: ChainEdge = {
      ...existingEdge,
      id: existingEdge?.id ?? generateId(),
      sourceRequestId: sourceRequest?.id ?? existingEdge?.sourceRequestId ?? "",
      targetRequestId: targetRequest?.id ?? existingEdge?.targetRequestId ?? "",
      targetUrl:
        hasPathInjection && targetUrl.trim() ? targetUrl.trim() : undefined,
      injections: starterUntouched
        ? []
        : injections
            .map((inj) => ({
              sourceJsonPath: inj.sourceJsonPath.trim(),
              targetField: inj.targetField,
              targetKey: inj.targetKey.trim(),
            }))
            .filter((inj) => inj.sourceJsonPath.length > 0),
      ...(branchId ? { branchId } : {}),
    };
    await onSave(edge);
    onClose();
  };

  const handleDelete = () => {
    if (displayNodeId) {
      onDeleteDisplayNode?.(displayNodeId);
    } else if (existingEdge) {
      onDelete(existingEdge.id);
    }
    onClose();
  };

  const promotion = existingEdge
    ? envPromotions?.find((p) => p.edgeId === existingEdge.id)
    : undefined;
  const promotionEnvName = promotion
    ? (environments.find((e) => e.id === promotion.envId)?.name ??
      promotion.envId)
    : "";

  return (
    <>
      {/* Header */}
      <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
        <SheetTitle className="text-sm font-semibold tracking-tight">
          {t("arrowConfigTitle")}
        </SheetTitle>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground max-w-[40%] truncate">
            {sourceRequest?.name ?? t("arrowConfigSourceFallback")}
          </span>
          <span className="text-muted-foreground text-xs shrink-0">→</span>
          <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground max-w-[40%] truncate">
            {targetRequest?.name ?? t("arrowConfigTargetFallback")}
          </span>
        </div>
      </SheetHeader>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {isDisplayNodeMode ? (
          <DisplayExtractor
            parsedResponseBody={parsedResponseBody}
            sourceRequest={sourceRequest}
            targetRequest={targetRequest}
            sourceRunState={sourceRunState}
            sourceResponse={sourceResponse}
            onRunSource={onRunSource}
            existingDisplayNode={existingDisplayNode}
            chainEdges={chainEdges}
            chainBlocks={chainBlocks}
            onChange={handleDispChange}
          />
        ) : (
          <>
            <div
              className="mb-4 flex gap-1.5"
              role="group"
              aria-label={t("handleSemanticsExplainer")}
            >
              <button
                type="button"
                data-testid="arrow-config-handle-success"
                aria-pressed={branchId === CHAIN_HANDLE_IDS.SUCCESS}
                onClick={() => setBranchId(CHAIN_HANDLE_IDS.SUCCESS)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                  branchId === CHAIN_HANDLE_IDS.SUCCESS
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {t("edgeLabelSuccess")}
              </button>
              <button
                type="button"
                data-testid="arrow-config-handle-fail"
                aria-pressed={branchId === CHAIN_HANDLE_IDS.FAIL}
                onClick={() => setBranchId(CHAIN_HANDLE_IDS.FAIL)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                  branchId === CHAIN_HANDLE_IDS.FAIL
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {t("edgeLabelFail")}
              </button>
            </div>
            <InjectionEditor
              parsedResponseBody={parsedResponseBody}
              sourceRequest={sourceRequest}
              targetRequest={targetRequest}
              sourceRunState={sourceRunState}
              sourceResponse={sourceResponse}
              onRunSource={onRunSource}
              initialInjections={initialInjections.injections}
              initialTargetUrl={initialInjections.targetUrl}
              edgeId={existingEdge?.id}
              chainEdges={chainEdges}
              chainBlocks={chainBlocks}
              onChange={handleInjChange}
            />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => {
              if (sourceRequest?.id) {
                onRunSource?.(sourceRequest.id);
                onViewResponse();
              }
            }}
            disabled={sourceRunState === "running" || !sourceRequest}
          >
            {sourceRunState === "running"
              ? t("arrowConfigRunning")
              : t("arrowConfigRunSource")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={onViewResponse}
            disabled={!sourceResponse}
          >
            {t("arrowConfigViewResponse")}
          </Button>
        </div>

        <div className="flex gap-2">
          {(existingEdge || existingDisplayNode) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="flex-1"
            >
              {t("arrowConfigDeleteConfig")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex-1"
          >
            {t("configPanelCancelButton")}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isValid}
            className="flex-[2]"
          >
            {t("configPanelSaveButton")}
          </Button>
          {promotion && (
            <span
              className="inline-flex items-center self-center rounded border border-violet-500/30 bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-400"
              title={t("arrowConfigPromotionTitle", {
                varName: promotion.envVarName,
                envName: promotionEnvName,
              })}
            >
              {t("arrowConfigEnvBadge")}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
