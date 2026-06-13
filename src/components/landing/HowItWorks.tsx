"use client";

import { AnimatedContent } from "@/components/reactbits";
import { STEPS } from "./data/steps";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedContent direction="up">
          <div className="mb-12 max-w-xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
              How it works
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Three steps. No friction.
            </h2>
          </div>
        </AnimatedContent>

        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <AnimatedContent key={step.number} direction="up" delay={i * 0.1}>
              <div className="relative">
                {/* Connector line — hidden on last */}
                {i < STEPS.length - 1 && (
                  <div
                    className="absolute left-full top-6 hidden h-px w-full -translate-y-1/2 bg-border/50 sm:block"
                    aria-hidden="true"
                    style={{
                      width: "calc(100% - 3rem)",
                      left: "calc(3rem + 8px)",
                    }}
                  />
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-3xl font-bold text-foreground/10 leading-none select-none">
                      {step.number}
                    </span>
                    <div
                      className="h-px flex-1 bg-border/30"
                      aria-hidden="true"
                    />
                  </div>

                  <h3 className="font-display text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            </AnimatedContent>
          ))}
        </div>
      </div>
    </section>
  );
}
