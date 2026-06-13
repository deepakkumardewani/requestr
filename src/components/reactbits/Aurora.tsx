"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface AuroraProps {
  className?: string;
  colors?: string[];
  speed?: number;
  opacity?: number;
}

export function Aurora({
  className,
  colors = [
    "rgba(52,211,153,0.15)",
    "rgba(96,165,250,0.12)",
    "rgba(192,132,252,0.1)",
  ],
  speed = 8,
  opacity = 1,
}: AuroraProps) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t = 0;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width: w, height: h } = canvas;

      colors.forEach((color, i) => {
        const cx = w * (0.3 + 0.4 * Math.sin(t * 0.0004 * speed + i * 2.1));
        const cy = h * (0.4 + 0.3 * Math.cos(t * 0.0003 * speed + i * 1.7));
        const r = Math.min(w, h) * (0.5 + 0.2 * Math.sin(t * 0.0002 + i));
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });

      t++;
      rafRef.current = requestAnimationFrame(draw);
    }

    if (!reduced) {
      draw();
    } else {
      // static single frame
      colors.forEach((color, i) => {
        const cx = canvas.width * (0.3 + 0.4 * (i / colors.length));
        const cy = canvas.height * 0.5;
        const r = Math.min(canvas.width, canvas.height) * 0.6;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [reduced, colors, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 h-full w-full", className)}
      style={{ opacity }}
      aria-hidden
    />
  );
}
