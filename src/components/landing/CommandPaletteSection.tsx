import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  COMMAND_PALETTE_ALT,
  COMMAND_PALETTE_DARK_SRC,
  COMMAND_PALETTE_EYEBROW,
  COMMAND_PALETTE_HEADLINE,
  COMMAND_PALETTE_HEIGHT,
  COMMAND_PALETTE_LEDE,
  COMMAND_PALETTE_LIGHT_SRC,
  COMMAND_PALETTE_WIDTH,
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_HEADING,
  SECTION_LEDE,
  SECTION_PADDING,
} from "./constants";

const SCREENSHOT_CLASS = "h-auto w-full";
const SCREENSHOT_SIZES = "(min-width: 1152px) 1088px, 100vw";

export function CommandPaletteSection() {
  return (
    <section
      id="command-palette"
      className={cn("scroll-mt-20", SECTION_DIVIDER, SECTION_PADDING)}
      aria-labelledby="command-palette-title"
    >
      <div className={SECTION_CONTAINER}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={SECTION_EYEBROW}>{COMMAND_PALETTE_EYEBROW}</p>
          <h2 id="command-palette-title" className={SECTION_HEADING}>
            {COMMAND_PALETTE_HEADLINE}
          </h2>
          <p className={SECTION_LEDE}>{COMMAND_PALETTE_LEDE}</p>
        </div>
        {/* Both themes are in the markup; CSS shows the one matching the active theme. */}
        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <Image
            src={COMMAND_PALETTE_LIGHT_SRC}
            alt={COMMAND_PALETTE_ALT}
            width={COMMAND_PALETTE_WIDTH}
            height={COMMAND_PALETTE_HEIGHT}
            sizes={SCREENSHOT_SIZES}
            className={cn(SCREENSHOT_CLASS, "dark:hidden")}
          />
          <Image
            src={COMMAND_PALETTE_DARK_SRC}
            alt={COMMAND_PALETTE_ALT}
            width={COMMAND_PALETTE_WIDTH}
            height={COMMAND_PALETTE_HEIGHT}
            sizes={SCREENSHOT_SIZES}
            className={cn(SCREENSHOT_CLASS, "hidden dark:block")}
          />
        </div>
      </div>
    </section>
  );
}
