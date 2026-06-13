"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  BlurText,
  ClickSpark,
  RotatingText,
  TextType,
} from "@/components/reactbits";
import { cn } from "@/lib/utils";

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

const METHOD_TEXT: Record<string, string> = {
  GET: "text-emerald-400",
  POST: "text-blue-400",
  PUT: "text-amber-400",
  PATCH: "text-purple-400",
  DELETE: "text-red-400",
};

interface TabPillProps {
  method: string;
  label: string;
  active?: boolean;
}

function TabPill({ method, label, active }: TabPillProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs select-none",
        active ? "bg-card border border-border/60" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "font-mono font-semibold text-[10px]",
          METHOD_TEXT[method],
        )}
      >
        {method}
      </span>
      <span
        className={cn(
          "font-mono text-[11px]",
          active ? "text-foreground" : "text-muted-foreground/70",
        )}
      >
        /{label}
      </span>
    </div>
  );
}

function ProductVisual() {
  return (
    <div className="relative w-full">
      <div className="rounded-xl border border-border bg-card/80 shadow-2xl overflow-hidden backdrop-blur-sm">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-border bg-background/50 px-3 py-2">
          <TabPill method="GET" label="users" active />
          <TabPill method="POST" label="auth/login" />
          <TabPill method="DELETE" label="items/42" />
          <span className="ml-auto text-muted-foreground/40 text-xs font-mono">
            +
          </span>
        </div>

        <div className="p-4 space-y-3">
          {/* URL bar */}
          <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-sm">
            <span className="font-semibold text-emerald-400 text-xs">GET</span>
            <span className="text-muted-foreground/40 text-xs">│</span>
            <span className="text-muted-foreground/50 text-xs">{"{"}</span>
            <span className="text-purple-400 text-xs">{"{"}</span>
            <span className="text-purple-300 text-xs">BASE_URL</span>
            <span className="text-purple-400 text-xs">{"}"}</span>
            <span className="text-purple-400 text-xs">{"}"}</span>
            <span className="text-muted-foreground text-xs">/users</span>
            <span className="ml-auto rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
              Send
            </span>
          </div>

          {/* Headers */}
          <div className="rounded-md border border-border bg-background/30 p-2.5 space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1">
              Headers
            </p>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-muted-foreground/50 w-24 shrink-0 truncate">
                Authorization
              </span>
              <span className="text-emerald-400/70">Bearer ••••••••••</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-muted-foreground/50 w-24 shrink-0 truncate">
                Accept
              </span>
              <span className="text-blue-400/70">application/json</span>
            </div>
          </div>

          {/* Response */}
          <div className="rounded-md border border-border bg-[oklch(0.12_0.005_285)] p-3 font-mono text-xs space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/25">
                200 OK
              </span>
              <span className="text-muted-foreground/40">38 ms · 1.2 kB</span>
            </div>
            <div className="text-muted-foreground/50">{"["}</div>
            <div className="pl-3 space-y-0.5">
              <div className="text-muted-foreground/40">{"{"}</div>
              <div className="pl-3">
                <span className="text-blue-400/80">"id"</span>
                <span className="text-muted-foreground/40">: </span>
                <span className="text-amber-400/80">1</span>
                <span className="text-muted-foreground/40">,</span>
              </div>
              <div className="pl-3">
                <span className="text-blue-400/80">"name"</span>
                <span className="text-muted-foreground/40">: </span>
                <span className="text-emerald-400/80">"Alice"</span>
                <span className="text-muted-foreground/40">,</span>
              </div>
              <div className="pl-3">
                <span className="text-blue-400/80">"role"</span>
                <span className="text-muted-foreground/40">: </span>
                <span className="text-emerald-400/80">"admin"</span>
              </div>
              <div className="text-muted-foreground/40">{"}"}</div>
            </div>
            <div className="text-muted-foreground/50">{"]"}</div>
          </div>
        </div>
      </div>

      {/* Floating env badge */}
      <div className="absolute -top-3 -right-4 rounded-full border border-border bg-card px-3 py-1 text-xs font-mono shadow-xl">
        <span className="text-muted-foreground/60">env: </span>
        <span className="text-purple-400">staging</span>
      </div>

      {/* Floating status badge */}
      <div className="absolute -bottom-3 -left-4 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono shadow-xl">
        <span className="text-emerald-400">✓ </span>
        <span className="text-emerald-400/80">data stays in your browser</span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-20 pb-16"
    >
      {/* Aurora ambient bg — lazy, ssr:false */}
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
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: copy — static HTML, LCP-safe */}
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

            <BlurText
              as="p"
              text="Build, test, and inspect HTTP APIs entirely in your browser tab — fast, private, and zero setup."
              className="max-w-prose text-lg leading-relaxed text-muted-foreground"
            />

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ClickSpark color="var(--method-get)" count={10}>
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Try it now
                  <span aria-hidden="true">→</span>
                </Link>
              </ClickSpark>

              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Right: real product visual */}
          <div className="w-full px-4 lg:px-0">
            <ProductVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
