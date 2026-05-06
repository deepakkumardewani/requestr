"use client";

import { Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";
import { MAX_RESPONSE_DISPLAY_BYTES } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";

type RawViewerProps = {
  body: string;
};

export function RawViewer({ body }: RawViewerProps) {
  const bytes = new TextEncoder().encode(body).length;
  const isTruncated = bytes > MAX_RESPONSE_DISPLAY_BYTES;
  const displayBody = isTruncated
    ? body.slice(0, MAX_RESPONSE_DISPLAY_BYTES)
    : body;

  const t = useTranslations("response");
  const et = useTranslations("errors");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body);
      toast.success(et("responseCopied"));
    } catch {
      toast.error(et("failedToCopy"));
    }
  }

  function handleDownload() {
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "response.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col" data-testid="response-raw-viewer">
      <div className="flex items-center justify-between border-b px-3 py-1">
        <span className="text-[11px] text-muted-foreground">
          {formatBytes(bytes)}
        </span>
        <div className="flex gap-1">
          <TooltipIconButton label={t("actions.copy")} onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />
          </TooltipIconButton>
          <TooltipIconButton
            label={t("actions.download")}
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
          </TooltipIconButton>
        </div>
      </div>

      {isTruncated && (
        <div className="bg-amber-500/10 px-3 py-1 text-[11px] text-amber-400">
          {t("truncated", { size: formatBytes(MAX_RESPONSE_DISPLAY_BYTES) })}{" "}
          <button type="button" onClick={handleDownload} className="underline">
            {t("downloadFull")}
          </button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <pre
          className="p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all"
          data-testid="response-raw-body"
        >
          {displayBody}
        </pre>
      </ScrollArea>
    </div>
  );
}
