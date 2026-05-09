"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabsStore } from "@/stores/useTabsStore";
import { AdvancedTab } from "../AdvancedTab";
import { AuthEditor } from "../AuthEditor";
import { HeadersEditor } from "../HeadersEditor";
import { ParamsEditor } from "../ParamsEditor";

const AUTH_TYPE_LABELS: Record<string, string> = {
  bearer: "Bearer",
  basic: "Basic",
  "api-key": "API Key",
};

const BodyEditor = dynamic(
  () => import("../BodyEditor").then((m) => ({ default: m.BodyEditor })),
  {
    ssr: false,
  },
);
const ScriptEditor = dynamic(
  () => import("../ScriptEditor").then((m) => ({ default: m.ScriptEditor })),
  { ssr: false },
);

type HttpTabsProps = {
  tabId: string;
};

export function HttpTabs({ tabId }: HttpTabsProps) {
  const { tabs } = useTabsStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const t = useTranslations("request");

  if (!tab || tab.type !== "http") return null;

  const enabledHeadersCount = tab.headers.filter(
    (h) => h.enabled && h.key,
  ).length;
  const enabledParamsCount = tab.params.filter(
    (p) => p.enabled && p.key,
  ).length;

  const authLabel =
    tab.auth.type !== "none"
      ? `${t("tabs.auth")} · ${AUTH_TYPE_LABELS[tab.auth.type] ?? tab.auth.type}`
      : t("tabs.auth");

  return (
    <Tabs defaultValue="params" className="flex h-full flex-col">
      <TabsList className="mt-2 h-9 shrink-0 rounded-none border-b bg-transparent px-3 justify-start gap-0">
        <TabsTrigger
          value="params"
          data-testid="request-tab-params"
          className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
        >
          {t("tabs.params")}
          {enabledParamsCount > 0 && (
            <span className="ml-1 rounded-full bg-theme-accent/20 px-1.5 py-0.5 text-[10px] text-theme-accent">
              {enabledParamsCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="headers"
          data-testid="request-tab-headers"
          className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
        >
          {t("tabs.headers")}
          {enabledHeadersCount > 0 && (
            <span className="ml-1 rounded-full bg-theme-accent/20 px-1.5 py-0.5 text-[10px] text-theme-accent">
              {enabledHeadersCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="auth"
          data-testid="request-tab-auth"
          className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
        >
          {authLabel}
          {tab.auth.type !== "none" && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-theme-accent" />
          )}
        </TabsTrigger>
        <TabsTrigger
          value="body"
          data-testid="request-tab-body"
          className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
        >
          {t("tabs.body")}
          {tab.body.type !== "none" && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-theme-accent" />
          )}
        </TabsTrigger>
        <TabsTrigger
          value="scripts"
          data-testid="request-tab-scripts"
          className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
        >
          {t("tabs.scripts")}
        </TabsTrigger>
        <TabsTrigger
          value="advanced"
          data-testid="request-tab-advanced"
          className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
        >
          Advanced
          {(tab.sslVerify !== undefined ||
            tab.followRedirects !== undefined ||
            tab.timeoutMs !== undefined) && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-theme-accent" />
          )}
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="params" className="mt-0 h-full overflow-auto">
          <ParamsEditor tabId={tabId} />
        </TabsContent>
        <TabsContent value="headers" className="mt-0 h-full overflow-auto">
          <HeadersEditor tabId={tabId} />
        </TabsContent>
        <TabsContent value="auth" className="mt-0 h-full overflow-auto">
          <AuthEditor tabId={tabId} />
        </TabsContent>
        <TabsContent value="body" className="mt-0 h-full overflow-hidden">
          <BodyEditor tabId={tabId} />
        </TabsContent>
        <TabsContent value="scripts" className="mt-0 h-full overflow-hidden">
          <ScriptEditor tabId={tabId} />
        </TabsContent>
        <TabsContent value="advanced" className="mt-0 h-full overflow-auto">
          <AdvancedTab tabId={tabId} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
