import type { ComponentType, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
} from "../../constants";
import { SectionHeader } from "../../SectionHeader";
import type { FeatureDetail } from "../data/featureDetails";
import { FEATURE_SECTION_IDS, MEDIA_HALO, titleId } from "./pageConstants";

const EYEBROW = "Live demo";
const DETAILS_LABEL = "In the app";
const TITLE_ID = titleId(FEATURE_SECTION_IDS.demo);

interface FeatureDemoSectionProps {
  detail: FeatureDetail;
  Demo: ComponentType;
  /** The SEO body after the intro; it reads beside the demo. */
  paragraphs: readonly string[];
}

/** The centrepiece: the feature working, with the page's longer copy beside it. */
export function FeatureDemoSection({
  detail,
  Demo,
  paragraphs,
}: FeatureDemoSectionProps) {
  return (
    <section
      id={FEATURE_SECTION_IDS.demo}
      aria-labelledby={TITLE_ID}
      className={cn("scroll-mt-20", SECTION_PADDING, SECTION_DIVIDER)}
    >
      <div className={SECTION_CONTAINER}>
        <SectionHeader
          titleId={TITLE_ID}
          eyebrow={EYEBROW}
          title={detail.demo.title}
          lede={detail.demo.lede}
        />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
          <div
            className="relative min-w-0"
            style={{ "--halo-color": detail.color } as CSSProperties}
          >
            <div aria-hidden="true" className={MEDIA_HALO} />
            <Demo />
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              {detail.demo.note}
            </p>
          </div>
          <div className="space-y-4 lg:pt-2">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {DETAILS_LABEL}
            </p>
            {paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="text-pretty leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
