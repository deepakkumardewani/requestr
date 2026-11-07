"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SECTION_CONTAINER } from "@/components/landing/constants";
import { cn } from "@/lib/utils";
import { useHeroMotion } from "../useHeroMotion";

interface StatusTick {
  code: number;
  text: string;
  /** Tailwind text color class, kept semantic so it works in light and dark. */
  tone: string;
}

const STATUS_TICKS: StatusTick[] = [
  { code: 200, text: "OK", tone: "text-emerald-500" },
  { code: 201, text: "Created", tone: "text-emerald-500" },
  { code: 404, text: "Not Found", tone: "text-amber-500" },
  { code: 500, text: "Server Error", tone: "text-red-500" },
];

const TICK_INTERVAL_MS = 2200;

/** Cycles through status codes; stays on the first (200) when motion is reduced. */
function useStatusTick(animate: boolean): StatusTick {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % STATUS_TICKS.length),
      TICK_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [animate]);

  return STATUS_TICKS[animate ? index : 0];
}

export function ConceptC() {
  const { animate } = useHeroMotion();
  const tick = useStatusTick(animate);

  return (
    <section
      className={cn(
        "flex min-h-[85dvh] flex-col justify-center py-16",
        SECTION_CONTAINER,
      )}
    >
      <div className="max-w-4xl space-y-8">
        <p
          className="font-mono text-sm text-muted-foreground"
          data-testid="hero-c-status"
        >
          <span className="text-muted-foreground/70">last response </span>
          <span className={cn("font-semibold", tick.tone)}>
            {tick.code} {tick.text}
          </span>
        </p>
        <h1 className="text-balance font-display text-5xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-7xl lg:text-8xl">
          Send the request.
          <br />
          <span className="text-muted-foreground">Skip the ceremony.</span>
        </h1>
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          A browser-native API client. No install, no account, and Relay writes
          the tests when you ask in plain words.
        </p>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open the app →
        </Link>
      </div>
    </section>
  );
}
