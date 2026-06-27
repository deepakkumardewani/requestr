"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface BlurTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
  as?: React.ElementType;
}

export function BlurText({
  text,
  className,
  delay = 0,
  duration = 0.6,
  once = true,
  as: Tag = "span",
}: BlurTextProps) {
  const reduced = useReducedMotion();
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic ref for dynamic element type
  const ref = useRef<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once, reduced]);

  const words = text.split(" ");

  return (
    <Tag ref={ref} className={cn("inline", className)}>
      {words.map((word, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: word order is stable; no reordering occurs
        <AnimatePresence key={`${word}-${i}`}>
          {reduced ? (
            <span>{word} </span>
          ) : (
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, filter: "blur(12px)", y: 8 }}
              animate={
                visible
                  ? { opacity: 1, filter: "blur(0px)", y: 0 }
                  : { opacity: 0, filter: "blur(12px)", y: 8 }
              }
              transition={{
                duration,
                delay: delay + i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {word}&nbsp;
            </motion.span>
          )}
        </AnimatePresence>
      ))}
    </Tag>
  );
}
