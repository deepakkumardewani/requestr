"use client";

import { AnimatedContent, BlurText } from "@/components/reactbits";
import { cn } from "@/lib/utils";
import { AiVisual } from "./beyond/AiVisual";
import { ChainVisual } from "./beyond/ChainVisual";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_HEADING,
  SECTION_PADDING,
} from "./constants";

interface BeyondSendRow {
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}

const ROWS: BeyondSendRow[] = [
  {
    eyebrow: "Chains",
    title: "Visual request chains.",
    body: "Draw an arrow between requests. JSONPath maps a response field into the next URL, header or body. Add conditions and delays, run the whole flow.",
    visual: <ChainVisual />,
  },
  {
    eyebrow: "AI",
    title: "AI where you already work.",
    body: "Generate bodies, suggest headers, write assertions, explain a 500. AI lives in the builders, not a side chat.",
    visual: <AiVisual />,
  },
];

interface BeyondSendRowViewProps {
  row: BeyondSendRow;
  reverse: boolean;
  delay: number;
}

function BeyondSendRowView({ row, reverse, delay }: BeyondSendRowViewProps) {
  return (
    <div className="grid items-center gap-8 py-10 sm:grid-cols-2 sm:gap-12">
      <AnimatedContent
        direction={reverse ? "right" : "left"}
        delay={delay}
        className={reverse ? "sm:order-2" : undefined}
      >
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
          {row.eyebrow}
        </p>
        <h3 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {row.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {row.body}
        </p>
      </AnimatedContent>
      <AnimatedContent
        direction={reverse ? "left" : "right"}
        delay={delay + 0.08}
        className={reverse ? "sm:order-1" : undefined}
      >
        {row.visual}
      </AnimatedContent>
    </div>
  );
}

export function BeyondSend() {
  return (
    <section
      id="beyond-send"
      className={cn("scroll-mt-20", SECTION_DIVIDER, SECTION_PADDING)}
      aria-labelledby="beyond-send-title"
    >
      <div className={SECTION_CONTAINER}>
        <AnimatedContent direction="up">
          <div className="mx-auto mb-4 max-w-xl text-center">
            <p className={SECTION_EYEBROW}>Beyond send</p>
            <h2 id="beyond-send-title" className={SECTION_HEADING}>
              <BlurText
                text="More than a single request."
                as="span"
                duration={0.45}
              />
            </h2>
          </div>
        </AnimatedContent>

        <div className="divide-y divide-border/60">
          {ROWS.map((row, i) => (
            <BeyondSendRowView
              key={row.eyebrow}
              row={row}
              reverse={i % 2 === 1}
              delay={0.1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
