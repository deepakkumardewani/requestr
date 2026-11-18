import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
} from "../constants";
import { TOOLBOX_EYEBROW, TOOLBOX_HEADLINE, TOOLBOX_LEDE } from "../data/copy";
import { FEATURES_HUB_PATH, SECTION_IDS } from "../data/links";
import { TOOL_ENTRIES } from "../data/toolbox";
import { SectionHeader } from "../SectionHeader";
import { ToolboxExplorer } from "./ToolboxExplorer";

const TITLE_ID = "toolbox-title";

export function Toolbox() {
  return (
    <section
      id={SECTION_IDS.toolbox}
      aria-labelledby={TITLE_ID}
      className={cn("scroll-mt-20", SECTION_DIVIDER, SECTION_PADDING)}
    >
      <div className={SECTION_CONTAINER}>
        <SectionHeader
          titleId={TITLE_ID}
          eyebrow={TOOLBOX_EYEBROW}
          title={TOOLBOX_HEADLINE}
          lede={TOOLBOX_LEDE}
        />
        <ToolboxExplorer tools={TOOL_ENTRIES} />
        <p className="mt-6">
          <Link
            href={FEATURES_HUB_PATH}
            className="rounded font-mono text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See every feature →
          </Link>
        </p>
      </div>
    </section>
  );
}
