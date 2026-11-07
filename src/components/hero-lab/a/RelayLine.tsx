"use client";

import { useEffect, useState } from "react";
import { useHeroMotion } from "../useHeroMotion";
import { AssertionResult } from "./AssertionResult";

export const RELAY_PROMPT = "add a test that status is 200";
export const RELAY_EXPECTED_STATUS = 200;
const TYPING_INTERVAL_MS = 40;
const IDLE_HINT = "Send the request, then Relay can add a test.";

interface RelayLineProps {
  /** Status of the response that arrived; null until a response exists. */
  responseStatus: number | null;
}

/** Characters of the prompt revealed so far; animates once per response. */
function useTypedLength(active: boolean, animate: boolean): number {
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (!active || !animate) {
      setLength(0);
      return;
    }
    const timer = setInterval(() => {
      setLength((current) => {
        if (current >= RELAY_PROMPT.length) {
          clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, TYPING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, animate]);

  return length;
}

/**
 * Relay line under the response: types a request for a test, then shows the
 * assertion. With reduced motion it renders the finished state at once.
 */
export function RelayLine({ responseStatus }: RelayLineProps) {
  const { animate } = useHeroMotion();
  const typed = useTypedLength(responseStatus !== null, animate);

  if (responseStatus === null) {
    return (
      <p className="border-t border-border p-3 text-xs text-muted-foreground">
        {IDLE_HINT}
      </p>
    );
  }

  const visibleText = animate ? RELAY_PROMPT.slice(0, typed) : RELAY_PROMPT;
  const finished = !animate || typed >= RELAY_PROMPT.length;

  return (
    <div className="space-y-2 border-t border-border p-3 sm:p-4">
      <p
        className="font-mono text-xs text-foreground"
        data-testid="hero-a-relay"
      >
        <span className="mr-2 text-[var(--landing-accent)]">Relay</span>
        {visibleText}
      </p>
      {finished && (
        <AssertionResult
          status={responseStatus}
          expectedStatus={RELAY_EXPECTED_STATUS}
        />
      )}
    </div>
  );
}
