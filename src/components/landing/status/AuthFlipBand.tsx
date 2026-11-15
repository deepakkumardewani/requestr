"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_HEADING,
  SECTION_LEDE,
} from "../constants";
import { AUTH_FLIP_HEADLINE, AUTH_FLIP_LEDE } from "../data/copy";
import { SECTION_IDS } from "../data/links";
import { RELAY_SESSIONS } from "../data/sessions";
import { ExtrudedCode } from "./ExtrudedCode";
import { STATUS_CLASS_COLOR, STATUS_PHRASES } from "./statusCodes";
import { useBlockMotion } from "./useBlockMotion";

const TITLE_ID = "auth-flip-title";
/** The hero session this band retells. */
const DEBUG_SESSION_ID = "debug";
const BEFORE = 401;
const AFTER = 200;

function debugPrompt(): string {
  const session = RELAY_SESSIONS.find((entry) => entry.id === DEBUG_SESSION_ID);
  if (!session) {
    throw new Error(
      `AuthFlipBand needs the "${DEBUG_SESSION_ID}" Relay session`,
    );
  }
  return session.prompt;
}

const FROM_FACE = {
  text: String(BEFORE),
  color: STATUS_CLASS_COLOR["client-error"],
  highlight: "rgb(254 243 199)",
};
const TO_FACE = {
  text: String(AFTER),
  color: STATUS_CLASS_COLOR.success,
  highlight: "rgb(209 250 229)",
};

/** Amber haze under the 401 that hands over to emerald as the block turns. */
function FlipGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
    >
      <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgb(251_191_36/0.16),transparent)] opacity-[calc(1-var(--flip,0))] blur-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgb(52_211_153/0.18),transparent)] opacity-[var(--flip,0)] blur-2xl" />
      <div className="absolute inset-x-[18%] bottom-2 h-6 rounded-[50%] bg-black/60 blur-xl" />
    </div>
  );
}

function StatusCaption() {
  return (
    <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
      <span className="text-[var(--method-put)]">
        {BEFORE} {STATUS_PHRASES[BEFORE]}
      </span>
      <span aria-hidden="true" className="mx-2 text-muted-foreground/50">
        →
      </span>
      <span className="sr-only"> then </span>
      <span className="text-[var(--method-get)]">
        {AFTER} {STATUS_PHRASES[AFTER]}
      </span>
    </p>
  );
}

/**
 * The page's one big status code: the hero's 401 question, retold as a solid
 * block that turns over to 200 as you scroll past it.
 */
export function AuthFlipBand() {
  const bandRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useBlockMotion(bandRef, stageRef);

  return (
    <section
      ref={bandRef}
      id={SECTION_IDS.authFlip}
      aria-labelledby={TITLE_ID}
      className={cn(
        "relative scroll-mt-20 overflow-hidden py-20 sm:py-28",
        SECTION_DIVIDER,
      )}
    >
      <div
        className={cn(
          "grid items-center gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16",
          SECTION_CONTAINER,
        )}
      >
        <div className="space-y-4">
          <p className="font-mono text-sm text-[var(--landing-accent)]">
            <span aria-hidden="true" className="text-muted-foreground/80">
              &gt;{" "}
            </span>
            {debugPrompt()}
          </p>
          <h2 id={TITLE_ID} className={SECTION_HEADING}>
            {AUTH_FLIP_HEADLINE}
          </h2>
          <p className={SECTION_LEDE}>{AUTH_FLIP_LEDE}</p>
        </div>
        {/* Carries the motion variables, so the glow and the block read the same angle. */}
        <div ref={stageRef} className="group/stage relative isolate">
          <FlipGlow />
          <ExtrudedCode from={FROM_FACE} to={TO_FACE} />
          <StatusCaption />
        </div>
      </div>
    </section>
  );
}
