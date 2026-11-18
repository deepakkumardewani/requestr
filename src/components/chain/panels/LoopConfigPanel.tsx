"use client";

import { AlertCircle, Repeat2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseJsonObject } from "@/lib/chainJson";
import { isValidLoopAlias } from "@/lib/chainValueNamespace";
import type { LoopBlock } from "@/types/chain";
import {
  LOOP_MAX_ITERATIONS_CAP,
  LOOP_MAX_ITERATIONS_DEFAULT,
} from "@/types/chain";
import { JsonPathExplorer } from "../dialogs/JsonPathExplorer";
import { ConfigPanelShell } from "./ConfigPanelShell";
import { useSyncOnNode } from "./useSyncOnNode";

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
  const t = useTranslations("chain");
  const tRunError = useTranslations("errors");
  const [sourceJsonPath, setSourceJsonPath] = useState("");
  const [itemAlias, setItemAlias] = useState("");
  const [maxIterations, setMaxIterations] = useState<number>(
    LOOP_MAX_ITERATIONS_DEFAULT,
  );

  const isMaxIterationsValid =
    Number.isInteger(maxIterations) &&
    maxIterations >= 1 &&
    maxIterations <= LOOP_MAX_ITERATIONS_CAP;
  const isAliasValid = isValidLoopAlias(itemAlias);
  const canSave =
    sourceJsonPath.trim().length > 0 && isAliasValid && isMaxIterationsValid;

  useSyncOnNode(node, (n) => {
    setSourceJsonPath(n.sourceJsonPath);
    setItemAlias(n.itemAlias);
    setMaxIterations(n.maxIterations);
  });

  const parsedResponseBody = useMemo(
    () => parseJsonObject(sourceResponseBody ?? ""),
    [sourceResponseBody],
  );

  if (!node) return null;

  function handleSave() {
    if (!canSave || !node) return;
    onSave({
      ...node,
      sourceJsonPath,
      itemAlias,
      maxIterations,
    });
  }

  return (
    <ConfigPanelShell
      open={open}
      title={t("loopConfigTitle")}
      icon={Repeat2}
      iconClassName="text-amber-400"
      canSave={canSave}
      saveButtonTestId="loop-config-save-btn"
      onSave={handleSave}
      onDelete={() => onDelete(node.id)}
      onClose={onClose}
    >
      {/* Source JSONPath */}
      <div data-testid="loop-config-form" className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("loopConfigSourceLabel")}
        </Label>
        <Input
          data-testid="loop-config-source-path"
          value={sourceJsonPath}
          onChange={(e) => setSourceJsonPath(e.target.value)}
          placeholder={t("loopConfigSourcePlaceholder")}
          className="h-8 text-sm font-mono"
        />
        <p className="text-[10px] text-muted-foreground leading-snug">
          {t.rich("loopConfigSourceHint", {
            code: (chunks) => <span className="font-mono">{chunks}</span>,
          })}
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
          {t("loopConfigItemAliasLabel")}
        </Label>
        <Input
          data-testid="loop-config-item-alias"
          value={itemAlias}
          onChange={(e) => setItemAlias(e.target.value)}
          placeholder={t("loopConfigItemAliasPlaceholder")}
          className="h-8 text-sm font-mono"
        />
        {itemAlias.length > 0 && !isAliasValid && (
          <p role="alert" className="text-[10px] text-destructive leading-snug">
            {tRunError("chain.runError.loopInvalidAlias", { alias: itemAlias })}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground leading-snug">
          {t.rich("loopConfigItemAliasHint", {
            itemPlaceholder: `{{${itemAlias || t("loopConfigItemAliasFallback")}}}`,
            indexPlaceholder: "{{index}}",
            code: (chunks) => <span className="font-mono">{chunks}</span>,
          })}
        </p>
      </div>

      {/* Max Iterations */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("loopConfigMaxIterationsLabel")}
        </Label>
        <Input
          data-testid="loop-config-max-iterations"
          type="number"
          min="1"
          max={LOOP_MAX_ITERATIONS_CAP}
          value={maxIterations}
          onChange={(e) => setMaxIterations(parseInt(e.target.value, 10))}
          className="h-8 text-sm font-mono"
        />
        {!isMaxIterationsValid && (
          <div
            role="alert"
            className="flex gap-2 items-start p-2 rounded-md border border-destructive/50 bg-destructive/5"
          >
            <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-destructive leading-snug">
              {t("loopConfigMaxIterationsInvalid", {
                max: LOOP_MAX_ITERATIONS_CAP,
              })}
            </p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground leading-snug">
          {t("loopConfigMaxIterationsHint", {
            default: LOOP_MAX_ITERATIONS_DEFAULT,
          })}
        </p>
      </div>
    </ConfigPanelShell>
  );
}
