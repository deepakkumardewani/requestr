const LEFT_LINES = [
  '"id": 42,',
  '"status": "ok",',
  '"role": "admin",',
  '"active": true',
];
const RIGHT_LINES = [
  '"id": 42,',
  '"status": "error",',
  '"role": "admin",',
  '"active": true',
];

export function ComparePreview() {
  return (
    <div className="flex h-full w-full items-center gap-2 px-3 font-mono text-[9px] leading-relaxed">
      <div className="flex-1 rounded-md border border-border/60 bg-background/60 px-2 py-1.5">
        {LEFT_LINES.map((line, i) => (
          <div
            key={line}
            className={
              i === 1
                ? "text-[var(--method-delete)]"
                : "text-muted-foreground/50"
            }
          >
            {line}
          </div>
        ))}
      </div>
      <div className="flex-1 rounded-md border border-border/60 bg-background/60 px-2 py-1.5">
        {RIGHT_LINES.map((line, i) => (
          <div
            key={line}
            className={
              i === 1
                ? "text-[var(--landing-accent,var(--method-get))]"
                : "text-muted-foreground/50"
            }
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
