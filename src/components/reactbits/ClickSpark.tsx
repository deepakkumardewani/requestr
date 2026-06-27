"use client";

import { useCallback, useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface ClickSparkProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  count?: number;
  duration?: number;
}

export function ClickSpark({
  children,
  className,
  color = "var(--method-get)",
  count = 8,
  duration = 500,
}: ClickSparkProps) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function sync() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const spawnSparks = useCallback(
    (x: number, y: number) => {
      if (reduced) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const start = performance.now();
      const angles = Array.from(
        { length: count },
        (_, i) => (i / count) * Math.PI * 2,
      );

      function frame(now: number) {
        if (!ctx || !canvas) return;
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        angles.forEach((angle) => {
          const dist = progress * 40;
          const ex = x + Math.cos(angle) * dist;
          const ey = y + Math.sin(angle) * dist;
          ctx.beginPath();
          ctx.moveTo(
            x + Math.cos(angle) * dist * 0.4,
            y + Math.sin(angle) * dist * 0.4,
          );
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 1 - progress;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(frame);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(frame);
    },
    [color, count, duration, reduced],
  );

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    spawnSparks(e.clientX - rect.left, e.clientY - rect.top);
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onClick={handleClick}
    >
      {children}
      {!reduced && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        />
      )}
    </div>
  );
}
