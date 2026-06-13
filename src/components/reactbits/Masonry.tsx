"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Port of the reactbits.dev Masonry component, adapted to this repo's
 * conventions: motion/react instead of gsap, next/image tiles, and the shared
 * useReducedMotion hook (entrance/hover animations no-op when reduced).
 */

const useMedia = (
  queries: string[],
  values: number[],
  defaultValue: number,
): number => {
  const get = () =>
    values[queries.findIndex((q) => matchMedia(q).matches)] ?? defaultValue;

  const [value, setValue] = useState<number>(defaultValue);

  useEffect(() => {
    const handler = () => setValue(get);
    handler();
    queries.forEach((q) => {
      matchMedia(q).addEventListener("change", handler);
    });
    return () => {
      queries.forEach((q) => {
        matchMedia(q).removeEventListener("change", handler);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries.join()]);

  return value;
};

const useMeasure = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
};

export interface MasonryItem {
  id: string;
  img: string;
  alt: string;
  /** intrinsic dimensions used to preserve aspect ratio within a column */
  width: number;
  height: number;
  url?: string;
}

interface GridItem extends MasonryItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MasonryProps {
  items: MasonryItem[];
  className?: string;
  duration?: number;
  stagger?: number;
  scaleOnHover?: boolean;
  hoverScale?: number;
  gap?: number;
}

export function Masonry({
  items,
  className,
  duration = 0.6,
  stagger = 0.05,
  scaleOnHover = true,
  hoverScale = 0.97,
  gap = 16,
}: MasonryProps) {
  const reduced = useReducedMotion();

  const columns = useMedia(
    ["(min-width:1200px)", "(min-width:768px)", "(min-width:480px)"],
    [3, 2, 2],
    1,
  );

  const [containerRef, { width }] = useMeasure();

  const grid = useMemo<GridItem[]>(() => {
    if (!width) return [];
    const colHeights = new Array(columns).fill(0);
    const totalGaps = (columns - 1) * gap;
    const columnWidth = (width - totalGaps) / columns;

    return items.map((child) => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = col * (columnWidth + gap);
      const ratio = child.width ? child.height / child.width : 0.66;
      const tileHeight = ratio * columnWidth;
      const y = colHeights[col];
      colHeights[col] += tileHeight + gap;
      return { ...child, x, y, w: columnWidth, h: tileHeight };
    });
  }, [columns, items, width, gap]);

  const containerHeight = useMemo(() => {
    if (!grid.length) return 0;
    return Math.max(...grid.map((g) => g.y + g.h));
  }, [grid]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", height: containerHeight }}
    >
      {grid.map((item, index) => (
        <motion.div
          key={item.id}
          className="absolute overflow-hidden rounded-[10px] shadow-[0px_10px_40px_-12px_rgba(0,0,0,0.5)]"
          style={{ willChange: "transform, width, height, opacity" }}
          initial={reduced ? false : { opacity: 0, y: 60, filter: "blur(8px)" }}
          animate={{
            x: item.x,
            y: item.y,
            width: item.w,
            height: item.h,
            opacity: 1,
            filter: "blur(0px)",
          }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration, ease: [0.22, 1, 0.36, 1], delay: index * stagger }
          }
          whileHover={
            scaleOnHover && !reduced ? { scale: hoverScale } : undefined
          }
          onClick={
            item.url
              ? () => window.open(item.url, "_blank", "noopener")
              : undefined
          }
        >
          <Image
            src={item.img}
            alt={item.alt}
            fill
            sizes="(min-width:1200px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover"
          />
        </motion.div>
      ))}
    </div>
  );
}
