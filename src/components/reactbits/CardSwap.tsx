"use client";

import { motion } from "motion/react";
import { Children, type ReactNode, useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface CardSwapProps {
  children: ReactNode;
  className?: string;
  /** ms between swaps */
  interval?: number;
  /** px offset applied per depth level */
  offset?: number;
  /** scale removed per depth level */
  scaleStep?: number;
  /** pause the auto-cycle while the pointer or focus is inside the stack */
  pauseOnHover?: boolean;
  /** render small dot indicators below the stack showing which card is front */
  showIndicators?: boolean;
}

/**
 * A cycling 3D stack of cards. The front card moves to the back on an interval.
 * Reduced motion renders only the first card statically. The container must be
 * sized by the caller (cards are absolutely positioned).
 */
export function CardSwap({
  children,
  className,
  interval = 3000,
  offset = 18,
  scaleStep = 0.05,
  pauseOnHover = false,
  showIndicators = false,
}: CardSwapProps) {
  const reduced = useReducedMotion();
  const cards = Children.toArray(children);
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || cards.length < 2 || (pauseOnHover && paused)) return;
    const id = setInterval(
      () => setOrder((o) => [...o.slice(1), o[0]]),
      interval,
    );
    return () => clearInterval(id);
  }, [reduced, cards.length, interval, pauseOnHover, paused]);

  const pauseHandlers = pauseOnHover
    ? {
        onMouseEnter: () => setPaused(true),
        onMouseLeave: () => setPaused(false),
        onFocus: () => setPaused(true),
        onBlur: () => setPaused(false),
      }
    : {};

  if (reduced) {
    return <div className={cn("relative", className)}>{cards[0]}</div>;
  }

  return (
    <div className={className}>
      <div
        className="relative h-full w-full overflow-hidden"
        {...pauseHandlers}
      >
        {cards.map((card, i) => {
          const depth = order.indexOf(i);
          const cardKey = (card as React.ReactElement).key ?? `card-swap-${i}`;
          return (
            <motion.div
              key={cardKey}
              className="absolute inset-0"
              animate={{
                x: depth * offset,
                y: depth * -offset,
                scale: 1 - depth * scaleStep,
                zIndex: cards.length - depth,
                opacity: depth === 0 ? 1 : depth === 1 ? 0.35 : 0,
              }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {card}
            </motion.div>
          );
        })}
      </div>
      {showIndicators && (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {cards.map((card, i) => {
            const cardKey =
              (card as React.ReactElement).key ?? `card-swap-dot-${i}`;
            return (
              <span
                key={cardKey}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors duration-300",
                  order[0] === i ? "bg-foreground/70" : "bg-foreground/20",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
