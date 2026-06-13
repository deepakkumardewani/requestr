"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface RotatingTextProps {
  words: string[];
  colors?: string[];
  className?: string;
  interval?: number;
  duration?: number;
}

export function RotatingText({
  words,
  colors = [],
  className,
  interval = 2000,
  duration = 0.4,
}: RotatingTextProps) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      interval,
    );
    return () => clearInterval(id);
  }, [words.length, interval, reduced]);

  const color = colors[index % colors.length];

  if (reduced) {
    return (
      <span
        className={cn("inline-block", className)}
        style={color ? { color } : undefined}
      >
        {words[0]}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-block overflow-hidden align-bottom",
        className,
      )}
      style={{ minWidth: "4ch" }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="inline-block"
          style={color ? { color } : undefined}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
