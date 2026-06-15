"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ClickSpark,
  RotatingText,
  TextType,
} from "@/components/reactbits";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
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

const PROTOCOLS = ["HTTP", "GraphQL", "WebSocket", "Socket.IO"];
const PROTOCOL_COLORS = [
  "var(--method-get)",
  "var(--method-post)",
  "var(--method-put)",
  "var(--method-delete)",
];
const PROTOCOL_STATIC_FALLBACK = "HTTP, GraphQL, WebSocket & Socket.IO";

const CTA_BASE =
  "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CTA_INTERACTIVE = "hover:scale-[1.03] active:scale-[0.97] hover:opacity-95";

export function Hero() {
  const reduced = useReducedMotion();

  return (
    <section
      id="hero"
      className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-20 pb-16"
    >
      <div className="absolute inset-0 -z-10">
        <Aurora
          colors={[
            "rgba(52,211,153,0.22)",
            "rgba(96,165,250,0.18)",
            "rgba(192,132,252,0.16)",
          ]}
          speed={3}
          opacity={1}
          scale={1.35}
          amplitude={0.28}
          blur={72}
          density={3}
        />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6">
            <TextType
              text="Browser-native API testing"
              className="font-mono text-sm font-medium tracking-wide text-muted-foreground"
              typingSpeed={55}
              showCursor
            />

            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Send a{" "}
              <RotatingText
                words={HTTP_METHODS}
                colors={METHOD_COLORS}
                interval={1800}
                className="font-mono"
              />{" "}
              <br className="hidden sm:block" />
              in seconds
            </h1>

            <p className="max-w-prose text-lg leading-relaxed text-muted-foreground">
              Build, test, and inspect{" "}
              <span className="sr-only">{PROTOCOL_STATIC_FALLBACK}</span>
              <noscript>{PROTOCOL_STATIC_FALLBACK}</noscript>
              {reduced ? (
                <span className="font-medium text-foreground/90">
                  {PROTOCOL_STATIC_FALLBACK}
                </span>
              ) : (
                <RotatingText
                  words={PROTOCOLS}
                  colors={PROTOCOL_COLORS}
                  interval={2200}
                  className="font-medium text-foreground/90"
                />
              )}{" "}
              APIs entirely in your browser tab — fast, private, and zero setup.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ClickSpark color="var(--method-get)" count={10}>
                <Link
                  href="/app"
                  className={cn(
                    CTA_BASE,
                    CTA_INTERACTIVE,
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  Try it now
                  <span aria-hidden="true">→</span>
                </Link>
              </ClickSpark>

              <a
                href="#how-it-works"
                className={cn(
                  CTA_BASE,
                  CTA_INTERACTIVE,
                  "border border-border font-medium text-foreground hover:bg-muted hover:translate-y-[-1px] active:translate-y-0",
                )}
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="w-full px-4 lg:px-0">
            <ProductVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
