const NODES = [
  { x: 20, y: 20 },
  { x: 60, y: 12 },
  { x: 100, y: 22 },
  { x: 35, y: 44 },
  { x: 80, y: 46 },
];

const EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [0, 3],
  [1, 4],
  [3, 4],
];

export function VisualizePreview() {
  return (
    <svg
      viewBox="0 0 120 60"
      className="h-full w-full px-3 text-muted-foreground/60"
      aria-hidden
    >
      <title>Connected request nodes</title>
      {EDGES.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke="currentColor"
          strokeWidth="0.75"
        />
      ))}
      {NODES.map((n, i) => (
        <circle
          key={`${n.x}-${n.y}`}
          cx={n.x}
          cy={n.y}
          r="3.5"
          fill={
            i === 0
              ? "var(--landing-accent, var(--method-get))"
              : "var(--method-post)"
          }
          className="motion-safe:animate-[node-float_3s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}
      <style>{`
        @keyframes node-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </svg>
  );
}
