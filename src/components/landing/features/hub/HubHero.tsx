import { cn } from "@/lib/utils";
import { GridBackdrop } from "../../background/GridBackdrop";
import { SECTION_CONTAINER } from "../../constants";
import { TOTAL_TOOL_COUNT } from "../../data/capabilities";
import { FEATURE_PAGES } from "../../data/seoPages";
import { LINK_INTERACTIVE } from "../../interactionStyles";
import { PrimaryCta } from "../../PrimaryCta";
import { type FeatureGroup, groupHeadingId } from "./hubModel";

const EYEBROW = "Features";
const HEADLINE_LEAD = "Every tool included. ";
const HEADLINE_HIGHLIGHT = "No install required.";
const LEDE =
  "From JSON transforms to request chains, everything runs in one browser tab. No account, and your data stays on your device.";
const JUMP_LABEL = "Feature categories";

interface HubHeroProps {
  groups: readonly FeatureGroup[];
  featureCount: number;
}

function heroStats(featureCount: number) {
  return [
    { value: featureCount, label: "features" },
    { value: FEATURE_PAGES.length, label: "in-depth guides" },
    { value: TOTAL_TOOL_COUNT, label: "Relay tools" },
  ] as const;
}

function CategoryJumps({ groups }: { groups: readonly FeatureGroup[] }) {
  return (
    <nav aria-label={JUMP_LABEL} className="mt-10">
      <ul className="flex flex-wrap gap-2">
        {groups.map(({ category, features }) => (
          <li key={category}>
            <a
              href={`#${groupHeadingId(category)}`}
              className={cn(
                LINK_INTERACTIVE,
                "inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-sm text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {category}
              <span className="font-mono text-xs text-muted-foreground">
                {features.length}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The hub's promise, real counts and a way to jump straight to a theme. */
export function HubHero({ groups, featureCount }: HubHeroProps) {
  return (
    <section className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
      <GridBackdrop glow />
      <div className={SECTION_CONTAINER}>
        <div className="max-w-3xl">
          <p className="font-mono text-sm text-[var(--landing-accent)]">
            {EYEBROW}
          </p>
          <h1 className="mt-3 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {HEADLINE_LEAD}
            <span className="bg-gradient-to-r from-foreground/70 via-[var(--landing-accent)] to-foreground/70 bg-clip-text text-transparent">
              {HEADLINE_HIGHLIGHT}
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {LEDE}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <PrimaryCta size="lg" />
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {heroStats(featureCount).map((stat) => (
                <li
                  key={stat.label}
                  className="flex items-baseline gap-1.5 text-sm text-muted-foreground"
                >
                  <span className="font-display text-xl font-semibold text-foreground">
                    {stat.value}
                  </span>
                  {stat.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <CategoryJumps groups={groups} />
      </div>
    </section>
  );
}
