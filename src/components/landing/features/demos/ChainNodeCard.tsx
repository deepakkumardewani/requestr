import { cn } from "@/lib/utils";
import type { NodeRunState } from "./chainRun";

export interface ChainNode {
  id: string;
  /** Block name as the chain canvas labels it. */
  block: string;
  title: string;
  detail?: string;
  result: string;
  output: string;
  /** The value the arrow out of this node passes on, if any. */
  link?: string;
}

const STATE_LABEL: Record<NodeRunState, string> = {
  idle: "waiting",
  running: "running",
  done: "done",
};

function StatusBadge({
  node,
  state,
}: {
  node: ChainNode;
  state: NodeRunState;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]",
        state === "done" &&
          "bg-[var(--method-get)]/15 text-[var(--method-get)]",
        state === "running" &&
          "animate-pulse bg-[var(--method-put)]/15 text-[var(--method-put)] motion-reduce:animate-none",
        state === "idle" && "text-muted-foreground",
      )}
    >
      {state === "done" ? node.result : STATE_LABEL[state]}
    </span>
  );
}

/** One block of the chain, with the arrow that carries its value onward. */
interface ChainNodeCardProps {
  node: ChainNode;
  state: NodeRunState;
  last: boolean;
}

export function ChainNodeCard({ node, state, last }: ChainNodeCardProps) {
  return (
    <li>
      <div
        className={cn(
          "rounded-lg border bg-card/60 px-3 py-2.5 transition-colors duration-300",
          state === "running"
            ? "border-[var(--method-put)]/50"
            : "border-border",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {node.block}
            </p>
            <p className="truncate font-mono text-sm text-foreground">
              {node.title}
            </p>
            {node.detail ? (
              <p className="truncate font-mono text-xs text-muted-foreground">
                {node.detail}
              </p>
            ) : null}
          </div>
          <StatusBadge node={node} state={state} />
        </div>
        <p
          aria-hidden={state !== "done"}
          className={cn(
            "mt-1.5 truncate font-mono text-xs text-[var(--method-get)]/90 transition-opacity duration-300",
            state === "done" ? "opacity-100" : "opacity-0",
          )}
        >
          {node.output}
        </p>
      </div>
      {node.link ? (
        <p className="ml-5 flex items-center gap-2 border-l border-dashed border-border py-2 pl-4 font-mono text-[11px] text-[var(--method-post)]">
          {node.link}
        </p>
      ) : last ? null : (
        <div
          aria-hidden="true"
          className="ml-5 h-4 border-l border-dashed border-border"
        />
      )}
    </li>
  );
}
