import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_HEADING,
  SECTION_PADDING,
} from "./constants";

export function CommandPaletteSection() {
  return (
    <section
      id="command-palette"
      className={cn("scroll-mt-20", SECTION_DIVIDER, SECTION_PADDING)}
      aria-labelledby="command-palette-title"
    >
      <div className={SECTION_CONTAINER}>
        <h2
          id="command-palette-title"
          className={cn(SECTION_HEADING, "text-center")}
        >
          Do anything from one keystroke.
        </h2>
      </div>
    </section>
  );
}
