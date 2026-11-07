import { SECTION_CONTAINER, SECTION_DIVIDER } from "./constants";
import { formatCheckedMonth } from "./data/comparison";
import { SPEED_PROOF } from "./data/speedProof";

const { lcp, firstLoadJs, ttfr, downloads } = SPEED_PROOF.stats;

// The downloads value already reads "0 downloads", so its label says what it gates
const DOWNLOADS_LABEL = "Needed to start";

const STATS = [
  lcp,
  firstLoadJs,
  ttfr,
  { ...downloads, label: DOWNLOADS_LABEL },
].map((stat) => ({
  label: stat.label,
  value: `${stat.value} ${stat.unit}`,
}));

/** Measured Requestr numbers only; deliberately static (no count-up) and never compared */
export function ComparisonStatStrip() {
  return (
    <section
      aria-label="Measured Requestr speed"
      className={`${SECTION_DIVIDER} py-10`}
    >
      <div className={SECTION_CONTAINER}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col-reverse rounded-xl border border-border bg-card p-4"
            >
              <dt className="mt-1 text-xs text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="font-display text-xl font-semibold text-compare-accent sm:text-2xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Measured {formatCheckedMonth(SPEED_PROOF.measuredOn)}, production
          build, {SPEED_PROOF.environment.page}. Load metrics use mobile
          emulation; time to first request is measured on desktop.
        </p>
      </div>
    </section>
  );
}
