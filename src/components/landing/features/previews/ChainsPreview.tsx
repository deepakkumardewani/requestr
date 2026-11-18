import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { PREVIEW_BLINK, PREVIEW_PANEL, staggerStyle } from "./previewStyles";

const NODES = ["Login", "Get profile", "Validate"] as const;
const LINK_LABEL = "{{token}}";

export function ChainsPreview() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2 px-3 font-mono text-[10px]">
      <div className="flex items-center gap-1.5">
        {NODES.map((node, index) => (
          <Fragment key={node}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="h-px min-w-3 flex-1 bg-border"
              />
            ) : null}
            <span
              className={cn(
                PREVIEW_PANEL,
                "flex shrink-0 items-center gap-1.5 text-foreground/90",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  PREVIEW_BLINK,
                  "size-1.5 rounded-full bg-[var(--method-get)]",
                )}
                style={staggerStyle(index)}
              />
              {node}
            </span>
          </Fragment>
        ))}
      </div>
      <p className="text-[var(--method-post)]">
        token ← $.access_token → {LINK_LABEL}
      </p>
    </div>
  );
}
