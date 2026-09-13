"use client";

import { AnimatedContent, BlurText } from "@/components/reactbits";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_PADDING,
} from "./constants";

const STEPS = [
  {
    number: "01",
    color: "var(--method-get)",
    title: "Open a tab.",
    body: "No download, no account. requestr.dev/app loads in under a second.",
  },
  {
    number: "02",
    color: "var(--method-post)",
    title: "Send through the proxy.",
    body: "Requests go through a stateless server-side proxy that only forwards. No CORS extension, nothing logged.",
  },
  {
    number: "03",
    color: "var(--method-patch)",
    title: "Everything stays here.",
    body: "Collections, history and environments live in IndexedDB in this browser.",
  },
] as const;

function StepConnector({ color, delay }: { color: string; delay: number }) {
  return (
    <div className="hidden h-[2px] w-full flex-1 overflow-hidden sm:block">
      <AnimatedContent direction="left" distance={40} delay={delay} once>
        <div
          className="h-[2px] w-full origin-left rounded-full"
          style={{ backgroundColor: color }}
        />
      </AnimatedContent>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className={`scroll-mt-20 ${SECTION_DIVIDER} ${SECTION_PADDING}`}
      aria-labelledby="how-it-works-title"
    >
      <div className={SECTION_CONTAINER}>
        <AnimatedContent direction="up">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <p className={SECTION_EYEBROW}>How it works</p>
            <h2
              id="how-it-works-title"
              className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            >
              <BlurText
                text="Three steps. No install."
                as="span"
                duration={0.45}
              />
            </h2>
          </div>
        </AnimatedContent>

        <div className="flex flex-col items-stretch gap-6 sm:flex-row sm:items-center sm:gap-0">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex flex-1 items-center">
              <AnimatedContent
                direction="up"
                delay={0.1 + i * 0.12}
                className="flex-1"
              >
                <div className="flex h-full flex-col rounded-xl border border-border bg-card p-6">
                  <span
                    className="font-mono text-xs font-semibold tracking-wider"
                    style={{ color: step.color }}
                  >
                    {step.number}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </AnimatedContent>
              {i < STEPS.length - 1 && (
                <div className="hidden w-10 shrink-0 px-2 sm:block lg:w-16">
                  <StepConnector color={step.color} delay={0.3 + i * 0.12} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
