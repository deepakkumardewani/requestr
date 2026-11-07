"use client";

import Link from "next/link";
import { useRef } from "react";
import { SECTION_CONTAINER } from "@/components/landing/constants";
import { ProductVisual } from "@/components/landing/ProductVisual";
import { cn } from "@/lib/utils";
import { useHeroMotion } from "../useHeroMotion";
import { useScrollChoreography } from "./useScrollChoreography";

interface HeroStage {
  id: string;
  title: string;
  caption: string;
  lines: string[];
}

const STAGES: HeroStage[] = [
  {
    id: "request",
    title: "Send",
    caption: "Write a request and send it from a browser tab.",
    lines: [],
  },
  {
    id: "response",
    title: "Read",
    caption: "Status, timing and a formatted body, instantly.",
    lines: ["200 OK · 142 ms", '{ "id": 1, "name": "Leanne Graham" }'],
  },
  {
    id: "chain",
    title: "Chain",
    caption: "Feed one response into the next request.",
    lines: [
      "1  POST /login → token",
      "2  GET /me  (uses token)",
      "3  GET /me/orders",
    ],
  },
  {
    id: "relay",
    title: "Relay",
    caption: "Ask for a test in plain words.",
    lines: ["Relay  add a test that status is 200", "✓ passed  status is 200"],
  },
];

/** Track height in viewports; each stage gets roughly one viewport of scroll. */
const TRACK_CLASS = "h-[400dvh]";

function StageBody({ stage }: { stage: HeroStage }) {
  if (stage.id === "request") return <ProductVisual />;
  return (
    <div className="rounded-xl border border-border bg-card p-4 font-mono text-sm shadow-2xl sm:p-6">
      {stage.lines.map((line) => (
        <p key={line} className="py-0.5 text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

function StagePanel({ stage }: { stage: HeroStage }) {
  return (
    <div className="grid w-full grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-12">
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {stage.title}
        </h2>
        <p className="text-base text-muted-foreground sm:text-lg">
          {stage.caption}
        </p>
      </div>
      <div className="min-w-0">
        <StageBody stage={stage} />
      </div>
    </div>
  );
}

function Intro() {
  return (
    <section
      className={cn(
        "flex min-h-[85dvh] flex-col justify-center py-16",
        SECTION_CONTAINER,
      )}
    >
      <div className="max-w-2xl space-y-5">
        <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
          From request to test, in one scroll.
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Send, read, chain, and let Relay write the assertions.
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

/** Reduced motion: every stage stacked and visible, nothing pinned or scrubbed. */
function StaticSequence() {
  return (
    <div className={cn("space-y-12 pb-16", SECTION_CONTAINER)}>
      {STAGES.map((stage) => (
        <StagePanel key={stage.id} stage={stage} />
      ))}
    </div>
  );
}

function PinnedSequence() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { stage, progress } = useScrollChoreography({
    trackRef,
    stageCount: STAGES.length,
    enabled: true,
  });

  return (
    <div ref={trackRef} className={TRACK_CLASS} data-testid="hero-b-track">
      <div
        className={cn(
          "sticky top-0 flex h-dvh flex-col justify-center gap-6",
          SECTION_CONTAINER,
        )}
      >
        <div
          role="progressbar"
          aria-label="Sequence progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-1 w-full overflow-hidden rounded bg-border"
        >
          <div
            className="h-full bg-[var(--landing-accent)]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div key={STAGES[stage].id} data-testid="hero-b-stage">
          <StagePanel stage={STAGES[stage]} />
        </div>
      </div>
    </div>
  );
}

/** Scripted request → response → chain → Relay sequence, scroll-choreographed. */
export function CinematicHero() {
  const { reduced } = useHeroMotion();
  return (
    <main>
      <Intro />
      {reduced ? <StaticSequence /> : <PinnedSequence />}
    </main>
  );
}
