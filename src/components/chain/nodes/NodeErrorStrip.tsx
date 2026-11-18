import { cn } from "@/lib/utils";
import type { ChainNodeState } from "@/types/chain";

type NodeErrorStripProps = {
  state: ChainNodeState;
  error?: string;
  /**
   * "inline" flows below the node content (Start/Delay/Condition/Display/Chain nodes).
   * "absolute" pins to the bottom edge, outside the card (Merge/Validate/SubChain/
   * Evaluate/Collect/Loop nodes, which have no spare vertical room for an inline strip).
   */
  variant?: "inline" | "absolute";
  className?: string;
};

/** Shared failed-state error message strip for every chain node type. Renders nothing unless `state` is "failed" with a non-empty `error`. */
export function NodeErrorStrip({
  state,
  error,
  variant = "inline",
  className,
}: NodeErrorStripProps) {
  if (state !== "failed" || !error) return null;

  return (
    <p
      title={error}
      className={cn(
        "text-[10px] text-red-400 leading-tight",
        variant === "inline"
          ? "mt-1"
          : "absolute -bottom-5 left-0 right-0 truncate",
        className,
      )}
    >
      {error}
    </p>
  );
}
