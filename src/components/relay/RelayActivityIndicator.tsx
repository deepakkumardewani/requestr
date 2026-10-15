import { useTranslations } from "next-intl";
import type { RelayActivity } from "@/lib/relay/activity";
import { ACTIVITY_THINKING_KEY, stepLabelFor } from "@/lib/relay/stepLabels";

/**
 * Sweeps a highlight across the text. Every animated class is `motion-safe:`,
 * so reduced motion leaves plain muted text (FR-104).
 */
const SHIMMER_CLASS =
  "motion-safe:animate-[shine_2s_linear_infinite] motion-safe:bg-[linear-gradient(110deg,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%)] motion-safe:bg-[length:200%_100%] motion-safe:bg-clip-text motion-safe:text-transparent";
const DOT_CLASS =
  "size-1.5 shrink-0 rounded-full bg-muted-foreground motion-safe:animate-pulse";

/** The live "what is Relay doing" line: a shimmering Thinking, or the current tool step. */
export function RelayActivityIndicator({
  activity,
}: {
  activity: RelayActivity;
}) {
  const t = useTranslations("relay");
  const thinking = activity.kind === "thinking";
  const label = thinking
    ? { key: ACTIVITY_THINKING_KEY, params: {} }
    : stepLabelFor(activity.toolName, activity.input);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="relay-activity"
      data-kind={activity.kind}
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <span
        aria-hidden
        data-testid="relay-activity-dot"
        className={DOT_CLASS}
      />
      <span
        data-testid="relay-activity-label"
        className={thinking ? SHIMMER_CLASS : undefined}
      >
        {t(label.key, label.params)}
      </span>
    </div>
  );
}
