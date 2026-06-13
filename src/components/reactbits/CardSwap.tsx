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
}: CardSwapProps) {
  const reduced = useReducedMotion();
  const cards = Children.toArray(children);
  const [order, setOrder] = useState(() => cards.map((_, i) => i));

  useEffect(() => {
    if (reduced || cards.length < 2) return;
    const id = setInterval(
      () => setOrder((o) => [...o.slice(1), o[0]]),
      interval,
    );
    return () => clearInterval(id);
  }, [reduced, cards.length, interval]);

  if (reduced) {
    return <div className={cn("relative", className)}>{cards[0]}</div>;
  }

  return (
    <div className={cn("relative", className)}>
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
              opacity: depth > 2 ? 0 : 1,
            }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {card}
          </motion.div>
        );
      })}
    </div>
  );
}
