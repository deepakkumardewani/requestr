"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { useSettingsStore } from "@/stores/useSettingsStore";

type SettingsStore = ReturnType<typeof useSettingsStore.getState>;

type Props = {
  showHealthMonitor: boolean;
  showCodeGen: boolean;
  setSetting: SettingsStore["setSetting"];
  onClearHistoryClick: () => void;
};

type FeatureRowProps = {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
};

function FeatureRow({
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
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function GeneralSection({
  showHealthMonitor,
  showCodeGen,
  setSetting,
  onClearHistoryClick,
}: Props) {
  const t = useTranslations("settings");

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
            label={t("general.healthIndicators")}
            description={t("general.healthIndicatorsDescription")}
            checked={showHealthMonitor}
            onCheckedChange={(v) => setSetting("showHealthMonitor", v)}
          />
          <FeatureRow
            label={t("general.codeGenPanel")}
            description={t("general.codeGenPanelDescription")}
            checked={showCodeGen}
            onCheckedChange={(v) => setSetting("showCodeGen", v)}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium">{t("general.dataManagement")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("general.dataManagementDescription")}
        </p>
        <div className="mt-3">
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
