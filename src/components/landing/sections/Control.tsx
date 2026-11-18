import { EyeIcon, Undo2Icon } from "lucide-react";
import { AnimatedContent } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
  SECTION_SURFACE_ALT,
} from "../constants";
import { APPROVAL_ROWS } from "../data/approvals";
import {
  APPROVAL_MODES,
  CONTROL_EYEBROW,
  CONTROL_HEADLINE,
  CONTROL_LEDE,
  UNDO_BODY,
  UNDO_TITLE,
  VISIBILITY_ITEMS,
  VISIBILITY_NOTE,
  VISIBILITY_TITLE,
} from "../data/copy";
import { SECTION_IDS } from "../data/links";
import { SectionHeader } from "../SectionHeader";
import { SpotlightCard } from "../SpotlightCard";
import { ApprovalSimulator } from "./ApprovalSimulator";

const TITLE_ID = "control-title";
const PANEL_TITLE_CLASS =
  "flex items-center gap-2 font-display text-base font-semibold text-foreground";
const PANEL_ICON_CLASS = "size-4 shrink-0 text-[var(--landing-accent)]";

function UndoPanel() {
  return (
    <SpotlightCard className="h-full">
      <div className="p-6">
        <h3 className={PANEL_TITLE_CLASS}>
          <Undo2Icon aria-hidden="true" className={PANEL_ICON_CLASS} />
          {UNDO_TITLE}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {UNDO_BODY}
        </p>
      </div>
    </SpotlightCard>
  );
}

function VisibilityPanel() {
  return (
    <SpotlightCard className="h-full">
      <div className="p-6">
        <h3 className={PANEL_TITLE_CLASS}>
          <EyeIcon aria-hidden="true" className={PANEL_ICON_CLASS} />
          {VISIBILITY_TITLE}
        </h3>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/40">
          {VISIBILITY_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
          {VISIBILITY_NOTE}
        </p>
      </div>
    </SpotlightCard>
  );
}

export function Control() {
  return (
    <section
      id={SECTION_IDS.control}
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
          eyebrow={CONTROL_EYEBROW}
          title={CONTROL_HEADLINE}
          lede={CONTROL_LEDE}
        />
        <AnimatedContent direction="up">
          <ApprovalSimulator modes={APPROVAL_MODES} rows={APPROVAL_ROWS} />
        </AnimatedContent>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <UndoPanel />
          <VisibilityPanel />
        </div>
      </div>
    </section>
  );
}
