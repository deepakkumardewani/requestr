"use client";

import { useTranslations } from "next-intl";
import { KVTable } from "@/components/common/KVTable";
import { buildUrlWithParams } from "@/lib/utils";
import { useTabsStore } from "@/stores/useTabsStore";
import type { KVPair } from "@/types";

type ParamsEditorProps = {
  tabId: string;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

export function ParamsEditor({ tabId }: ParamsEditorProps) {
  const { tabs, updateTabState } = useTabsStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const t = useTranslations("request");

  if (!tab) return null;
  if (tab.type !== "http") return null;

  const { url } = tab;
  const pathParams = tab.params.filter((p) => p.type === "path");
  const queryParams = tab.params.filter((p) => p.type !== "path");

  function handleQueryChange(updated: KVPair[]) {
    const newUrl = buildUrlWithParams(url, updated);
    updateTabState(tabId, { params: [...pathParams, ...updated], url: newUrl });
  }

  function handlePathChange(updated: KVPair[]) {
    updateTabState(tabId, { params: [...updated, ...queryParams] });
  }

  return (
    <div className="h-full overflow-auto">
      {pathParams.length > 0 && (
        <>
          <SectionLabel>{t("params.pathParams")}</SectionLabel>
          <KVTable
            rows={pathParams}
            onChange={handlePathChange}
            keyPlaceholder={t("params.keyPlaceholder")}
            valuePlaceholder={t("params.valuePlaceholder")}
            readOnlyKeys
            hideCheckbox
          />
        </>
      )}
      <SectionLabel>{t("params.queryParams")}</SectionLabel>
      <KVTable
        rows={queryParams}
        onChange={handleQueryChange}
        keyPlaceholder={t("params.keyPlaceholder")}
        valuePlaceholder={t("params.valuePlaceholder")}
      />
    </div>
  );
}
