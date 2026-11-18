"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TOOLBOX_PREVIEW_LABEL } from "../data/copy";
import type { ToolEntry } from "../data/toolbox";

const INDEX_PAD_LENGTH = 2;
const CAPTURE_WIDTH = 1440;
const CAPTURE_HEIGHT = 900;
const CAPTURE_SIZES = "(min-width: 1024px) 560px, 0px";

interface ToolRowProps {
  tool: ToolEntry;
  index: number;
  isActive: boolean;
  onActivate: () => void;
}

function ToolRow({ tool, index, isActive, onActivate }: ToolRowProps) {
  return (
    <li>
      <Link
        href={tool.route}
        onMouseEnter={onActivate}
        onFocus={onActivate}
        className={cn(
          "group relative grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-4 gap-y-1 px-4 py-4 transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5",
          isActive && "lg:bg-muted/40",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 hidden w-0.5 bg-[var(--landing-accent)] transition-opacity duration-150 lg:block",
            isActive ? "opacity-100" : "opacity-0",
          )}
        />
        <span className="font-mono text-xs text-muted-foreground/80">
          {String(index + 1).padStart(INDEX_PAD_LENGTH, "0")}
        </span>
        <span className="font-display text-base font-semibold text-foreground">
          {tool.name}
        </span>
        <span
          aria-hidden="true"
          className="font-mono text-sm text-muted-foreground transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--landing-accent)] motion-reduce:transform-none"
        >
          →
        </span>
        <span className="col-start-2 text-sm leading-relaxed text-muted-foreground">
          {tool.description}
        </span>
      </Link>
    </li>
  );
}

function ToolPreview({
  tools,
  activeIndex,
}: {
  tools: readonly ToolEntry[];
  activeIndex: number;
}) {
  return (
    <div className="sticky top-24 hidden lg:block">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/80">
        {TOOLBOX_PREVIEW_LABEL} · {tools[activeIndex]?.name}
      </p>
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-[var(--surface-deep)] shadow-2xl">
        {tools.map((tool, index) => (
          <Image
            key={tool.slug}
            src={tool.screenshot.src}
            alt={tool.screenshot.alt}
            width={CAPTURE_WIDTH}
            height={CAPTURE_HEIGHT}
            sizes={CAPTURE_SIZES}
            aria-hidden={index !== activeIndex}
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-left-top transition-opacity duration-300 motion-reduce:transition-none",
              index === activeIndex ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Feature links with a capture of the hovered or focused one beside them on wide screens. */
export function ToolboxExplorer({ tools }: { tools: readonly ToolEntry[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_minmax(0,35rem)] lg:gap-10">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {tools.map((tool, index) => (
          <ToolRow
            key={tool.slug}
            tool={tool}
            index={index}
            isActive={index === activeIndex}
            onActivate={() => setActiveIndex(index)}
          />
        ))}
      </ul>
      <ToolPreview tools={tools} activeIndex={activeIndex} />
    </div>
  );
}
