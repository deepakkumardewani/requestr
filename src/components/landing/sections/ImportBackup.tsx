import { cn } from "@/lib/utils";
import {
  IMPORT_EYEBROW,
  IMPORT_FORMAT_CHIPS,
  IMPORT_HEADLINE,
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
  SECTION_SURFACE_ALT,
} from "../constants";
import { DATA_FORMATS_LABEL, DATA_STEPS } from "../data/copy";
import { SECTION_IDS } from "../data/links";
import { SectionHeader } from "../SectionHeader";
import { DataStepShowcase } from "./DataStepShowcase";

const TITLE_ID = "import-backup-title";

function FormatChips() {
  return (
    <ul aria-label={DATA_FORMATS_LABEL} className="mb-8 flex flex-wrap gap-2">
      {IMPORT_FORMAT_CHIPS.map((chip) => (
        <li
          key={chip}
          className="rounded-full border border-border/70 bg-background/40 px-3 py-1 font-mono text-xs text-muted-foreground"
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}

export function ImportBackup() {
  return (
    <section
      id={SECTION_IDS.importBackup}
      aria-labelledby={TITLE_ID}
      className={cn(
        "scroll-mt-20",
        SECTION_DIVIDER,
        SECTION_SURFACE_ALT,
        SECTION_PADDING,
      )}
    >
      <div className={SECTION_CONTAINER}>
        <SectionHeader
          titleId={TITLE_ID}
          eyebrow={IMPORT_EYEBROW}
          title={IMPORT_HEADLINE}
          className="mb-6"
        />
        <FormatChips />
        <DataStepShowcase steps={DATA_STEPS} />
      </div>
    </section>
  );
}
