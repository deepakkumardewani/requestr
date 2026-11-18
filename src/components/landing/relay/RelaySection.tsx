"use client";

import { PlayIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RELAY_EYEBROW,
  RELAY_FULL_SRC,
  RELAY_HEADLINE,
  RELAY_LEDE,
  RELAY_LOOP_SRC,
  RELAY_MEDIA_HEIGHT,
  RELAY_MEDIA_WIDTH,
  RELAY_POSTER_SRC,
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_HEADING,
  SECTION_LEDE,
  SECTION_PADDING,
} from "../constants";
import { DemoVideo } from "../DemoVideo";
import { BlurHeadline } from "./BlurHeadline";

// Separate chunk: the dialog and the full cut load only after a click.
const DemoModal = dynamic(() =>
  import("../DemoModal").then((m) => m.DemoModal),
);

const LOOP_ALT = "Relay editing requests in a collection inside the app";

export function RelaySection() {
  const [requested, setRequested] = useState(false);
  const [open, setOpen] = useState(false);

  function openDemo() {
    setRequested(true);
    setOpen(true);
  }

  return (
    <section
      id="relay"
      className={cn("scroll-mt-20", SECTION_DIVIDER, SECTION_PADDING)}
      aria-labelledby="relay-title"
    >
      <div className={SECTION_CONTAINER}>
        <div className="mx-auto mb-10 max-w-xl text-center">
          <p className={SECTION_EYEBROW}>{RELAY_EYEBROW}</p>
          <h2 id="relay-title" className={SECTION_HEADING}>
            <BlurHeadline text={RELAY_HEADLINE} />
          </h2>
          <p className={SECTION_LEDE}>{RELAY_LEDE}</p>
        </div>
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-xl border">
          <DemoVideo
            src={RELAY_LOOP_SRC}
            poster={RELAY_POSTER_SRC}
            alt={LOOP_ALT}
            width={RELAY_MEDIA_WIDTH}
            height={RELAY_MEDIA_HEIGHT}
          />
          <button
            type="button"
            onClick={openDemo}
            aria-label="Play the full demo"
            className="group absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg transition-transform duration-150 group-hover:scale-105 motion-reduce:transform-none">
              <PlayIcon aria-hidden="true" />
            </span>
          </button>
        </div>
        <div className="mt-6 flex justify-center">
          <Button type="button" variant="outline" onClick={openDemo}>
            <PlayIcon />
            Watch the demo
          </Button>
        </div>
      </div>
      {requested && (
        <DemoModal
          open={open}
          onOpenChange={setOpen}
          src={RELAY_FULL_SRC}
          poster={RELAY_POSTER_SRC}
        />
      )}
    </section>
  );
}
