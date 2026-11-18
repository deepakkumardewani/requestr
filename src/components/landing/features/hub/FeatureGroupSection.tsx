import { cn } from "@/lib/utils";
import { SECTION_CONTAINER, SECTION_DIVIDER } from "../../constants";
import { FeaturesGrid } from "../FeaturesGrid";
import { type FeatureGroup, groupHeadingId } from "./hubModel";

function countLabel(count: number): string {
  return count === 1 ? "1 feature" : `${count} features`;
}

/** One theme: a sticky label column beside its bento grid. */
export function FeatureGroupSection({
  group,
  index,
}: {
  group: FeatureGroup;
  index: number;
}) {
  const headingId = groupHeadingId(group.category);
  return (
    <section
      aria-labelledby={headingId}
      className={cn("py-12 sm:py-16", index > 0 && SECTION_DIVIDER)}
    >
      <div
        className={cn(
          SECTION_CONTAINER,
          "grid gap-6 lg:grid-cols-[13rem_1fr] lg:gap-12",
        )}
      >
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="font-mono text-xs text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </p>
          <h2
            id={headingId}
            className="mt-1 scroll-mt-28 font-display text-2xl font-semibold tracking-tight text-foreground"
          >
            {group.category}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {countLabel(group.features.length)}
          </p>
        </div>
        <FeaturesGrid features={group.features} />
      </div>
    </section>
  );
}
