import { cn } from "@/lib/utils";
import {
  PREVIEW_FRAME,
  PREVIEW_PANEL,
  PREVIEW_RISE,
  staggerStyle,
} from "./previewStyles";

const TEMPLATE = "{{baseUrl}}/users";
const RESOLVED = [
  { env: "local", url: "localhost:4000/users" },
  { env: "staging", url: "staging.api.example.com/users" },
  { env: "prod", url: "api.example.com/users" },
] as const;

export function EnvironmentsPreview() {
  return (
    <div className={PREVIEW_FRAME}>
      <p className={cn(PREVIEW_PANEL, "text-[var(--method-post)]")}>
        {TEMPLATE}
      </p>
      {RESOLVED.map((line, index) => (
        <p
          key={line.env}
          className={cn(PREVIEW_RISE, "truncate text-muted-foreground")}
          style={staggerStyle(index + 1)}
        >
          <span className="inline-block w-12 text-foreground/80">
            {line.env}
          </span>
          {line.url}
        </p>
      ))}
    </div>
  );
}
