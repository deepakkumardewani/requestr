"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  RELAY_PANEL_POSITIONS,
  RELAY_WORKSPACE_ID,
  type RelayPanelPosition,
} from "@/lib/relay/constants";
import {
  getPermissionOption,
  isRelayPermissionMode,
  RELAY_PERMISSION_OPTIONS,
} from "@/lib/relay/permission";
import { clearAll } from "@/lib/relay/threadDb";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";

const EXPLAINER_ITEMS = ["sees", "hidden", "stored"] as const;

type SettingRowProps = {
  id: string;
  label: string;
  description: string;
  children: React.ReactNode;
};

function SettingRow({ id, label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function RelaySection() {
  const t = useTranslations("relay.settings");
  const tRoot = useTranslations("relay");
  const enabled = useRelayStore((s) => s.enabled);
  const position = useRelayStore((s) => s.position);
  const shareValues = useRelayStore((s) => s.shareValues);
  const setEnabled = useRelayStore((s) => s.setEnabled);
  const setPosition = useRelayStore((s) => s.setPosition);
  const setShareValues = useRelayStore((s) => s.setShareValues);
  const permissionMode = useRelayPermissionStore((s) => s.mode);
  const setPermissionMode = useRelayPermissionStore((s) => s.setMode);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const permissionOption = getPermissionOption(permissionMode);
  const permissionCaution =
    permissionOption.tone === "caution"
      ? tRoot("permission.badge.caution")
      : null;

  async function handleClear() {
    try {
      await clearAll(RELAY_WORKSPACE_ID);
    } catch (error) {
      console.error("[relay] clearing history failed", { error });
      toast.error(t("clearHistory.error"));
      return;
    }
    // The open dock must not keep showing a thread that no longer exists.
    useRelayStore.getState().setActiveThreadId(null);
    setConfirmOpen(false);
    toast.success(t("clearHistory.success"));
  }

  return (
    <div className="max-w-lg space-y-6" data-testid="relay-settings">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <SettingRow
          id="relay-enabled"
          label={t("enabled.label")}
          description={t("enabled.description")}
        >
          <Switch
            id="relay-enabled"
            data-testid="relay-enabled-switch"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </SettingRow>

        <SettingRow
          id="relay-position"
          label={t("position.label")}
          description={t("position.description")}
        >
          <Select
            value={position}
            onValueChange={(value) => setPosition(value as RelayPanelPosition)}
          >
            <SelectTrigger
              id="relay-position"
              className="w-32"
              data-testid="relay-position-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELAY_PANEL_POSITIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`position.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          id="relay-permission"
          label={tRoot("permission.settingsLabel")}
          description={[
            tRoot(permissionOption.descriptionKey),
            permissionCaution,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Select
            value={permissionMode}
            onValueChange={(value) => {
              if (isRelayPermissionMode(value)) setPermissionMode(value);
            }}
          >
            <SelectTrigger
              id="relay-permission"
              className="w-44"
              data-testid="relay-permission-select"
            >
              <SelectValue>{tRoot(permissionOption.labelKey)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RELAY_PERMISSION_OPTIONS.map((option) => (
                <SelectItem key={option.mode} value={option.mode}>
                  {tRoot(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          id="relay-share-values"
          label={t("shareValues.label")}
          description={t("shareValues.description")}
        >
          <Switch
            id="relay-share-values"
            data-testid="relay-share-values-switch"
            checked={shareValues}
            onCheckedChange={setShareValues}
          />
        </SettingRow>

        <SettingRow
          id="relay-clear-history"
          label={t("clearHistory.label")}
          description={t("clearHistory.description")}
        >
          <Button
            id="relay-clear-history"
            variant="destructive"
            size="sm"
            data-testid="relay-clear-history-btn"
            onClick={() => setConfirmOpen(true)}
          >
            {t("clearHistory.button")}
          </Button>
        </SettingRow>
      </div>

      <div className="rounded-lg border p-4" data-testid="relay-explainer">
        <h3 className="text-sm font-medium">{t("explainer.title")}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {EXPLAINER_ITEMS.map((item) => (
            <li key={item}>{t(`explainer.${item}`)}</li>
          ))}
        </ul>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("clearHistory.confirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("clearHistory.confirmDescription")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("clearHistory.cancel")}
            </Button>
            <Button
              variant="destructive"
              data-testid="relay-clear-history-confirm"
              onClick={() => void handleClear()}
            >
              {t("clearHistory.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
