"use client";

import Link from "next/link";
import { MiniRequestr } from "@/components/hero-lab/a/MiniRequestr";
import { RelayLine } from "@/components/hero-lab/a/RelayLine";
import { useLiveRequest } from "@/components/hero-lab/a/useLiveRequest";
import { HERO_DEMO_URL } from "@/components/hero-lab/fallbackResponse";
import { SECTION_CONTAINER } from "@/components/landing/constants";
import { cn } from "@/lib/utils";

export default function HeroConceptAPage() {
  const request = useLiveRequest();

  return (
    <main className="flex min-h-dvh flex-col justify-center py-12">
      <div className={cn("w-full space-y-8", SECTION_CONTAINER)}>
        <div className="max-w-2xl space-y-4">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Send a request. Right here.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            This is a real request through the same proxy the app uses. Press
            Send.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open the app →
          </Link>
        </div>
        <div className="max-w-2xl">
          <MiniRequestr
            url={HERO_DEMO_URL}
            loading={request.loading}
            response={request.response}
            source={request.source}
            onSend={request.send}
          >
            <RelayLine responseStatus={request.response?.status ?? null} />
          </MiniRequestr>
        </div>
      </div>
    </main>
  );
}
