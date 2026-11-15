import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
} from "../constants";
import { LANDING_CAPABILITIES } from "../data/capabilities";
import {
  CAPABILITIES_EYEBROW,
  CAPABILITIES_HEADLINE,
  CAPABILITIES_LEDE,
} from "../data/copy";
import { SECTION_IDS } from "../data/links";
import { SectionHeader } from "../SectionHeader";
import { CapabilityExplorer } from "./CapabilityExplorer";

const TITLE_ID = "capabilities-title";

export function Capabilities() {
  return (
    <section
      id={SECTION_IDS.capabilities}
      aria-labelledby={TITLE_ID}
      className={cn("scroll-mt-20", SECTION_DIVIDER, SECTION_PADDING)}
    >
      <div className={SECTION_CONTAINER}>
        <SectionHeader
          titleId={TITLE_ID}
          eyebrow={CAPABILITIES_EYEBROW}
          title={CAPABILITIES_HEADLINE}
          lede={CAPABILITIES_LEDE}
        />
        <CapabilityExplorer capabilities={LANDING_CAPABILITIES} />
      </div>
    </section>
  );
}
