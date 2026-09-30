"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { generateId } from "@/lib/utils";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { RequestModel, ResponseData } from "@/types";
import type {
  ChainEdge,
  ChainInjection,
  ChainNodeState,
  DisplayBlock,
  EnvPromotion,
} from "@/types/chain";
import {
  DisplayExtractor,
  type DisplayExtractorData,
} from "./arrow-config/DisplayExtractor";
import { FormattedJsonResponseBody } from "./arrow-config/FormattedJsonResponseBody";
import { InjectionEditor } from "./arrow-config/InjectionEditor";

const DEFAULT_INJECTION: ChainInjection = {
  sourceJsonPath: "$.token",
  targetField: "header",
  targetKey: "Authorization",
};

type ArrowConfigPanelProps = {
  open: boolean;
  onClose: () => void;
  sourceRequest: RequestModel | null;
  targetRequest: RequestModel | null;
  existingEdge: ChainEdge | null;
  onSave: (edge: ChainEdge) => void;
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
};

type InjState = { injections: ChainInjection[]; targetUrl: string };
type DispState = DisplayExtractorData;

export function ArrowConfigPanel({
  open,
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
}: ArrowConfigPanelProps) {
  const { environments } = useEnvironmentsStore();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const isDisplayNodeMode = Boolean(displayNodeId);
  const panelSessionKey = `${displayNodeId ?? ""}|${existingEdge?.id ?? ""}`;

  // Computed initial values passed to child editors
  const initialInjections = useMemo((): ChainInjection[] => {
    if (existingEdge?.injections?.length) {
      return existingEdge.injections.map((inj) => ({ ...inj }));
    }
    return [{ ...DEFAULT_INJECTION }];
  }, [existingEdge?.id, existingEdge?.injections]);

  const initialTargetUrl = useMemo(
    () => existingEdge?.targetUrl ?? targetRequest?.url ?? "",
    [existingEdge?.targetUrl, targetRequest?.url],
  );

  // Refs hold current editor data without causing re-renders on every keystroke
  const injDataRef = useRef<InjState>({
    injections: initialInjections,
    targetUrl: initialTargetUrl,
  });
  const dispDataRef = useRef<DispState>({
    sourceJsonPath:
      existingDisplayNode?.sourceJsonPath ?? DEFAULT_INJECTION.sourceJsonPath,
    targetField:
      existingDisplayNode?.targetField ?? DEFAULT_INJECTION.targetField,
    targetKey: existingDisplayNode?.targetKey ?? DEFAULT_INJECTION.targetKey,
    targetUrl: existingDisplayNode?.targetUrl,
  });

  // Keep refs primed for the current session when panel (re)opens
  useEffect(() => {
    if (!open) return;
    injDataRef.current = {
      injections: initialInjections,
      targetUrl: initialTargetUrl,
    };
    dispDataRef.current = {
      sourceJsonPath:
        existingDisplayNode?.sourceJsonPath ?? DEFAULT_INJECTION.sourceJsonPath,
      targetField:
        existingDisplayNode?.targetField ?? DEFAULT_INJECTION.targetField,
      targetKey: existingDisplayNode?.targetKey ?? DEFAULT_INJECTION.targetKey,
      targetUrl: existingDisplayNode?.targetUrl,
    };
    setIsValid(true);
  }, [open, panelSessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsedResponseBody = useMemo(() => {
    if (!sourceResponse?.body) return null;
    try {
      const parsed = JSON.parse(sourceResponse.body);
      return parsed !== null && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }, [sourceResponse?.body]);

  const handleInjChange = useCallback(
    (injections: ChainInjection[], targetUrl: string, valid: boolean) => {
      injDataRef.current = { injections, targetUrl };
      setIsValid(valid);
    },
    [],
  );

  const handleDispChange = useCallback(
    (data: DisplayExtractorData, valid: boolean) => {
      dispDataRef.current = data;
      setIsValid(valid);
    },
    [],
  );

  const handleSave = () => {
    if (!isValid) return;

    if (displayNodeId) {
      const d = dispDataRef.current;
      const node: DisplayBlock = {
        id: displayNodeId,
        type: "display",
        sourceJsonPath: d.sourceJsonPath.trim(),
        targetField: d.targetField,
        targetKey: d.targetKey.trim(),
        targetUrl: d.targetUrl,
      };
      onSaveDisplayNode?.(node);
      onClose();
      return;
    }

    const { injections, targetUrl } = injDataRef.current;
    const hasPathInjection = injections.some(
      (inj) => inj.targetField === "path",
    );
    // `sourceRequest`/`targetRequest` are looked up from the API request list,
    // so they're null when the edge's endpoint is a control-flow node
    // (Evaluate/Validate/Delay/Condition/Display) — fall back to the edge's
    // existing endpoint ids so saving an edge never blanks them out.
    const edge: ChainEdge = {
      id: existingEdge?.id ?? generateId(),
      sourceRequestId: sourceRequest?.id ?? existingEdge?.sourceRequestId ?? "",
      targetRequestId: targetRequest?.id ?? existingEdge?.targetRequestId ?? "",
      targetUrl:
        hasPathInjection && targetUrl.trim() ? targetUrl.trim() : undefined,
      injections: injections.map((inj) => ({
        sourceJsonPath: inj.sourceJsonPath.trim(),
        targetField: inj.targetField,
        targetKey: inj.targetKey.trim(),
      })),
    };
    onSave(edge);
    onClose();
  };

  const handleDelete = () => {
    if (displayNodeId) {
      onDeleteDisplayNode?.(displayNodeId);
      onClose();
      return;
    }
    if (existingEdge) {
      onDelete(existingEdge.id);
    }
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[380px] sm:w-[420px] border-l border-border bg-card flex flex-col p-0"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-sm font-semibold tracking-tight">
            Configure Dependency
          </SheetTitle>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground max-w-[40%] truncate">
              {sourceRequest?.name ?? "Source"}
            </span>
            <span className="text-muted-foreground text-xs shrink-0">→</span>
            <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground max-w-[40%] truncate">
              {targetRequest?.name ?? "Target"}
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
              panelOpen={open}
              panelSessionKey={panelSessionKey}
              onChange={handleDispChange}
            />
          ) : (
            <InjectionEditor
              parsedResponseBody={parsedResponseBody}
              sourceRequest={sourceRequest}
              targetRequest={targetRequest}
              sourceRunState={sourceRunState}
              sourceResponse={sourceResponse}
              onRunSource={onRunSource}
              initialInjections={initialInjections}
              initialTargetUrl={initialTargetUrl}
              panelOpen={open}
              panelSessionKey={panelSessionKey}
              onChange={handleInjChange}
            />
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
                  setViewerOpen(true);
                }
              }}
              disabled={sourceRunState === "running" || !sourceRequest}
            >
              {sourceRunState === "running" ? "Running..." : "Run Source API"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setViewerOpen(true)}
              disabled={!sourceResponse}
            >
              View Response
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
                Delete Config
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isValid}
              className="flex-[2]"
            >
              Save
            </Button>
            {existingEdge &&
              (() => {
                const promotion = envPromotions?.find(
                  (p) => p.edgeId === existingEdge.id,
                );
                if (!promotion) return null;
                const envName =
                  environments.find((e) => e.id === promotion.envId)?.name ??
                  promotion.envId;
                return (
                  <span
                    className="inline-flex items-center self-center rounded border border-violet-500/30 bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-400"
                    title={`Extracted value will be written to ${promotion.envVarName} in ${envName}`}
                  >
                    → ENV
                  </span>
                );
              })()}
          </div>
        </div>
      </SheetContent>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0 bg-muted/20">
            <DialogTitle className="text-base">
              Response: {sourceRequest?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-card p-5 font-mono text-xs">
            {sourceRunState === "running" ? (
              <div className="text-muted-foreground flex items-center gap-2 animate-pulse">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Running request...
              </div>
            ) : sourceResponse ? (
              <FormattedJsonResponseBody body={sourceResponse.body} />
            ) : (
              <div className="text-muted-foreground">
                No response yet. Run the API first.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
