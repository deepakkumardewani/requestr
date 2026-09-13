"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  AnimatedContent,
  BlurText,
  ClickSpark,
  RotatingText,
} from "@/components/reactbits";
import { cn } from "@/lib/utils";
import { SECTION_CONTAINER } from "./constants";
import { CTA_INTERACTIVE } from "./interactionStyles";
import { ProductVisual } from "./ProductVisual";

const Aurora = dynamic(
  () => import("@/components/reactbits/Aurora").then((m) => m.Aurora),
  { ssr: false },
);

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const METHOD_COLORS = [
  "var(--method-get)",
  "var(--method-post)",
  "var(--method-put)",
  "var(--method-patch)",
  "var(--method-delete)",
];

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

export function Hero() {
  const auroraOpacity = useAuroraOpacity();

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
              <p className="font-mono text-sm font-medium tracking-wide text-muted-foreground">
                Browser-native API client
              </p>
            </AnimatedContent>

            <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              <span className="block sm:inline">
                <BlurText text="Send a" as="span" duration={0.45} />
              </span>{" "}
              <RotatingText
                words={HTTP_METHODS}
                colors={METHOD_COLORS}
                interval={1800}
                className="font-mono"
              />{" "}
              <span className="block sm:inline">
                <BlurText
                  text="in seconds."
                  as="span"
                  duration={0.45}
                  delay={0.1}
                />
              </span>
            </h1>

            <AnimatedContent direction="up" delay={0.14}>
              <p className="max-w-prose text-base leading-relaxed text-muted-foreground sm:text-lg">
                Test HTTP, GraphQL, WebSocket and Socket.IO APIs from a browser
                tab. Nothing installs, nothing syncs, nothing leaves your
                machine.
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
              </div>
            </AnimatedContent>

            <AnimatedContent direction="up" delay={0.28}>
              <p className="text-xs text-muted-foreground/60">
                No sign-up · No CORS errors · Open source
              </p>
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
