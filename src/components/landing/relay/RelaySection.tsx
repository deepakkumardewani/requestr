import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_HEADING,
  SECTION_LEDE,
  SECTION_PADDING,
} from "../constants";

const POSTER_SRC = "/media/relay/relay-poster.webp";
const POSTER_WIDTH = 1280;
const POSTER_HEIGHT = 800;

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
            and you review each one before it lands.
          </p>
        </div>
        <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border">
          <Image
            src={POSTER_SRC}
            alt="Relay proposing edits across an API collection"
            width={POSTER_WIDTH}
            height={POSTER_HEIGHT}
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}
