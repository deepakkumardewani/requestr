import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_HEADING,
} from "../../constants";
import { COMPARE_PAGES } from "../../data/seoPages";
import { SpotlightCard } from "../../SpotlightCard";

const COMPARE_HEADING = "Compare Requestr";
const COMPARE_HEADING_ID = "compare-heading";

/** Side-by-side pages for people weighing Requestr against the tool they use today. */
export function CompareLinks() {
  return (
    <section
      aria-labelledby={COMPARE_HEADING_ID}
      className={cn("py-16 sm:py-24", SECTION_DIVIDER)}
    >
      <div className={SECTION_CONTAINER}>
        <h2 id={COMPARE_HEADING_ID} className={SECTION_HEADING}>
          {COMPARE_HEADING}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {COMPARE_PAGES.map((page) => (
            <li key={page.slug}>
              <Link
                href={page.route}
                className="group/card block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SpotlightCard className="h-full">
                  <div className="flex h-full flex-col p-5">
                    <span className="flex items-center justify-between gap-3 font-display text-lg font-semibold text-foreground">
                      {page.h1}
                      <ArrowRightIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover/card:translate-x-0.5"
                      />
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">
                      {page.description}
                    </span>
                  </div>
                </SpotlightCard>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
