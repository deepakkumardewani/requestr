"use client";

import { useEffect, useState } from "react";
import { AnimatedContent, BlurText } from "@/components/reactbits";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_EYEBROW,
  SECTION_HEADING,
  SECTION_LEDE,
  SECTION_PADDING,
  SECTION_SURFACE_ALT,
} from "./constants";

const FORMAT_CHIPS = [
  "cURL",
  "Postman v2.1",
  "Insomnia",
  "OpenAPI 3",
  "Swagger 2",
] as const;

const CURL_LINE = `curl -X POST https://api.example.com/orders \\\n  -H "Content-Type: application/json" \\\n  -d '{"item": "desk lamp", "qty": 2}'`;

const PARSED_HEADERS = [
  { key: "Content-Type", value: "application/json" },
] as const;

const PARSED_BODY_LINES = [`{`, `  "item": "desk lamp",`, `  "qty": 2`, `}`];

function ImportPasteBox() {
  const reduced = useReducedMotion();
  const [showParsed, setShowParsed] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const interval = setInterval(() => setShowParsed((v) => !v), 2400);
    return () => clearInterval(interval);
  }, [reduced]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      <pre
        aria-hidden={showParsed}
        className={cn(
          "absolute inset-4 overflow-hidden font-mono text-xs leading-relaxed text-muted-foreground transition-opacity motion-safe:duration-500",
          showParsed ? "opacity-0" : "opacity-100",
        )}
      >
        {CURL_LINE}
      </pre>
      <div
        aria-hidden={!showParsed}
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-border/70 bg-background/40 p-3 transition-opacity motion-safe:duration-500",
          showParsed ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-[10px] font-semibold tracking-wider"
            style={{ color: "var(--method-post)" }}
          >
            POST
          </span>
          <span className="truncate font-mono text-sm text-foreground/90">
            /orders
          </span>
        </div>
        <div className="space-y-1 border-t border-border/50 pt-3">
          {PARSED_HEADERS.map((header) => (
            <p key={header.key} className="font-mono text-xs leading-relaxed">
              <span className="text-muted-foreground">{header.key}:</span>{" "}
              <span className="text-foreground/80">{header.value}</span>
            </p>
          ))}
        </div>
        <pre className="border-t border-border/50 pt-3 font-mono text-xs leading-relaxed text-foreground/80">
          {PARSED_BODY_LINES.join("\n")}
        </pre>
      </div>
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
        <div className="grid items-start gap-8 sm:grid-cols-2 sm:gap-12">
          <AnimatedContent direction="up">
            <p className={SECTION_EYEBROW}>Import</p>
            <h2 id="import-title" className={SECTION_HEADING}>
              <BlurText text="Bring what you have." as="span" duration={0.45} />
            </h2>
            <p className={SECTION_LEDE}>
              Paste a cURL command or drop a Postman, Insomnia, OpenAPI or
              Swagger file.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {FORMAT_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-border/70 bg-background/40 px-3 py-1 font-mono text-xs text-muted-foreground"
                >
                  {chip}
                </span>
              ))}
            </div>
          </AnimatedContent>

          <AnimatedContent direction="up" delay={0.1}>
            <ImportPasteBox />
          </AnimatedContent>
        </div>
      </div>
    </section>
  );
}
