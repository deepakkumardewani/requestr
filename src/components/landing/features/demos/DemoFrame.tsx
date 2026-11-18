import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

interface DemoFrameProps {
  /** Names the demo for screen readers; the figure is its landmark. */
  label: string;
  /** Mono title in the window bar, like the tab of the tool it imitates. */
  title: string;
  children: ReactNode;
  /** Controls shown under the window, such as the example picker. */
  controls?: ReactNode;
  frameRef?: Ref<HTMLElement>;
  className?: string;
}

/** The window every feature demo sits in, matching the landing's Relay panel. */
export function DemoFrame({
  label,
  title,
  children,
  controls,
  frameRef,
  className,
}: DemoFrameProps) {
  return (
    <figure ref={frameRef} aria-label={label} className={className}>
      <div className="overflow-hidden rounded-xl border border-border bg-[var(--surface-deep)] shadow-2xl shadow-black/40">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          </span>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {title}
          </p>
        </div>
        {children}
      </div>
      {controls ? <div className="mt-3">{controls}</div> : null}
    </figure>
  );
}

interface DemoPickerProps {
  /** Group name read out before the options. */
  label: string;
  options: readonly { id: string; label: string }[];
  activeIndex: number;
  onPick: (index: number) => void;
}

/** The "try:" row of examples, styled like the landing's session picker. */
export function DemoPicker({
  label,
  options,
  activeIndex,
  onPick,
}: DemoPickerProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-2"
    >
      <span
        aria-hidden="true"
        className="font-mono text-xs text-muted-foreground"
      >
        try:
      </span>
      {options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={index === activeIndex}
          onClick={() => onPick(index)}
          className={cn(
            "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            index === activeIndex
              ? "border-[var(--landing-accent)]/50 bg-[var(--landing-accent)]/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
