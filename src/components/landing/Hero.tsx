"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AnimatedContent, BlurText, ClickSpark } from "@/components/reactbits";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import {
  HERO_HEADLINE_LEAD,
  HERO_HEADLINE_TAIL,
  HERO_SUBLINE,
  SECTION_CONTAINER,
} from "./constants";
import { CTA_INTERACTIVE } from "./interactionStyles";
import { ProductVisual } from "./ProductVisual";
import { WatchDemoButton } from "./WatchDemoButton";

const Aurora = dynamic(
  () => import("@/components/reactbits/Aurora").then((m) => m.Aurora),
  { ssr: false },
);

const AURORA_COLORS = [
  "rgba(52,211,153,0.35)",
  "rgba(96,165,250,0.28)",
  "rgba(192,132,252,0.25)",
];
/** Aurora is tuned for dark backgrounds; dim it in light mode so it doesn't wash out. */
const AURORA_OPACITY_DARK = 1;
const AURORA_OPACITY_LIGHT = 0.5;

const CTA_BASE =
  "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Aurora opacity tuned per theme; falls back to the dark value until mounted to avoid hydration mismatch. */
function useAuroraOpacity(): number {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) return AURORA_OPACITY_DARK;
  return resolvedTheme === "light" ? AURORA_OPACITY_LIGHT : AURORA_OPACITY_DARK;
}

interface StatusTick {
  code: number;
  text: string;
  /** Semantic text color so it reads in light and dark. */
  tone: string;
}

const STATUS_TICKS: StatusTick[] = [
  { code: 200, text: "OK", tone: "text-emerald-500" },
  { code: 201, text: "Created", tone: "text-emerald-500" },
  { code: 404, text: "Not Found", tone: "text-amber-500" },
  { code: 500, text: "Server Error", tone: "text-red-500" },
];
const TICK_INTERVAL_MS = 2200;

/** The four moments the product walks through, in order (Send, Read, Chain, Relay). */
const STAGES = ["Send", "Read", "Chain", "Relay"] as const;

/** Cycles through status codes; holds on 200 under reduced motion. */
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

function StageRail() {
  return (
    <ol
      aria-label="From request to test"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground"
    >
      {STAGES.map((stage, i) => (
        <li key={stage} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">→</span>}
          {stage}
        </li>
      ))}
    </ol>
  );
}

export function Hero() {
  const auroraOpacity = useAuroraOpacity();
  const reduced = useReducedMotion();
  const tick = useStatusTick(!reduced);

  return (
    <section
      id="hero"
      className="relative flex min-h-[85dvh] flex-col justify-center overflow-x-hidden scroll-mt-20 pt-16 pb-16 sm:min-h-screen sm:pt-20 sm:pb-20"
    >
      <div className="absolute inset-0 -z-10">
        <Aurora colors={AURORA_COLORS} speed={5} opacity={auroraOpacity} />
      </div>

      <div className={cn("w-full", SECTION_CONTAINER)}>
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5 sm:space-y-6">
            <AnimatedContent direction="up" delay={0}>
              <p
                className="font-mono text-sm text-muted-foreground"
                data-testid="hero-status"
              >
                <span className="text-muted-foreground/70">last response </span>
                <span className={cn("font-semibold", tick.tone)}>
                  {tick.code} {tick.text}
                </span>
              </p>
            </AnimatedContent>

            <h1 className="text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <BlurText text={HERO_HEADLINE_LEAD} as="span" duration={0.45} />
              <br />
              <span className="text-muted-foreground">
                <BlurText
                  text={HERO_HEADLINE_TAIL}
                  as="span"
                  duration={0.45}
                  delay={0.1}
                />
              </span>
            </h1>

            <AnimatedContent direction="up" delay={0.14}>
              <p className="max-w-prose text-base leading-relaxed text-muted-foreground sm:text-lg">
                {HERO_SUBLINE}
              </p>
            </AnimatedContent>

            <AnimatedContent direction="up" delay={0.22}>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <ClickSpark color="var(--landing-accent)" count={10}>
                  <Link
                    href="/app"
                    className={cn(
                      CTA_BASE,
                      CTA_INTERACTIVE,
                      "group bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
                    )}
                  >
                    Open the app
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none"
                    >
                      →
                    </span>
                  </Link>
                </ClickSpark>
                <WatchDemoButton />
              </div>
            </AnimatedContent>

            <AnimatedContent direction="up" delay={0.28}>
              <div className="space-y-3">
                <StageRail />
                <p className="text-xs text-muted-foreground/60">
                  No sign-up · No CORS errors · Open source
                </p>
              </div>
            </AnimatedContent>
          </div>

          <AnimatedContent
            direction="left"
            delay={0.12}
            className="w-full min-w-0 overflow-visible lg:px-0"
          >
            <ProductVisual />
          </AnimatedContent>
        </div>
      </div>
    </section>
  );
}
