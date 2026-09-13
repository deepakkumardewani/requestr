"use client";

const CHAIN_NODES = [
  { label: "Login", method: "POST", color: "var(--method-post)" },
  { label: "Get user", method: "GET", color: "var(--method-get)" },
  { label: "Delete session", method: "DELETE", color: "var(--method-delete)" },
] as const;

const CHAIN_EDGE_LABEL = "$.token → Authorization";
const CHAIN_METHOD_COLUMN_WIDTH = "w-14";
const CHAIN_NODE_MIN_HEIGHT = "min-h-[52px]";

function ChainConnector() {
  return (
    <div className="flex items-center gap-2 py-2 pl-[calc(1.75rem+0.75rem)]">
      <svg
        aria-hidden="true"
        viewBox="0 0 12 20"
        className="h-5 w-3 shrink-0 text-muted-foreground/50"
      >
        <line
          x1="6"
          y1="0"
          x2="6"
          y2="14"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M2 12l4 5 4-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground/70">
        {CHAIN_EDGE_LABEL}
      </span>
    </div>
  );
}

export function ChainVisual() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col">
        {CHAIN_NODES.map((node, i) => (
          <div key={node.label}>
            <div
              className={`flex ${CHAIN_NODE_MIN_HEIGHT} items-center gap-3 rounded-lg border border-border/70 bg-background/40 px-4`}
            >
              <span
                className={`${CHAIN_METHOD_COLUMN_WIDTH} shrink-0 font-mono text-[10px] font-semibold tracking-wider`}
                style={{ color: node.color }}
              >
                {node.method}
              </span>
              <span className="text-sm font-medium text-foreground">
                {node.label}
              </span>
            </div>
            {i < CHAIN_NODES.length - 1 && <ChainConnector />}
          </div>
        ))}
      </div>
    </div>
  );
}
