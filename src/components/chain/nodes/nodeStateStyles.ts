import { CheckCircle, Circle, Loader2, XCircle } from "lucide-react";
import { createElement } from "react";
import { cn } from "@/lib/utils";
import type { ChainNodeState } from "@/types/chain";

/** `chain` i18n keys that name a node's run state in accessible labels. */
export const NODE_RUN_STATE_LABEL_KEYS = {
  idle: "nodeRunStateIdle",
  running: "nodeRunStateRunning",
  passed: "nodeRunStatePassed",
  failed: "nodeRunStateFailed",
  skipped: "nodeRunStateSkipped",
  aborted: "nodeRunStateAborted",
} as const satisfies Record<ChainNodeState, string>;

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

/** Connection-handle styling shared by every node; overridden only for semantic (success/fail/output) handles. */
export const NODE_HANDLE_CLASS = "!h-3 !w-3 !border-2 !border-border !bg-muted";

export const NODE_CARD_BASE =
  "relative rounded-lg border-2 shadow-lg transition-[color,box-shadow,filter,border-color] duration-200";

/** Extra affordances for cards that are themselves a button (request and Display nodes). */
export const NODE_CARD_INTERACTIVE =
  "cursor-pointer hover:brightness-110 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const NODE_FOCUS_RING = "ring-2 ring-ring ring-offset-2 ring-offset-background";

type NodeCardClassOptions = {
  state: ChainNodeState;
  isKeyboardFocused?: boolean;
  className?: string;
};

/** Card chrome (border, state tint, keyboard ring) — the single place node cards are styled. */
export function nodeCardClass({
  state,
  isKeyboardFocused,
  className,
}: NodeCardClassOptions): string {
  return cn(
    NODE_CARD_BASE,
    STATE_BORDER[state],
    STATE_BG[state],
    isKeyboardFocused && NODE_FOCUS_RING,
    className,
  );
}

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
