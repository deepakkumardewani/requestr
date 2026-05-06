"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { useSettingsStore } from "@/stores/useSettingsStore";

type SettingsStore = ReturnType<typeof useSettingsStore.getState>;

type Props = {
  sslVerify: boolean;
  followRedirects: boolean;
  proxyUrl: string;
  setSetting: SettingsStore["setSetting"];
};

export function ProxySection({
  sslVerify,
  followRedirects,
  proxyUrl,
  setSetting,
}: Props) {
  const t = useTranslations("settings");

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-base font-semibold">{t("proxy.title")}</h2>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">{t("proxy.sslVerification")}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("proxy.sslVerificationDescription")}
            </p>
          </div>
          <Switch
            data-testid="ssl-verification-switch"
            checked={sslVerify}
            onCheckedChange={(v) => setSetting("sslVerify", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">{t("proxy.followRedirects")}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("proxy.followRedirectsDescription")}
            </p>
          </div>
          <Switch
            data-testid="follow-redirects-switch"
            checked={followRedirects}
            onCheckedChange={(v) => setSetting("followRedirects", v)}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <Label className="text-sm">{t("proxy.proxyUrl")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("proxy.proxyUrlDescription")}
        </p>
        <Input
          data-testid="proxy-url-input"
          className="h-8 font-mono text-xs"
          value={proxyUrl}
          placeholder={t("proxy.proxyUrlPlaceholder")}
          onChange={(e) => setSetting("proxyUrl", e.target.value)}
        />
      </div>
    </div>
  );
}
