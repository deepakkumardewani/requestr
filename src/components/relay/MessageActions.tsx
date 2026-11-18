"use client";

import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageAction,
  MessageActions as MessageActionsRow,
} from "@/components/ai-elements/message";

const COPIED_RESET_MS = 1500;

type MessageActionsProps = {
  /** Markdown of the answer, copied as-is. */
  markdown: string;
  /** Only the last assistant message can be regenerated. */
  onRegenerate?: () => void;
};

/** Copy and regenerate for one finished assistant answer. */
export function MessageActions({
  markdown,
  onRegenerate,
}: MessageActionsProps) {
  const t = useTranslations("relay");
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
    } catch (error) {
      console.error("[relay] copy message failed", error);
      return;
    }
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [markdown]);

  return (
    <MessageActionsRow
      role="group"
      aria-label={t("actions.label")}
      data-testid="relay-answer-actions"
    >
      <MessageAction
        label={copied ? t("copied") : t("actions.copy")}
        data-testid="relay-copy-message"
        onClick={handleCopy}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </MessageAction>
      {onRegenerate ? (
        <MessageAction
          label={t("regenerate")}
          data-testid="relay-regenerate"
          onClick={onRegenerate}
        >
          <RefreshCwIcon aria-hidden />
        </MessageAction>
      ) : null}
    </MessageActionsRow>
  );
}
