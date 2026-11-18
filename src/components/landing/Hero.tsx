import { AnimatedContent } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import { GridBackdrop } from "./background/GridBackdrop";
import { SECTION_CONTAINER } from "./constants";
import {
  HERO_EYEBROW,
  HERO_FACTS,
  HERO_HEADLINE_LEAD,
  HERO_HEADLINE_TAIL,
  HERO_SUBLINE,
} from "./data/copy";
import { SECTION_IDS } from "./data/links";
import { PrimaryCta } from "./PrimaryCta";
import { RelaySession } from "./session/RelaySession";
import { WatchDemoButton } from "./WatchDemoButton";

const SESSION_DELAY_S = 0.12;
/** Emerald haze behind the session card so it lifts off the grid. */
const SESSION_HALO =
  "absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(closest-side,rgb(52_211_153/0.14),transparent)] blur-2xl";

function HeroFacts() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
      {HERO_FACTS.map((fact) => (
        <li key={fact} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-1 rounded-full bg-[var(--landing-accent)]"
          />
          {fact}
        </li>
      ))}
    </ul>
  );
}

function HeroCopy() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <p className="font-mono text-sm text-[var(--landing-accent)]">
        {HERO_EYEBROW}
      </p>
      <h1 className="text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
        {HERO_HEADLINE_LEAD}
        <br />
        <span className="bg-gradient-to-r from-foreground/70 via-[var(--landing-accent)] to-foreground/70 bg-clip-text text-transparent">
          {HERO_HEADLINE_TAIL}
        </span>
      </h1>
      <p className="max-w-prose text-base leading-relaxed text-muted-foreground sm:text-lg">
        {HERO_SUBLINE}
      </p>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <PrimaryCta />
        <WatchDemoButton />
      </div>
      <HeroFacts />
    </div>
  );
}

export function Hero() {
  return (
    <section
      id={SECTION_IDS.hero}
      className="relative isolate flex min-h-[88dvh] flex-col justify-center pt-24 pb-16 sm:pt-28 sm:pb-20"
    >
      <GridBackdrop glow />
      <div className={cn("w-full", SECTION_CONTAINER)}>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <AnimatedContent direction="up">
            <HeroCopy />
          </AnimatedContent>
          <AnimatedContent
            direction="left"
            delay={SESSION_DELAY_S}
            className="relative w-full min-w-0"
          >
            <div aria-hidden="true" className={SESSION_HALO} />
            <RelaySession />
          </AnimatedContent>
        </div>
      </div>
    </section>
  );
}
