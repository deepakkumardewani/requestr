import { RotateCcw, Trash2 } from "lucide-react";
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
  onRestartTour: () => void;
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
  onRestartTour,
}: Props) {
  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-base font-semibold">General</h2>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium">Features</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Toggle optional UI features
        </p>
        <div className="mt-3 space-y-3">
          <FeatureRow
            label="Health indicators"
            description="Show success rate and response time in collections"
            checked={showHealthMonitor}
            onCheckedChange={(v) => setSetting("showHealthMonitor", v)}
          />
          <FeatureRow
            label="Code generation panel"
            description="Show code snippets for the current request (cURL, fetch, axios, Python, Go)"
            checked={showCodeGen}
            onCheckedChange={(v) => setSetting("showCodeGen", v)}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium">Data Management</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage locally stored data
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
            Clear History
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onRestartTour}
            data-testid="restart-tour-btn"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restart Tour
          </Button>
        </div>
      </div>
    </div>
  );
}
