"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatedContent, BlurText } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import { SECTION_EYEBROW, SECTION_HEADING } from "./constants";
import { FEATURES, type Feature } from "./data/features";
import { COMPARE_PAGES } from "./data/seoPages";
import { Footer } from "./Footer";
import { FeaturesGrid } from "./features/FeaturesGrid";
import { LINK_INTERACTIVE } from "./interactionStyles";
import { Nav } from "./Nav";

const COMPARE_HEADING = "Compare Requestr";
const DEFAULT_CATEGORY = "More";

interface FeatureGroup {
  category: string;
  features: Feature[];
}

/** Groups keep their first-seen order, so a group never mixes the grid layouts of two sections. */
function groupByCategory(features: readonly Feature[]): FeatureGroup[] {
  const groups = new Map<string, Feature[]>();
  for (const feature of features) {
    const category = feature.category ?? DEFAULT_CATEGORY;
    groups.set(category, [...(groups.get(category) ?? []), feature]);
  }
  return [...groups].map(([category, items]) => ({
    category,
    features: items,
  }));
}

/** Category names contain spaces, which are invalid in an id, so slugify them. */
function groupHeadingId(category: string): string {
  const slug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `group-${slug}`;
}

const FEATURE_GROUPS = groupByCategory(FEATURES);

export function AllFeaturesPage() {
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Nav />
      <main id="app-main" className="overflow-x-hidden pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedContent direction="up">
            <div className="mb-10 max-w-2xl">
              <p className={SECTION_EYEBROW}>Features</p>
              <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                <BlurText
                  text="Every tool included."
                  as="span"
                  duration={0.45}
                />{" "}
                <BlurText
                  text="No install required."
                  as="span"
                  className="text-muted-foreground"
                  duration={0.45}
                  delay={0.12}
                />
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Everything from JSON transforms to request chains, in one
                browser tab. No account needed.
              </p>
            </div>
          </AnimatedContent>

          <AnimatedContent direction="up" delay={0.1}>
            <div className="space-y-12">
              {FEATURE_GROUPS.map(({ category, features }) => (
                <section
                  key={category}
                  aria-labelledby={groupHeadingId(category)}
                >
                  <h2
                    id={groupHeadingId(category)}
                    className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {category}
                  </h2>
                  <FeaturesGrid features={features} />
                </section>
              ))}
              <section aria-labelledby="compare-heading">
                <h2 id="compare-heading" className={SECTION_HEADING}>
                  {COMPARE_HEADING}
                </h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                  {COMPARE_PAGES.map((page) => (
                    <li key={page.slug}>
                      <Link
                        href={page.route}
                        className={cn(
                          LINK_INTERACTIVE,
                          "block h-full rounded-2xl border border-border/60 bg-card p-4 hover:border-border",
                        )}
                      >
                        <span className="font-display text-lg font-semibold text-foreground">
                          {page.h1}
                        </span>
                        <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">
                          {page.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </AnimatedContent>
        </div>
      </main>
      <Footer />
    </>
  );
}
