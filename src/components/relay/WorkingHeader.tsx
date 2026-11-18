"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/relay/duration";
import { activeSeconds, isWaiting } from "@/lib/relay/timing";
import { useRelayStore } from "@/stores/useRelayStore";

const TICK_MS = 1000;
const DOT_CLASS =
  "size-1.5 shrink-0 rounded-full bg-muted-foreground motion-safe:animate-pulse";

/** Re-renders once a second while `active`, so the elapsed time advances. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * The live status of a turn: "Working for Ns" ticking each second, or
 * "Waiting for you" with the timer paused while a card is pending (CONV-02).
 */
export function WorkingHeader() {
  const t = useTranslations("relay");
  const turn = useRelayStore((s) => s.liveTurn?.turn);
  const waiting = turn ? isWaiting(turn) : false;
  const now = useNow(!waiting);
  const seconds = turn ? activeSeconds(turn, now) : 0;

  return (
    <p
      data-testid="relay-working-header"
      data-waiting={waiting}
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <span aria-hidden data-testid="relay-working-dot" className={DOT_CLASS} />
      {/* The ticking value is not announced every second; the waiting state is. */}
      <span aria-hidden={!waiting}>
        {waiting
          ? t("turn.waiting")
          : t("turn.working", { duration: formatDuration(seconds) })}
      </span>
    </p>
  );
}
