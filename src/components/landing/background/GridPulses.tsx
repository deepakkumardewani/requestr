"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import {
  advancePulse,
  type Bounds,
  hasLeft,
  type Pulse,
  spawnPulse,
  TAIL_LENGTH_PX,
} from "./pulses";

/** The app's method colours, so the streaks read as GET, POST, PUT and PATCH. */
const COLOR_VARIABLES = [
  "--method-get",
  "--method-post",
  "--method-put",
  "--method-patch",
] as const;
const FALLBACK_COLOR = "rgb(52 211 153)";
const MAX_PULSES = 18;
const SPAWN_INTERVAL_MS = 260;
const MAX_DEVICE_PIXEL_RATIO = 2;
/** A long frame (tab was in the background) must not teleport the streaks. */
const MAX_FRAME_SECONDS = 0.05;
const LINE_WIDTH_PX = 1.25;
const HEAD_RADIUS_PX = 1.75;
const HEAD_GLOW_PX = 10;
const MS_PER_SECOND = 1000;
/** Grid lines are 1px wide; drawing on the half pixel keeps the streak crisp. */
const HALF_PIXEL = 0.5;

function readColors(element: HTMLElement): string[] {
  const styles = getComputedStyle(element);
  return COLOR_VARIABLES.map(
    (name) => styles.getPropertyValue(name).trim() || FALLBACK_COLOR,
  );
}

function drawPulse(ctx: CanvasRenderingContext2D, pulse: Pulse) {
  const tail = pulse.head - pulse.direction * TAIL_LENGTH_PX;
  const line = pulse.line + HALF_PIXEL;
  const [x0, y0, x1, y1] =
    pulse.axis === "x"
      ? [tail, line, pulse.head, line]
      : [line, tail, line, pulse.head];

  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(1, pulse.color);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = LINE_WIDTH_PX;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.fillStyle = pulse.color;
  ctx.shadowColor = pulse.color;
  ctx.shadowBlur = HEAD_GLOW_PX;
  ctx.beginPath();
  ctx.arc(x1, y1, HEAD_RADIUS_PX, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function fitCanvas(canvas: HTMLCanvasElement): Bounds {
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const bounds = { width: canvas.offsetWidth, height: canvas.offsetHeight };
  canvas.width = bounds.width * ratio;
  canvas.height = bounds.height * ratio;
  canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return bounds;
}

/** Runs the simulation on `canvas` until the returned cleanup is called. */
function startPulses(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const colors = readColors(canvas);
  let bounds = fitCanvas(canvas);
  let pulses: Pulse[] = [];
  let frame = 0;
  let lastTime = 0;
  let sinceSpawn = 0;
  let visible = true;

  const tick = (time: number) => {
    const deltaMs = lastTime === 0 ? 0 : time - lastTime;
    lastTime = time;
    const deltaSeconds = Math.min(deltaMs / MS_PER_SECOND, MAX_FRAME_SECONDS);

    sinceSpawn += deltaMs;
    if (sinceSpawn >= SPAWN_INTERVAL_MS && pulses.length < MAX_PULSES) {
      sinceSpawn = 0;
      pulses.push(spawnPulse({ bounds, colors, random: Math.random }));
    }
    pulses = pulses
      .map((pulse) => advancePulse(pulse, deltaSeconds))
      .filter((pulse) => !hasLeft(pulse, bounds));

    ctx.clearRect(0, 0, bounds.width, bounds.height);
    for (const pulse of pulses) drawPulse(ctx, pulse);
    frame = requestAnimationFrame(tick);
  };

  const setRunning = (running: boolean) => {
    cancelAnimationFrame(frame);
    lastTime = 0;
    if (running) frame = requestAnimationFrame(tick);
  };
  const sync = () => setRunning(visible && !document.hidden);

  // Off-screen or in a background tab the loop stops entirely.
  const viewObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    sync();
  });
  const sizeObserver = new ResizeObserver(() => {
    bounds = fitCanvas(canvas);
  });
  viewObserver.observe(canvas);
  sizeObserver.observe(canvas);
  document.addEventListener("visibilitychange", sync);

  return () => {
    cancelAnimationFrame(frame);
    viewObserver.disconnect();
    sizeObserver.disconnect();
    document.removeEventListener("visibilitychange", sync);
  };
}

/**
 * Streaks of light running along the backdrop grid. Decorative: render it
 * inside an aria-hidden wrapper. Not rendered at all under reduced motion.
 */
export function GridPulses({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduced) return;
    return startPulses(canvas);
  }, [reduced]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 h-full w-full", className)}
    />
  );
}
