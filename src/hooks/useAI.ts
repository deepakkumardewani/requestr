"use client";

import { useCallback, useState } from "react";
import { isRelayErrorCode, type RelayErrorCode } from "@/lib/relay/errors";

/** Friendly copy per mapped code; provider text never reaches the UI (FR-62). */
const AI_ERROR_MESSAGES: Record<RelayErrorCode, string> = {
  relay_unavailable: "The AI service is unavailable right now. Try again.",
  rate_limited: "Too many requests. Wait a moment and try again.",
  offline: "You appear to be offline.",
  context_too_long: "That input is too long for the AI service.",
  tool_failed: "The AI request failed. Try again.",
  aborted: "The AI request was cancelled.",
  not_configured: "AI isn't set up on this server.",
};

/** Route validation errors are plain strings; mapped failures are codes. */
function toDisplayMessage(error: string): string {
  return isRelayErrorCode(error) ? AI_ERROR_MESSAGES[error] : error;
}

type AIState<T> = {
  loading: boolean;
  error: string | null;
  run: (payload: Record<string, unknown>) => Promise<T | null>;
  reset: () => void;
};

export function useAI<T>(action: string): AIState<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  const run = useCallback(
    async (payload: Record<string, unknown>): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            data.error
              ? toDisplayMessage(data.error)
              : `Request failed with status ${res.status}`,
          );
        }

        return (await res.json()) as T;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  return { loading, error, run, reset };
}
