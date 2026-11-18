import { AnimatedContent } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import { GridBackdrop } from "../background/GridBackdrop";
import { SECTION_CONTAINER } from "../constants";
import {
  WORDMARK_REVEAL_DELAY_S,
  WORDMARK_REVEAL_DISTANCE_PX,
  WORDMARK_REVEAL_DURATION_S,
  WORDMARK_TEXT,
} from "./constants";

/**
 * Sized in container units so the word always spans the content width and
 * never the viewport (100vw would include the scrollbar and overflow). The
 * size is measured so the inked glyphs, not the text box, fill the width.
 */
const WORDMARK_TYPE =
  "select-none whitespace-nowrap font-display text-[24.8cqw] font-bold leading-[0.8] tracking-[-0.055em]";
/** A translucent fill and hairline stroke, so the grid and pointer light show through. */
const WORDMARK_FILL =
  "bg-gradient-to-b from-foreground/20 via-foreground/[0.07] to-transparent bg-clip-text text-transparent [-webkit-text-stroke:1px_color-mix(in_oklch,var(--foreground)_20%,transparent)]";
/**
 * Pulls the "R" left by its side bearing so its stem lines up with the
 * columns above, and drops the baseline just past the band so the bottom
 * edge crops the letters.
 */
const WORDMARK_OFFSET = "translate-x-[-0.074em] translate-y-[0.08em]";

/** The oversized closing wordmark. Decoration only, hidden from assistive tech. */
export function FooterWordmark() {
  return (
    <div
      aria-hidden="true"
      className="relative isolate overflow-hidden pt-10 sm:pt-14"
    >
      <GridBackdrop mask="center" />
      <div className={SECTION_CONTAINER}>
        <div className="@container">
          <AnimatedContent
            direction="up"
            delay={WORDMARK_REVEAL_DELAY_S}
            duration={WORDMARK_REVEAL_DURATION_S}
            distance={WORDMARK_REVEAL_DISTANCE_PX}
          >
            <p className={cn(WORDMARK_TYPE, WORDMARK_FILL, WORDMARK_OFFSET)}>
              {WORDMARK_TEXT}
            </p>
          </AnimatedContent>
        </div>
      </div>
    </div>
  );
}
