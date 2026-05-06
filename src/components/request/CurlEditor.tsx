"use client";

import { Copy, Import } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateCurl } from "@/lib/curlGenerator";
import { CurlParseError, parseCurl } from "@/lib/curlParser";
import { useTabsStore } from "@/stores/useTabsStore";

type CurlEditorProps = {
  tabId: string;
};

export function CurlEditor({ tabId }: CurlEditorProps) {
  const [curlInput, setCurlInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const { tabs, updateTabState } = useTabsStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const t = useTranslations("request");
  const et = useTranslations("errors");

  if (!tab) return null;
  if (tab.type !== "http") return null;

  const generatedCurl = generateCurl(tab);

  function handleImport() {
    if (!curlInput.trim()) return;
    setParseError(null);

    try {
      const parsed = parseCurl(curlInput);
      updateTabState(tabId, {
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        body: parsed.body,
        auth: parsed.auth,
      });
      setCurlInput("");
      toast.success(et("curlImported"));
    } catch (err) {
      const msg =
        err instanceof CurlParseError ? err.message : "Failed to parse cURL";
      setParseError(msg);
    }
  }

  async function handleCopyGenerated() {
    try {
      await navigator.clipboard.writeText(generatedCurl);
      toast.success(et("curlCopied"));
    } catch {
      toast.error(et("failedToCopyClipboard"));
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{t("curl.import")}</p>
        </div>
        <Textarea
          data-testid="curl-input"
          className="min-h-[100px] font-mono text-xs"
          placeholder={t("curl.importPlaceholder")}
          value={curlInput}
          onChange={(e) => {
            setCurlInput(e.target.value);
            setParseError(null);
          }}
        />
        {parseError && <p className="text-xs text-destructive">{parseError}</p>}
        <Button
          data-testid="curl-import-btn"
          size="sm"
          className="gap-1.5 bg-theme-accent/10 text-theme-accent hover:bg-theme-accent/20"
          onClick={handleImport}
          disabled={!curlInput.trim()}
        >
          <Import className="h-3.5 w-3.5" />
          {t("curl.importButton")}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          {t("curl.importHelp")}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{t("curl.generated")}</p>
          <Button
            data-testid="copy-curl-btn"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={handleCopyGenerated}
          >
            <Copy className="h-3 w-3" />
            {t("curl.copy")}
          </Button>
        </div>
        <pre
          data-testid="generated-curl"
          className="rounded-md bg-muted p-2 font-mono text-[11px] text-theme-accent whitespace-pre-wrap break-all"
        >
          {generatedCurl || "No URL configured"}
        </pre>
      </div>
    </div>
  );
}
