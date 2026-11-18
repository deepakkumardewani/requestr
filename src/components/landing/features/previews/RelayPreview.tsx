import { cn } from "@/lib/utils";
import {
  PREVIEW_FRAME,
  PREVIEW_PANEL,
  PREVIEW_RISE,
  staggerStyle,
} from "./previewStyles";

const PROMPT = "Why does Get user return 401?";
const ACTIONS = [
  "read request · Get user",
  "send_request → 401",
  "fix: add Bearer {{token}}",
] as const;

export function RelayPreview() {
  return (
    <div className={PREVIEW_FRAME}>
      <p className={cn(PREVIEW_PANEL, "ml-auto w-fit text-foreground/90")}>
        {PROMPT}
      </p>
      {ACTIONS.map((action, index) => (
        <p
          key={action}
          className={cn(PREVIEW_RISE, "text-muted-foreground")}
          style={staggerStyle(index + 1)}
        >
          <span className="text-[var(--landing-accent)]">✓ </span>
          {action}
        </p>
      ))}
    </div>
  );
}
