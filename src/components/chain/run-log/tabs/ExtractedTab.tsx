"use client";

import { useTranslations } from "next-intl";
import { PromoteToEnvPopover } from "@/components/chain/dialogs/PromoteToEnvPopover";
import type { RunStep } from "@/lib/chainRunHistory";
import {
  isDetailedExtractionKey,
  jsonPathToVarName,
  parseDetailedExtractionKey,
} from "@/lib/chainUtils";
import type { EnvPromotion } from "@/types/chain";

type ExtractedTabProps = {
  step: RunStep;
  envPromotions?: EnvPromotion[];
  onSavePromotion?: (promotion: EnvPromotion) => void;
  onRemovePromotion?: (edgeId: string) => void;
};

type ExtractedRowProps = {
  edgeId: string;
  sourceJsonPath: string;
  value: unknown;
  envPromotions?: EnvPromotion[];
  onSavePromotion?: (promotion: EnvPromotion) => void;
  onRemovePromotion?: (edgeId: string) => void;
};

function ExtractedRow({
  edgeId,
  sourceJsonPath,
  value,
  envPromotions,
  onSavePromotion,
  onRemovePromotion,
}: ExtractedRowProps) {
  const t = useTranslations("chain");
  const suggestedVarName = jsonPathToVarName(sourceJsonPath);
  const existingPromotion = envPromotions?.find((p) => p.edgeId === edgeId);
  const canPromote = onSavePromotion && onRemovePromotion;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/40 bg-muted/10 px-3 py-2 font-mono text-xs">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-primary">{suggestedVarName}</span>
        <span className="text-muted-foreground">{sourceJsonPath}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">
          {t("runLogExtractedDestinationLabel")}: {edgeId}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {value === null ? (
          <span className="flex-1 italic text-red-400">not found</span>
        ) : (
          <span className="flex-1 break-all text-emerald-400">
            {String(value)}
          </span>
        )}
        {canPromote && (
          <PromoteToEnvPopover
            edgeId={edgeId}
            suggestedVarName={suggestedVarName}
            extractedValue={value === null ? null : String(value)}
            existingPromotion={existingPromotion}
            onSave={onSavePromotion}
            onRemove={onRemovePromotion}
          />
        )}
      </div>
    </div>
  );
}

export function ExtractedTab({
  step,
  envPromotions,
  onSavePromotion,
  onRemovePromotion,
}: ExtractedTabProps) {
  const t = useTranslations("chain");
  const detailedEntries = Object.entries(step.extractedValues).filter(([key]) =>
    isDetailedExtractionKey(key),
  );

  if (detailedEntries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("runLogExtractedEmpty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {detailedEntries.map(([key, value]) => {
        const parsed = parseDetailedExtractionKey(key);
        if (!parsed) return null;

        return (
          <ExtractedRow
            key={key}
            edgeId={parsed.edgeId}
            sourceJsonPath={parsed.sourceJsonPath}
            value={value}
            envPromotions={envPromotions}
            onSavePromotion={onSavePromotion}
            onRemovePromotion={onRemovePromotion}
          />
        );
      })}
    </div>
  );
}
