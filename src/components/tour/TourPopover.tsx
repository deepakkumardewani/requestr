"use client";

import { X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Button } from "@/components/ui/button";

export type TourPopoverLabels = {
  progress: string;
  back: string;
  next: string;
  done: string;
  skip: string;
  close: string;
};

export type TourPopoverProps = {
  title: string;
  description: string;
  stepIndex: number;
  isFirst: boolean;
  isLast: boolean;
  labels: TourPopoverLabels;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};

const FOCUSABLE_SELECTOR = "button:not([disabled])";
const HOST_ATTRIBUTE = "data-tour-host";

/** Keeps Tab inside the popover while the tour is open. */
function trapTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function TourPopover({
  title,
  description,
  stepIndex,
  isFirst,
  isLast,
  labels,
  onBack,
  onNext,
  onSkip,
}: TourPopoverProps) {
  const nextRef = useRef<HTMLButtonElement>(null);

  // Each step moves focus to the primary action so keyboard users can keep pressing Enter.
  useEffect(() => {
    nextRef.current?.focus();
  }, [stepIndex]);

  return (
    <div
      data-testid="tour-popover"
      onKeyDown={trapTab}
      className="flex w-72 flex-col gap-3 text-popover-foreground"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {labels.progress}
        </p>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={labels.close}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid="tour-close"
          onClick={onSkip}
        >
          <X />
        </Button>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid="tour-skip"
          onClick={onSkip}
        >
          {labels.skip}
        </Button>
        <div className="flex items-center gap-1.5">
          {!isFirst && (
            <Button
              variant="outline"
              size="sm"
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              data-testid="tour-back"
              onClick={onBack}
            >
              {labels.back}
            </Button>
          )}
          <Button
            ref={nextRef}
            size="sm"
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            data-testid="tour-next"
            onClick={onNext}
          >
            {isLast ? labels.done : labels.next}
          </Button>
        </div>
      </div>
    </div>
  );
}

const roots = new WeakMap<HTMLElement, Root>();

/** Inline because driver.css is unlayered and would beat Tailwind utilities on the wrapper. */
const WRAPPER_STYLE: Partial<CSSStyleDeclaration> = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
  padding: "12px",
  minWidth: "0",
  maxWidth: "calc(100vw - 2rem)",
};

function ensureHost(wrapper: HTMLElement): HTMLElement {
  const existing = wrapper.querySelector<HTMLElement>(`[${HOST_ATTRIBUTE}]`);
  if (existing) return existing;
  const host = document.createElement("div");
  host.setAttribute(HOST_ATTRIBUTE, "");
  wrapper.appendChild(host);
  return host;
}

/**
 * Replaces driver.js's default popover contents with `TourPopover`. Driver's own
 * nodes stay in the DOM (hidden) because its aria-labelledby/describedby point at them.
 * Safe to call on every step: the same React root is reused and re-rendered.
 */
export function renderTourPopover(
  wrapper: HTMLElement,
  props: TourPopoverProps,
): void {
  Object.assign(wrapper.style, WRAPPER_STYLE);
  const host = ensureHost(wrapper);
  for (const child of Array.from(wrapper.children)) {
    if (child !== host && child instanceof HTMLElement) {
      child.style.display = "none";
    }
  }
  const root = roots.get(host) ?? createRoot(host);
  roots.set(host, root);
  // Synchronous so driver.js measures the real content size when it positions the popover.
  flushSync(() => root.render(<TourPopover {...props} />));
}

export function unmountTourPopover(wrapper: HTMLElement): void {
  const host = wrapper.querySelector<HTMLElement>(`[${HOST_ATTRIBUTE}]`);
  const root = host ? roots.get(host) : undefined;
  if (!host || !root) return;
  roots.delete(host);
  // Deferred: unmounting synchronously inside a React event handler warns.
  queueMicrotask(() => {
    root.unmount();
    host.remove();
  });
}
