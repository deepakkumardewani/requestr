import { cn } from "@/lib/utils";
import { PREVIEW_BLINK, PREVIEW_FRAME, PREVIEW_PANEL } from "./previewStyles";

const QUERY = "trans";
const RESULTS = ["Transform Playground", "Transform response"] as const;

export function PalettePreview() {
  return (
    <div className={PREVIEW_FRAME}>
      <p
        className={cn(
          PREVIEW_PANEL,
          "flex items-center gap-1.5 text-foreground/90",
        )}
      >
        <span className="text-muted-foreground">⌘K</span>
        {QUERY}
        <span
          aria-hidden="true"
          className={cn(PREVIEW_BLINK, "h-3 w-px bg-foreground")}
        />
      </p>
      {RESULTS.map((result, index) => (
        <p
          key={result}
          className={cn(
            "rounded px-2 py-0.5",
            index === 0
              ? "bg-[var(--landing-accent)]/15 text-foreground"
              : "text-muted-foreground",
          )}
        >
          {result}
        </p>
      ))}
    </div>
  );
}
