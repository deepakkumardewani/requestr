import Link from "next/link";
import { AnimatedContent } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import {
  COMMAND_PALETTE_EYEBROW,
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
} from "../constants";
import { DemoVideo } from "../DemoVideo";
import {
  COMMAND_PALETTE_HEADLINE,
  COMMAND_PALETTE_KEYS,
  COMMAND_PALETTE_KEYS_NOTE,
  COMMAND_PALETTE_LEDE,
  COMMAND_PALETTE_LINK_LABEL,
  COMMAND_PALETTE_MEDIA,
  COMMAND_PALETTE_POINTS,
} from "../data/copy";
import { COMMAND_PALETTE_FEATURE_PATH, SECTION_IDS } from "../data/links";
import { SectionHeader } from "../SectionHeader";

const TITLE_ID = "command-palette-title";
const VIDEO_DELAY_S = 0.1;
const KEYCAP_CLASS =
  "inline-flex min-w-11 items-center justify-center rounded-lg border border-border border-b-[3px] bg-card px-3 py-2 font-mono text-lg font-semibold text-foreground shadow-[0_0_24px_-6px_var(--landing-accent)]";

function Shortcut() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="flex items-center gap-1.5">
        {COMMAND_PALETTE_KEYS.mac.map((key) => (
          <kbd key={key} className={KEYCAP_CLASS}>
            {key}
          </kbd>
        ))}
      </span>
      <span className="font-mono text-xs text-muted-foreground">
        {COMMAND_PALETTE_KEYS_NOTE}
      </span>
    </p>
  );
}

function Points() {
  return (
    <dl className="grid gap-6 sm:grid-cols-3 sm:gap-8">
      {COMMAND_PALETTE_POINTS.map((point) => (
        <div key={point.id} className="border-l border-border pl-5">
          <dt className="font-display text-sm font-semibold text-foreground">
            {point.title}
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {point.body}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CommandPalette() {
  return (
    <section
      id={SECTION_IDS.commandPalette}
      aria-labelledby={TITLE_ID}
      className={cn("scroll-mt-20", SECTION_DIVIDER, SECTION_PADDING)}
    >
      <div className={SECTION_CONTAINER}>
        <div className="flex flex-col items-start gap-7">
          <SectionHeader
            titleId={TITLE_ID}
            eyebrow={COMMAND_PALETTE_EYEBROW}
            title={COMMAND_PALETTE_HEADLINE}
            lede={COMMAND_PALETTE_LEDE}
            className="mb-0"
          />
          <Shortcut />
        </div>
        <AnimatedContent delay={VIDEO_DELAY_S} className="relative mt-10">
          <div
            aria-hidden="true"
            className="absolute -inset-4 -z-10 rounded-[2rem] bg-[radial-gradient(closest-side,rgb(52_211_153/0.12),transparent)] blur-2xl"
          />
          <DemoVideo
            src={COMMAND_PALETTE_MEDIA.src}
            poster={COMMAND_PALETTE_MEDIA.poster}
            alt={COMMAND_PALETTE_MEDIA.alt}
            width={COMMAND_PALETTE_MEDIA.width}
            height={COMMAND_PALETTE_MEDIA.height}
            className="rounded-xl border border-border shadow-2xl"
          />
        </AnimatedContent>
        <div className="mt-10 space-y-8">
          <Points />
          <Link
            href={COMMAND_PALETTE_FEATURE_PATH}
            className="inline-block rounded font-mono text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {COMMAND_PALETTE_LINK_LABEL} →
          </Link>
        </div>
      </div>
    </section>
  );
}
