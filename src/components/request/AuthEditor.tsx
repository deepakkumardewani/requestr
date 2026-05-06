"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTabsStore } from "@/stores/useTabsStore";
import type { AuthConfig, AuthType } from "@/types";

type AuthEditorProps = {
  tabId: string;
};

export function AuthEditor({ tabId }: AuthEditorProps) {
  const { tabs, updateTabState } = useTabsStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const t = useTranslations("request");

  if (!tab) return null;
  if (tab.type !== "http" && tab.type !== "graphql") return null;

  const { auth } = tab;

  function handleTypeChange(type: AuthType | null) {
    if (!type) return;
    let newAuth: AuthConfig;
    switch (type) {
      case "none":
        newAuth = { type: "none" };
        break;
      case "bearer":
        newAuth = { type: "bearer", token: "" };
        break;
      case "basic":
        newAuth = { type: "basic", username: "", password: "" };
        break;
      case "api-key":
        newAuth = { type: "api-key", key: "", value: "", addTo: "header" };
        break;
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unhandled auth type: ${_exhaustive}`);
      }
    }
    updateTabState(tabId, { auth: newAuth });
  }

  const authTypes = [
    { value: "none" as const, label: t("auth.types.none") },
    { value: "bearer" as const, label: t("auth.types.bearer") },
    { value: "basic" as const, label: t("auth.types.basic") },
    { value: "api-key" as const, label: t("auth.types.apiKey") },
  ];

  return (
    <div className="space-y-4 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("auth.authType")}</Label>
        <Select value={auth.type} onValueChange={handleTypeChange}>
          <SelectTrigger
            className="h-8 w-56 text-xs"
            data-testid="auth-type-selector"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {authTypes.map((at) => (
              <SelectItem
                key={at.value}
                value={at.value}
                className="text-xs"
                data-testid={`auth-type-${at.value}`}
              >
                {at.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {auth.type === "bearer" && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t("auth.token")}</Label>
          <Input
            className="h-8 font-mono text-xs"
            type="password"
            data-testid="auth-bearer-token"
            value={auth.token}
            placeholder={t("auth.bearerPlaceholder")}
            onChange={(e) =>
              updateTabState(tabId, {
                auth: { ...auth, token: e.target.value },
              })
            }
          />
        </div>
      )}

      {auth.type === "basic" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("auth.username")}</Label>
            <Input
              className="h-8 text-xs"
              data-testid="auth-basic-username"
              value={auth.username}
              placeholder={t("auth.usernamePlaceholder")}
              onChange={(e) =>
                updateTabState(tabId, {
                  auth: { ...auth, username: e.target.value },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("auth.password")}</Label>
            <Input
              className="h-8 text-xs"
              type="password"
              data-testid="auth-basic-password"
              value={auth.password}
              placeholder={t("auth.passwordPlaceholder")}
              onChange={(e) =>
                updateTabState(tabId, {
                  auth: { ...auth, password: e.target.value },
                })
              }
            />
          </div>
        </div>
      )}

      {auth.type === "api-key" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("auth.keyName")}</Label>
              <Input
                className="h-8 text-xs"
                data-testid="auth-apikey-name"
                value={auth.key}
                placeholder={t("auth.keyNamePlaceholder")}
                onChange={(e) =>
                  updateTabState(tabId, {
                    auth: { ...auth, key: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("auth.keyValue")}</Label>
              <Input
                className="h-8 font-mono text-xs"
                type="password"
                data-testid="auth-apikey-value"
                value={auth.value}
                placeholder={t("auth.keyValuePlaceholder")}
                onChange={(e) =>
                  updateTabState(tabId, {
                    auth: { ...auth, value: e.target.value },
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("auth.addTo")}</Label>
            <Select
              value={auth.addTo}
              onValueChange={(v) => {
                if (!v) return;
                updateTabState(tabId, {
                  auth: { ...auth, addTo: v as "header" | "query" },
                });
              }}
            >
              <SelectTrigger
                className="h-8 w-40 text-xs"
                data-testid="auth-apikey-addto"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="header"
                  className="text-xs"
                  data-testid="auth-apikey-addto-header"
                >
                  {t("auth.addToHeader")}
                </SelectItem>
                <SelectItem
                  value="query"
                  className="text-xs"
                  data-testid="auth-apikey-addto-query"
                >
                  {t("auth.addToQuery")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {auth.type === "none" && (
        <p className="text-xs text-muted-foreground">{t("auth.noAuth")}</p>
      )}
    </div>
  );
}
