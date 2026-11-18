"use client";

import { AlertCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChainInput, ChainInputSource } from "@/types/chain";

const INPUT_SOURCES: ChainInputSource[] = ["literal", "env"];

/** Local editable row — carries a stable React key independent of the (possibly edited) input key. */
export type DraftInput = ChainInput & { rowId: string };

type StartInputRowProps = {
  input: DraftInput;
  isDuplicate: boolean;
  onChange: (rowId: string, patch: Partial<ChainInput>) => void;
  onDelete: (rowId: string) => void;
};

/** One editable Start-block input: key, literal-vs-env source toggle, and the matching value field. */
export function StartInputRow({
  input,
  isDuplicate,
  onChange,
  onDelete,
}: StartInputRowProps) {
  const t = useTranslations("chain");
  const isBlank = !input.key.trim();
  const sourceLabel = (source: ChainInputSource) =>
    source === "literal"
      ? t("startConfigSourceLiteral")
      : t("startConfigSourceEnv");

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1">
          <Input
            value={input.key}
            onChange={(e) => onChange(input.rowId, { key: e.target.value })}
            placeholder={t("startConfigKeyPlaceholder")}
            aria-label={t("startConfigKeyAriaLabel")}
            aria-invalid={isDuplicate || isBlank}
            data-testid="start-config-input-key"
            className="h-7 text-xs font-mono"
          />
          {isDuplicate && (
            <p className="flex items-center gap-1 text-[10px] text-destructive">
              <AlertCircle className="h-3 w-3" />
              {t("startConfigKeyUnique")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(input.rowId)}
          className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          data-testid="start-config-delete-input-btn"
          title={t("startConfigDeleteInputTooltip")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex gap-1.5">
        {INPUT_SOURCES.map((source) => (
          <button
            key={source}
            type="button"
            aria-pressed={input.source === source}
            aria-label={t("startConfigSetSourceAriaLabel", {
              source: sourceLabel(source),
            })}
            onClick={() => onChange(input.rowId, { source })}
            className={cn(
              "flex-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              input.source === source
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/50 text-muted-foreground hover:border-border/80 hover:text-foreground",
            )}
            data-testid={`start-config-source-${source}-btn`}
          >
            {sourceLabel(source)}
          </button>
        ))}
      </div>

      {input.source === "literal" ? (
        <Input
          value={input.defaultValue}
          onChange={(e) =>
            onChange(input.rowId, { defaultValue: e.target.value })
          }
          placeholder={t("startConfigDefaultValuePlaceholder")}
          aria-label={t("startConfigDefaultValuePlaceholder")}
          data-testid="start-config-default-value"
          className="h-7 text-xs"
        />
      ) : (
        <Input
          value={input.envVarKey ?? ""}
          onChange={(e) => onChange(input.rowId, { envVarKey: e.target.value })}
          placeholder={t("startConfigEnvVarPlaceholder")}
          aria-label={t("startConfigEnvVarPlaceholder")}
          data-testid="start-config-env-var"
          className="h-7 text-xs font-mono"
        />
      )}
    </div>
  );
}
