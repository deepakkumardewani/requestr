"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, useRef } from "react";
import type { RequestModel } from "@/types";
import { RequestItem } from "./RequestItem";

type VirtualizedRequestListProps = {
  requests: RequestModel[];
  activeRequestId: string | null;
};

// Measured from RequestItem: py-1.5 (12px) + text-sm line-height (~20px) = ~32px
const ITEM_HEIGHT = 32;
// Show at most this many items before enabling scroll within the accordion
const MAX_VISIBLE = 10;
const OVERSCAN = 5;
const ROW_SELECTOR = '[data-testid="request-item"]';

const ARROW_STEP: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

export function VirtualizedRequestList({
  requests,
  activeRequestId,
}: VirtualizedRequestListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: requests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: OVERSCAN,
  });

  const containerHeight = Math.min(requests.length, MAX_VISIBLE) * ITEM_HEIGHT;

  // Rows outside the window are unmounted, so arrow keys must scroll the
  // target row into existence before focusing it.
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = ARROW_STEP[e.key];
    if (!step) return;
    const target = e.target as HTMLElement;
    // Keys bubbling from a row's descendants (rename input, menu triggers)
    // belong to them; moving focus would blur the input and commit the rename.
    if (!target.matches(ROW_SELECTOR)) return;
    const row = target.closest<HTMLElement>("[data-index]");
    if (!row || !parentRef.current?.contains(row)) return;
    e.preventDefault();
    const next = Number(row.dataset.index) + step;
    if (next < 0 || next >= requests.length) return;
    virtualizer.scrollToIndex(next);
    requestAnimationFrame(() => {
      // Walk this list's own row wrappers: a descendant selector would also
      // match an ancestor (e.g. an accordion item) carrying its own data-index.
      const rowWrapper = Array.from(sizerRef.current?.children ?? []).find(
        (child) => (child as HTMLElement).dataset.index === String(next),
      );
      rowWrapper?.querySelector<HTMLElement>(ROW_SELECTOR)?.focus();
    });
  }

  return (
    <div
      ref={parentRef}
      style={{ height: containerHeight, overflowY: "auto" }}
      onKeyDown={handleKeyDown}
      data-testid="virtualized-request-list"
    >
      <div
        ref={sizerRef}
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const req = requests[virtualItem.index];
          return (
            <div
              key={req.id}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: virtualItem.start,
                left: 0,
                right: 0,
              }}
            >
              <RequestItem
                request={req}
                isActive={activeRequestId === req.id}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
