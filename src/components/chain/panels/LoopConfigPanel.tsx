"use client";

import { AlertCircle, Repeat2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { LoopBlock } from "@/types/chain";
import {
  LOOP_MAX_ITERATIONS_CAP,
  LOOP_MAX_ITERATIONS_DEFAULT,
} from "@/types/chain";
import { JsonPathExplorer } from "../dialogs/JsonPathExplorer";

type LoopConfigPanelProps = {
  open: boolean;
  node: LoopBlock | null;
  onClose: () => void;
  onSave: (node: LoopBlock) => void;
  onDelete: (nodeId: string) => void;
  /** Upstream response body (JSON string) the JSONPath explorer picks `sourceJsonPath` from, when available. */
  sourceResponseBody?: string;
};

export function LoopConfigPanel({
  open,
  node,
  onClose,
  onSave,
  onDelete,
  sourceResponseBody,
}: LoopConfigPanelProps) {
  const [sourceJsonPath, setSourceJsonPath] = useState("");
  const [itemAlias, setItemAlias] = useState("");
  const [maxIterations, setMaxIterations] = useState<number>(
    LOOP_MAX_ITERATIONS_DEFAULT,
  );

  // Validate maxIterations
  const isMaxIterationsValid =
    maxIterations >= 1 && maxIterations <= LOOP_MAX_ITERATIONS_CAP;
  const canSave =
    sourceJsonPath.trim().length > 0 &&
    itemAlias.trim().length > 0 &&
    isMaxIterationsValid;

  // Sync local state when the node changes
  useEffect(() => {
    if (!node) return;
    setSourceJsonPath(node.sourceJsonPath);
    setItemAlias(node.itemAlias);
    setMaxIterations(node.maxIterations);
  }, [node]);

  const parsedResponseBody = useMemo(() => {
    if (!sourceResponseBody) return null;
    try {
      const parsed = JSON.parse(sourceResponseBody);
      return parsed !== null && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }, [sourceResponseBody]);

  if (!node) return null;

  function handleSave() {
    if (!canSave || !node) return;
    onSave({
      ...node,
      sourceJsonPath,
      itemAlias,
      maxIterations,
    });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="right" className="w-[400px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Repeat2 className="h-4 w-4 text-amber-400" />
            Configure Loop
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Source JSONPath */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Array to iterate (JSONPath)
            </Label>
            <Input
              value={sourceJsonPath}
              onChange={(e) => setSourceJsonPath(e.target.value)}
              placeholder="e.g. $.data.items"
              className="h-8 text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground leading-snug">
              Specify a JSONPath pointing to an array in an upstream response.
              Example: <span className="font-mono">$.data.items</span>
            </p>
            {parsedResponseBody && (
              <JsonPathExplorer
                data={parsedResponseBody}
                selectedPath={sourceJsonPath}
                onSelect={setSourceJsonPath}
              />
            )}
          </div>

          {/* Item Alias */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Item alias (variable name)
            </Label>
            <Input
              value={itemAlias}
              onChange={(e) => setItemAlias(e.target.value)}
              placeholder="e.g. item"
              className="h-8 text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground leading-snug">
              The current item is exposed as{" "}
              <span className="font-mono">{`{{${itemAlias || "alias"}}}`}</span>
              . Also available: <span className="font-mono">{`{{index}}`}</span>
              .
            </p>
          </div>

          {/* Max Iterations */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Max iterations
            </Label>
            <Input
              type="number"
              min="1"
              max={LOOP_MAX_ITERATIONS_CAP}
              value={maxIterations}
              onChange={(e) => setMaxIterations(parseInt(e.target.value, 10))}
              className="h-8 text-sm font-mono"
            />
            {!isMaxIterationsValid && (
              <div className="flex gap-2 items-start p-2 rounded-md border border-destructive/50 bg-destructive/5">
                <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-destructive leading-snug">
                  Must be between 1 and {LOOP_MAX_ITERATIONS_CAP}.
                </p>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground leading-snug">
              Limit iterations to prevent infinite loops. Default is{" "}
              {LOOP_MAX_ITERATIONS_DEFAULT}.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onClose}
          >
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete node
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
