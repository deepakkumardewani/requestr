import { cn } from "@/lib/utils";
import {
  PREVIEW_FRAME,
  PREVIEW_PANEL,
  PREVIEW_RISE,
  staggerStyle,
} from "./previewStyles";

const FILE_NAME = "requestr-backup.json";
const SECTIONS = [
  { label: "collections", included: true },
  { label: "environments", included: true },
  { label: "secret values", included: false },
] as const;

export function BackupPreview() {
  return (
    <div className={PREVIEW_FRAME}>
      <p className={cn(PREVIEW_PANEL, "text-foreground/90")}>{FILE_NAME}</p>
      {SECTIONS.map((section, index) => (
        <p
          key={section.label}
          className={cn(PREVIEW_RISE, "text-muted-foreground")}
          style={staggerStyle(index + 1)}
        >
          <span
            className={
              section.included
                ? "text-[var(--method-get)]"
                : "text-muted-foreground"
            }
          >
            {section.included ? "✓ " : "– "}
          </span>
          {section.label}
          {section.included ? "" : " · off"}
        </p>
      ))}
    </div>
  );
}
