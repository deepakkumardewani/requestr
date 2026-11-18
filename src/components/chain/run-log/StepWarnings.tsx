import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AliasOwner, StepWarning } from "@/lib/chainRunHistory";

type Translate = ReturnType<typeof useTranslations<"chain">>;

const OWNER_LABEL_KEY = {
  edge: "stepWarningOwnerEdge",
  display: "stepWarningOwnerDisplay",
  evaluate: "stepWarningOwnerEvaluate",
} as const satisfies Record<AliasOwner["kind"], string>;

/** Exhaustive over `StepWarning["kind"]`: a new kind fails to compile until it has a message. */
function warningMessage(warning: StepWarning, t: Translate): string {
  switch (warning.kind) {
    case "alias-collision":
      return t("stepWarningAliasCollision", {
        alias: warning.alias,
        previousOwner: t(OWNER_LABEL_KEY[warning.previousOwner.kind]),
      });
    case "loop-truncated":
      return t("stepWarningLoopTruncated", {
        executed: warning.executed,
        total: warning.total,
      });
    case "loop-iterations-failed":
      return t("stepWarningLoopIterationsFailed", {
        failed: warning.failed,
        total: warning.total,
      });
    default: {
      const unhandled: never = warning;
      return unhandled;
    }
  }
}

/** Distinguishes warnings of the same kind within one step. */
function warningKey(warning: StepWarning): string {
  if (warning.kind === "alias-collision") {
    return `${warning.kind}|${warning.alias}|${warning.previousOwner.id}|${warning.owner.id}`;
  }
  return warning.kind;
}

type StepWarningsProps = {
  warnings?: StepWarning[];
};

/** Non-fatal conditions a step raised while running, shown above its tabs. */
export function StepWarnings({ warnings }: StepWarningsProps) {
  const t = useTranslations("chain");
  if (!warnings?.length) return null;

  return (
    <div
      role="alert"
      className="flex shrink-0 gap-2 border-b border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <ul className="min-w-0">
        <li className="sr-only">{t("stepWarningsTitle")}</li>
        {warnings.map((warning) => (
          <li key={warningKey(warning)}>{warningMessage(warning, t)}</li>
        ))}
      </ul>
    </div>
  );
}
