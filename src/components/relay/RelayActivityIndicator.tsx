import { useTranslations } from "next-intl";
import type { RelayActivity } from "@/lib/relay/activity";
import { stepLabelFor } from "@/lib/relay/stepLabels";
import { WorkingHeader } from "./WorkingHeader";

/** The live "what is Relay doing" block: the Working header, then the current tool step beneath it. */
export function RelayActivityIndicator({
  activity,
}: {
  activity: RelayActivity | null;
}) {
  const t = useTranslations("relay");
  const step =
    activity?.kind === "tool"
      ? stepLabelFor(activity.toolName, activity.input)
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="relay-activity"
      data-kind={activity?.kind ?? "waiting"}
      className="flex flex-col gap-1"
    >
      <WorkingHeader />
      {step ? (
        <p
          data-testid="relay-activity-label"
          className="pl-3.5 text-xs text-muted-foreground"
        >
          {t(step.key, step.params)}
        </p>
      ) : null}
    </div>
  );
}
