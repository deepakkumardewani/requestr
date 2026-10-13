"use client";

import { CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { type MappedRelayError, RELAY_ERROR_META } from "@/lib/relay/errors";

const COUNTDOWN_TICK_MS = 1000;
/** Used when a rate-limit response carried no Retry-After. */
const DEFAULT_RETRY_AFTER_SECONDS = 30;

type ErrorBubbleProps = {
  error: MappedRelayError;
  online: boolean;
  onRetry: () => void;
  onEditMessage: () => void;
};

function useCountdown(initialSeconds: number): number {
  const [remaining, setRemaining] = useState(initialSeconds);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(
      () => setRemaining((seconds) => seconds - 1),
      COUNTDOWN_TICK_MS,
    );
    return () => clearTimeout(timer);
  }, [remaining]);
  return remaining;
}

function CountdownRetry({
  seconds,
  onRetry,
}: {
  seconds: number;
  onRetry: () => void;
}) {
  const t = useTranslations("relay");
  const remaining = useCountdown(seconds);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={remaining > 0}
      onClick={onRetry}
      data-testid="relay-retry"
    >
      {remaining > 0 ? t("retryIn", { seconds: remaining }) : t("retry")}
    </Button>
  );
}

/** Friendly copy plus the recovery action for one FR-70 code. */
export function ErrorBubble({
  error,
  online,
  onRetry,
  onEditMessage,
}: ErrorBubbleProps) {
  const t = useTranslations("relay");
  const meta = RELAY_ERROR_META[error.code];

  return (
    <div
      role="alert"
      data-testid="relay-banner"
      data-error-code={error.code}
      className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <div className="flex items-start gap-2">
        <CircleAlertIcon
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden
        />
        <p>{t(meta.messageKey)}</p>
      </div>
      {meta.action === "retry_after_countdown" ? (
        <CountdownRetry
          seconds={error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS}
          onRetry={onRetry}
        />
      ) : null}
      {meta.action === "retry" || meta.action === "retry_when_online" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={meta.action === "retry_when_online" && !online}
          onClick={onRetry}
          data-testid="relay-retry"
        >
          {t("retry")}
        </Button>
      ) : null}
      {meta.action === "edit_message" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onEditMessage}
          data-testid="relay-edit-message"
        >
          {t("editMessage")}
        </Button>
      ) : null}
    </div>
  );
}
