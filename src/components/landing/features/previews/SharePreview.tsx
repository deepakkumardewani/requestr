import { Link2, Lock } from "lucide-react";

const FIELDS = [
  { label: "Method", value: "POST" },
  { label: "Headers", value: "2 sent" },
] as const;

export function SharePreview() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2.5 px-3">
      <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 font-mono text-[9px] text-muted-foreground">
        <Lock
          className="h-3 w-3 shrink-0 text-[var(--landing-accent,var(--method-get))]"
          aria-hidden
        />
        requestr.dev/s/4f9…#key
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1.5">
        <Link2
          className="h-3 w-3 shrink-0 text-muted-foreground/60"
          aria-hidden
        />
        <div className="flex flex-1 items-center justify-between gap-2 font-mono text-[9px] text-muted-foreground/70">
          {FIELDS.map((field) => (
            <span key={field.label}>
              {field.label}:{" "}
              <span className="text-foreground/70">{field.value}</span>
            </span>
          ))}
        </div>
      </div>
      <span className="text-[9px] text-muted-foreground/60">
        expires in 24h · no account needed
      </span>
    </div>
  );
}
