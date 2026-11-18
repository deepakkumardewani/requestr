"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const WORD_STAGGER_S = 0.08;
const WORD_DURATION_S = 0.5;
const WORD_BLUR_PX = 8;
const WORD_RISE_PX = 6;
const IN_VIEW_AMOUNT = 0.6;

interface BlurHeadlineProps {
  text: string;
  className?: string;
}

/**
 * Words blur in one by one. The full sentence is always in the DOM as
 * `sr-only` text, so crawlers and screen readers never depend on the animation.
 * Only opacity, filter and transform animate, so the layout never shifts.
 */
export function BlurHeadline({ text, className }: BlurHeadlineProps) {
  const reduced = useReducedMotion();

  if (reduced) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(" ").map((word, index) => (
          <motion.span
            // biome-ignore lint/suspicious/noArrayIndexKey: static split of a constant string
            key={index}
            className={cn("inline-block", index > 0 && "ml-[0.25em]")}
            initial={{
              opacity: 0,
              filter: `blur(${WORD_BLUR_PX}px)`,
              y: WORD_RISE_PX,
            }}
            whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            viewport={{ once: true, amount: IN_VIEW_AMOUNT }}
            transition={{
              duration: WORD_DURATION_S,
              delay: index * WORD_STAGGER_S,
              ease: "easeOut",
            }}
          >
            {word}
          </motion.span>
        ))}
      </span>
    </span>
  );
}
