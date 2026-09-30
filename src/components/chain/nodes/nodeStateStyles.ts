import { CheckCircle, Circle, Loader2, XCircle } from "lucide-react";
import { createElement } from "react";
import type { ChainNodeState } from "@/types/chain";

/** Default icon size class for `StateIcon`; `DisplayNode` overrides with a smaller size. */
const DEFAULT_ICON_SIZE = "h-4 w-4";

export const STATE_BORDER: Record<ChainNodeState, string> = {
  idle: "border-border",
  running: "border-blue-500 animate-pulse motion-reduce:animate-none",
  passed: "border-emerald-500",
  failed: "border-red-500",
  skipped: "border-zinc-500",
  aborted: "border-orange-500",
};

export const STATE_BG: Record<ChainNodeState, string> = {
  idle: "bg-card",
  running: "bg-blue-500/10 dark:bg-blue-950/30",
  passed: "bg-emerald-500/10 dark:bg-emerald-950/30",
  failed: "bg-red-500/10 dark:bg-red-950/30",
  skipped: "bg-muted/60 dark:bg-zinc-900/30",
  aborted: "bg-orange-500/10 dark:bg-orange-950/30",
};

type StateIconProps = {
  state: ChainNodeState;
  /** Tailwind size classes, e.g. "h-4 w-4". Defaults to the size used by API/Delay/Condition nodes. */
  size?: string;
};

/** Shared run-state icon for every chain node type. */
export function StateIcon({ state, size = DEFAULT_ICON_SIZE }: StateIconProps) {
  switch (state) {
    case "running":
      return createElement(Loader2, {
        className: `${size} animate-spin motion-reduce:animate-none text-blue-600 dark:text-blue-400`,
        "aria-hidden": true,
      });
    case "passed":
      return createElement(CheckCircle, {
        className: `${size} text-emerald-600 dark:text-emerald-400`,
        "aria-hidden": true,
      });
    case "failed":
      return createElement(XCircle, {
        className: `${size} text-red-600 dark:text-red-400`,
        "aria-hidden": true,
      });
    case "aborted":
      return createElement(XCircle, {
        className: `${size} text-orange-600 dark:text-orange-400`,
        "aria-hidden": true,
      });
    case "skipped":
      return createElement(Circle, {
        className: `${size} text-muted-foreground`,
        "aria-hidden": true,
      });
    default:
      return createElement(
        "span",
        {
          className: `${size} text-muted-foreground text-xs`,
          "aria-hidden": true,
        },
        "–",
      );
  }
}
