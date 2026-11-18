"use client";

import { useTranslations } from "next-intl";
import { KVTable } from "@/components/common/KVTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { KVPair } from "@/types";

export function GlobalSection() {
  const t = useTranslations("settings.requestDefaults");
  const globalBaseUrl = useSettingsStore((s) => s.globalBaseUrl);
  const globalHeaders = useSettingsStore((s) => s.globalHeaders);
  const setSetting = useSettingsStore((s) => s.setSetting);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <Label htmlFor="global-base-url">{t("baseUrl")}</Label>
        <Input
          id="global-base-url"
          data-testid="global-base-url-input"
          className="font-mono text-xs"
          placeholder="https://api.example.com"
          value={globalBaseUrl}
          onChange={(e) => setSetting("globalBaseUrl", e.target.value)}
        />
      </div>

      <div className="rounded-lg border p-4">
        <Label className="text-sm">{t("defaultHeaders")}</Label>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          {t("defaultHeadersDescription")}
        </p>
        <KVTable
          rows={globalHeaders}
          onChange={(rows: KVPair[]) => setSetting("globalHeaders", rows)}
          keyPlaceholder={t("headerPlaceholder")}
          valuePlaceholder={t("valuePlaceholder")}
        />
      </div>
    </div>
  );
}
