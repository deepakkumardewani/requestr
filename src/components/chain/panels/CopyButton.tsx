import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text }: { text: string }) {
  const t = useTranslations("chain");
  const [copied, setCopied] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetRef.current !== null) {
        clearTimeout(resetRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(() => {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Clipboard write failed", err);
    });
    setCopied(true);
    if (resetRef.current !== null) {
      clearTimeout(resetRef.current);
    }
    resetRef.current = setTimeout(() => {
      resetRef.current = null;
      setCopied(false);
    }, 2000);
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
      onClick={handleClick}
      aria-label={copied ? t("copyButtonCopied") : t("copyButtonCopy")}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </Button>
  );
}
