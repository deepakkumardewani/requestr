import Image from "next/image";
import { AnimatedContent } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import {
  BACKUP_GROUP_HEADING,
  BACKUP_GROUP_LEDE,
  BACKUP_ITEMS,
  IMPORT_ALT,
  IMPORT_DARK_SRC,
  IMPORT_EYEBROW,
  IMPORT_FORMAT_CHIPS,
  IMPORT_GROUP_HEADING,
  IMPORT_GROUP_LEDE,
  IMPORT_HEADLINE,
  IMPORT_HEIGHT,
  IMPORT_LIGHT_SRC,
  IMPORT_WIDTH,
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_HEADING,
  SECTION_LEDE,
  SECTION_PADDING,
  SECTION_SURFACE_ALT,
} from "./constants";

const SCREENSHOT_SIZES = "(min-width: 1024px) 560px, 100vw";
const SCREENSHOT_CLASS = "h-auto w-full";
const GROUP_CLASS = "rounded-2xl border border-border bg-card/60 p-6 sm:p-8";
const GROUP_HEADING_CLASS = "text-xl font-semibold tracking-tight";

function ImportGroup() {
  return (
    <div
      role="group"
      aria-labelledby="import-group-title"
      className={cn(GROUP_CLASS, "grid items-start gap-8 lg:grid-cols-2")}
    >
      <div>
        <h3 id="import-group-title" className={GROUP_HEADING_CLASS}>
          {IMPORT_GROUP_HEADING}
        </h3>
        <p className={SECTION_LEDE}>{IMPORT_GROUP_LEDE}</p>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Import formats">
          {IMPORT_FORMAT_CHIPS.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-border/70 bg-background/40 px-3 py-1 font-mono text-xs text-muted-foreground"
            >
              {chip}
            </li>
          ))}
        </ul>
      </div>
      {/* Both themes are in the markup; CSS shows the one matching the active theme. */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Image
          src={IMPORT_LIGHT_SRC}
          alt={IMPORT_ALT}
          width={IMPORT_WIDTH}
          height={IMPORT_HEIGHT}
          sizes={SCREENSHOT_SIZES}
          className={cn(SCREENSHOT_CLASS, "dark:hidden")}
        />
        <Image
          src={IMPORT_DARK_SRC}
          alt={IMPORT_ALT}
          width={IMPORT_WIDTH}
          height={IMPORT_HEIGHT}
          sizes={SCREENSHOT_SIZES}
          className={cn(SCREENSHOT_CLASS, "hidden dark:block")}
        />
      </div>
    </div>
  );
}

function BackupGroup() {
  return (
    <div
      role="group"
      aria-labelledby="backup-group-title"
      className={GROUP_CLASS}
    >
      <h3 id="backup-group-title" className={GROUP_HEADING_CLASS}>
        {BACKUP_GROUP_HEADING}
      </h3>
      <p className={SECTION_LEDE}>{BACKUP_GROUP_LEDE}</p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {BACKUP_ITEMS.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border/70 bg-background/40 p-4"
          >
            <dt className="font-medium">{item.title}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ImportSection() {
  return (
    <section
      id="import"
      className={cn(
        "scroll-mt-20",
        SECTION_DIVIDER,
        SECTION_SURFACE_ALT,
        SECTION_PADDING,
      )}
      aria-labelledby="import-title"
    >
      <div className={SECTION_CONTAINER}>
        <AnimatedContent direction="up">
          <p className={SECTION_EYEBROW}>{IMPORT_EYEBROW}</p>
          <h2 id="import-title" className={SECTION_HEADING}>
            {IMPORT_HEADLINE}
          </h2>
        </AnimatedContent>
        <div className="mt-10 flex flex-col gap-8">
          <AnimatedContent direction="up">
            <ImportGroup />
          </AnimatedContent>
          <AnimatedContent direction="up" delay={0.1}>
            <BackupGroup />
          </AnimatedContent>
        </div>
      </div>
    </section>
  );
}
