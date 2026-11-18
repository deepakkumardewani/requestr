import { COMMAND_PALETTE_MEDIA } from "../../data/copy";
import { DemoFrame } from "./DemoFrame";
import { PausableVideo } from "./PausableVideo";

/** The landing's command palette recording, in the demo window. */
export function CommandPaletteDemo() {
  return (
    <DemoFrame label="Command palette recording" title="⌘K · command palette">
      <PausableVideo
        src={COMMAND_PALETTE_MEDIA.src}
        poster={COMMAND_PALETTE_MEDIA.poster}
        alt={COMMAND_PALETTE_MEDIA.alt}
        width={COMMAND_PALETTE_MEDIA.width}
        height={COMMAND_PALETTE_MEDIA.height}
      />
    </DemoFrame>
  );
}
