import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_HEADING,
  SECTION_LEDE,
  SECTION_PADDING,
} from "../constants";
import { WatchDemoButton } from "../WatchDemoButton";
import { RelayDemoPanel } from "./RelayDemoPanel";

export function RelaySection() {
  return (
    <section
      id="relay"
      className={cn("scroll-mt-20", SECTION_DIVIDER, SECTION_PADDING)}
      aria-labelledby="relay-title"
    >
      <div className={SECTION_CONTAINER}>
        <div className="mx-auto mb-10 max-w-xl text-center">
          <p className={SECTION_EYEBROW}>Relay</p>
          <h2 id="relay-title" className={SECTION_HEADING}>
            Ask for the change. Review it. Undo it.
          </h2>
          <p className={SECTION_LEDE}>
            Describe what you want across a collection. Relay proposes the edits
            as cards, and every one can be undone.
          </p>
        </div>
        <div className="mx-auto max-w-4xl">
          <RelayDemoPanel />
        </div>
        <div className="mt-6 flex justify-center">
          <WatchDemoButton />
        </div>
      </div>
    </section>
  );
}
