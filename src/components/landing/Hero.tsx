"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ClickSpark, RotatingText, TextType } from "@/components/reactbits";
import { cn } from "@/lib/utils";
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

const PROTOCOL_LIST = "HTTP, GraphQL, WebSocket & Socket.IO";

const CTA_BASE =
  "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[85dvh] flex-col justify-center overflow-hidden pt-16 pb-12 sm:min-h-screen sm:pt-20 sm:pb-16"
    >
      <div className="absolute inset-0 -z-10">
        <Aurora
          colors={[
            "rgba(52,211,153,0.35)",
            "rgba(96,165,250,0.28)",
            "rgba(192,132,252,0.25)",
          ]}
          speed={5}
          opacity={1}
        />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5 sm:space-y-6">
            <TextType
              text="Browser-native API testing"
              className="font-mono text-sm font-medium tracking-wide text-muted-foreground"
              typingSpeed={55}
              showCursor
            />

            <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              <span className="block sm:inline">Send a </span>
              <RotatingText
                words={HTTP_METHODS}
                colors={METHOD_COLORS}
                interval={1800}
                className="font-mono"
              />
              <span className="block sm:inline"> in seconds</span>
            </h1>

            <p className="max-w-prose text-base leading-relaxed text-muted-foreground sm:text-lg">
              Build, test, and inspect{" "}
              <span className="font-medium text-foreground/90">
                {PROTOCOL_LIST}
              </span>{" "}
              APIs entirely in your browser tab — fast, private, and zero setup.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ClickSpark color="var(--method-get)" count={10}>
                <Link
                  href="/app"
                  className={cn(
                    CTA_BASE,
                    CTA_INTERACTIVE,
                    "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
                  )}
                >
                  Try it now
                  <span aria-hidden="true">→</span>
                </Link>
              </ClickSpark>
            </div>
          </div>

          <div className="w-full min-w-0 lg:px-0">
            <ProductVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
