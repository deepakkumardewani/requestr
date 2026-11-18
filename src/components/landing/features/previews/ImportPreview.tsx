import { cn } from "@/lib/utils";
import { IMPORT_FORMAT_CHIPS } from "../../constants";
import {
  PREVIEW_FRAME,
  PREVIEW_PANEL,
  PREVIEW_RISE,
  staggerStyle,
} from "./previewStyles";

const VISIBLE_FORMATS = IMPORT_FORMAT_CHIPS.slice(0, 4);
const RESULT = "Scan → each item opens as a request";

export function ImportPreview() {
  return (
    <div className={PREVIEW_FRAME}>
      <div className="flex flex-wrap gap-1">
        {VISIBLE_FORMATS.map((format, index) => (
          <span
            key={format}
            className={cn(
              PREVIEW_PANEL,
              PREVIEW_RISE,
              "py-1 text-foreground/90",
            )}
            style={staggerStyle(index)}
          >
            {format}
          </span>
        ))}
      </div>
      <p className="text-[var(--landing-accent)]">{RESULT}</p>
    </div>
  );
}
