"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface AuroraProps {
  className?: string;
  colors?: string[];
  speed?: number;
  opacity?: number;
  /** Multiplier for gradient radius — higher = broader wash */
  scale?: number;
  /** Peak opacity at gradient center (0–1) */
  amplitude?: number;
  /** Canvas blur in px — softens discrete bands */
  blur?: number;
  /** Number of active gradient layers (lower = smoother) */
  density?: number;
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
  scale = 1,
  amplitude = 0.35,
  blur = 48,
  density,
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

    const layerCount = density ?? Math.min(colors.length, 3);

    function paintLayer(
      context: CanvasRenderingContext2D,
      color: string,
      i: number,
      phase: number,
      w: number,
      h: number,
    ) {
      const cx = w * (0.25 + 0.5 * Math.sin(phase * 0.00025 * speed + i * 1.9));
      const cy = h * (0.35 + 0.3 * Math.cos(phase * 0.0002 * speed + i * 1.4));
      const baseR = Math.min(w, h) * (0.75 + 0.15 * Math.sin(phase * 0.00015 + i));
      const r = baseR * scale;
      const grad = context.createRadialGradient(cx, cy, 0, cx, cy, r);
      const peak = color.replace(
        /rgba?\(([^)]+)\)/,
        (_, inner: string) => {
          const parts = inner.split(",").map((s: string) => s.trim());
          if (parts.length === 4) {
            parts[3] = String(amplitude);
            return `rgba(${parts.join(", ")})`;
          }
          return color;
        },
      );
      grad.addColorStop(0, peak);
      grad.addColorStop(0.45, color);
      grad.addColorStop(1, "transparent");
      context.fillStyle = grad;
      context.fillRect(0, 0, w, h);
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width: w, height: h } = canvas;

      for (let i = 0; i < layerCount; i++) {
        paintLayer(ctx, colors[i % colors.length], i, t, w, h);
      }

      t++;
      rafRef.current = requestAnimationFrame(draw);
    }

    if (!reduced) {
      draw();
    } else {
      for (let i = 0; i < layerCount; i++) {
        paintLayer(ctx, colors[i % colors.length], i, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [reduced, colors, speed, scale, amplitude, blur, density]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 h-full w-full", className)}
      style={{ opacity, filter: blur > 0 ? `blur(${blur}px)` : undefined }}
      aria-hidden
    />
  );
}
