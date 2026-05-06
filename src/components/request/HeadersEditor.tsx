"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KVTable } from "@/components/common/KVTable";
import { Button } from "@/components/ui/button";
import { useAI } from "@/hooks/useAI";
import { generateId } from "@/lib/utils";
import { useTabsStore } from "@/stores/useTabsStore";
import type { KVPair } from "@/types";

type HeadersEditorProps = {
  tabId: string;
};

export function HeadersEditor({ tabId }: HeadersEditorProps) {
  const { tabs, updateTabState } = useTabsStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const { run, loading } =
    useAI<Array<{ key: string; value: string }>>("suggest-headers");
  const t = useTranslations("request");

  if (!tab) return null;

  function handleChange(headers: KVPair[]) {
    updateTabState(tabId, { headers });
  }

  async function handleSuggest() {
    const bodyType = tab?.type === "http" ? tab.body.type : "none";
    const url = tab?.type === "http" ? tab.url : "";
    const method = tab?.type === "http" ? tab.method : "GET";
    const existingKeys = (tab?.headers ?? []).map((h) => h.key.toLowerCase());

    const result = await run({ url, method, bodyType, existingKeys });
    if (!result) return;

    const newHeaders: KVPair[] = result
      .filter((h) => !existingKeys.includes(h.key.toLowerCase()))
      .map((h) => ({
        id: generateId(),
        key: h.key,
        value: h.value,
        enabled: true,
      }));

    if (newHeaders.length === 0) {
      toast.info("No new headers to add — all suggestions already present.");
      return;
    }

    updateTabState(tabId, {
      headers: [...(tab?.headers ?? []), ...newHeaders],
    });
    toast.success(
      `Added ${newHeaders.length} header${newHeaders.length > 1 ? "s" : ""}`,
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b px-3 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => void handleSuggest()}
          disabled={loading}
          data-testid="suggest-headers-btn"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Suggest headers
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <KVTable
          rows={tab.headers}
          onChange={handleChange}
          keyPlaceholder={t("headers.headerPlaceholder")}
          valuePlaceholder={t("headers.valuePlaceholder")}
          enableHeaderValueMask
        />
      </div>
    </div>
  );
}
