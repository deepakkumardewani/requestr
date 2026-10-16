"use client";

import {
  CheckIcon,
  CopyIcon,
  RefreshCwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageAction,
  MessageActions as MessageActionsRow,
} from "@/components/ai-elements/message";
import {
  type RelayFeedbackRating,
  trackRelayEvent,
} from "@/lib/relay/telemetry";

const COPIED_RESET_MS = 1500;

type MessageActionsProps = {
  /** Markdown of the answer, copied as-is. */
  markdown: string;
  /** Only the last assistant message can be regenerated. */
  onRegenerate?: () => void;
};

/** Copy, regenerate and thumbs for one finished assistant answer. */
export function MessageActions({
  markdown,
  onRegenerate,
}: MessageActionsProps) {
  const t = useTranslations("relay");
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<RelayFeedbackRating | null>(null);
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

  const handleRate = (next: RelayFeedbackRating) => {
    if (rating === next) return;
    setRating(next);
    // Rating only: the answer text never leaves this component (FR-192).
    trackRelayEvent("relay_feedback", { rating: next });
  };

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
      <MessageAction
        label={t("actions.thumbsUp")}
        aria-pressed={rating === "up"}
        data-testid="relay-thumbs-up"
        onClick={() => handleRate("up")}
      >
        <ThumbsUpIcon aria-hidden />
      </MessageAction>
      <MessageAction
        label={t("actions.thumbsDown")}
        aria-pressed={rating === "down"}
        data-testid="relay-thumbs-down"
        onClick={() => handleRate("down")}
      >
        <ThumbsDownIcon aria-hidden />
      </MessageAction>
    </MessageActionsRow>
  );
}
