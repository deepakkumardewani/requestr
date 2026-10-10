"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { useSettingsStore } from "@/stores/useSettingsStore";
import {
  MAX_CHAIN_CONCURRENCY,
  MIN_CHAIN_CONCURRENCY,
} from "@/stores/useUIStore";

type SettingsStore = ReturnType<typeof useSettingsStore.getState>;

type Props = {
  showHealthMonitor: boolean;
  showCodeGen: boolean;
  setSetting: SettingsStore["setSetting"];
  onClearHistoryClick: () => void;
  chainConcurrency: number;
  onChainConcurrencyChange: (concurrency: number) => void;
};

type FeatureRowProps = {
  testId: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
};

function FeatureRow({
  testId,
  label,
  description,
  checked,
  onCheckedChange,
}: FeatureRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label className="text-sm">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        data-testid={testId}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function GeneralSection({
  showHealthMonitor,
  showCodeGen,
  setSetting,
  onClearHistoryClick,
  chainConcurrency,
  onChainConcurrencyChange,
}: Props) {
  const t = useTranslations("settings");
  // Local draft lets the field be empty mid-edit; null means "show the stored value".
  const [concurrencyDraft, setConcurrencyDraft] = useState<string | null>(null);

  const handleConcurrencyChange = (raw: string) => {
    setConcurrencyDraft(raw);
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onChainConcurrencyChange(parsed);
  };

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-base font-semibold">{t("general.title")}</h2>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium">{t("general.features")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("general.featuresDescription")}
        </p>
        <div className="mt-3 space-y-3">
          <FeatureRow
            testId="health-indicators-switch"
            label={t("general.healthIndicators")}
            description={t("general.healthIndicatorsDescription")}
            checked={showHealthMonitor}
            onCheckedChange={(v) => setSetting("showHealthMonitor", v)}
          />
          <FeatureRow
            testId="code-gen-panel-switch"
            label={t("general.codeGenPanel")}
            description={t("general.codeGenPanelDescription")}
            checked={showCodeGen}
            onCheckedChange={(v) => setSetting("showCodeGen", v)}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium">{t("general.chainExecution")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("general.chainExecutionDescription")}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <Label htmlFor="chain-concurrency" className="text-sm">
            {t("general.chainConcurrency")}
          </Label>
          <Input
            id="chain-concurrency"
            data-testid="chain-concurrency-input"
            type="number"
            min={MIN_CHAIN_CONCURRENCY}
            max={MAX_CHAIN_CONCURRENCY}
            value={concurrencyDraft ?? chainConcurrency}
            onChange={(e) => handleConcurrencyChange(e.target.value)}
            onBlur={() => setConcurrencyDraft(null)}
            className="w-20"
          />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium">{t("general.dataManagement")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("general.dataManagementDescription")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={onClearHistoryClick}
            data-testid="clear-history-btn"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("general.clearHistory")}
          </Button>
        </div>
      </div>
    </div>
  );
}
