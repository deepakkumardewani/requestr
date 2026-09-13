export function TransformPreview() {
  return (
    <div className="flex h-full w-full items-center gap-2 px-3 font-mono text-[9px] leading-tight">
      <div className="flex-1 rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-muted-foreground">
        <span className="text-[var(--landing-accent,var(--method-get))]">
          $
        </span>
        .users[*].name
      </div>
      <svg
        viewBox="0 0 24 12"
        className="h-3 w-6 shrink-0 text-muted-foreground/50"
        aria-hidden
      >
        <title>Transform result</title>
        <line
          x1="0"
          y1="6"
          x2="18"
          y2="6"
          stroke="currentColor"
          strokeWidth="1.5"
          className="motion-safe:animate-[dash-pulse_2s_ease-in-out_infinite]"
        />
        <path
          d="M14 2 L20 6 L14 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex-1 space-y-1 rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-foreground/80">
        <div>"Ada"</div>
        <div>"Grace"</div>
      </div>
      <style>{`
        @keyframes dash-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
