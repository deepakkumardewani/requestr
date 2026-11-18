/**
 * Simulation for the grid backdrop: short streaks that travel along the grid
 * lines the way a request travels a wire. Pure, so it is testable without a
 * canvas.
 */

export const GRID_CELL_PX = 48;
export const TAIL_LENGTH_PX = 160;
const MIN_SPEED_PX_PER_S = 110;
const MAX_SPEED_PX_PER_S = 260;

export type PulseAxis = "x" | "y";

export interface Pulse {
  axis: PulseAxis;
  /** Fixed coordinate of the grid line being travelled, in CSS pixels. */
  line: number;
  /** Head position along the axis. */
  head: number;
  /** +1 travels right or down, -1 left or up. */
  direction: 1 | -1;
  speed: number;
  color: string;
}

export interface Bounds {
  width: number;
  height: number;
}

interface SpawnOptions {
  bounds: Bounds;
  colors: readonly string[];
  /** Returns a number in [0, 1); injected so tests are deterministic. */
  random: () => number;
}

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)] as T;

/** A new pulse entering from an edge on a random grid line. */
export function spawnPulse({ bounds, colors, random }: SpawnOptions): Pulse {
  const axis: PulseAxis = random() < 0.5 ? "x" : "y";
  const span = axis === "x" ? bounds.width : bounds.height;
  const crossSpan = axis === "x" ? bounds.height : bounds.width;
  const lineCount = Math.max(1, Math.floor(crossSpan / GRID_CELL_PX));
  const direction = random() < 0.5 ? 1 : -1;
  return {
    axis,
    line: Math.floor(random() * lineCount) * GRID_CELL_PX,
    head: direction === 1 ? 0 : span,
    direction,
    speed:
      MIN_SPEED_PX_PER_S + random() * (MAX_SPEED_PX_PER_S - MIN_SPEED_PX_PER_S),
    color: pick(colors, random),
  };
}

/** Moves a pulse forward by `deltaSeconds`. */
export function advancePulse(pulse: Pulse, deltaSeconds: number): Pulse {
  return {
    ...pulse,
    head: pulse.head + pulse.direction * pulse.speed * deltaSeconds,
  };
}

/** True once the whole streak, tail included, has left the canvas. */
export function hasLeft(pulse: Pulse, bounds: Bounds): boolean {
  const span = pulse.axis === "x" ? bounds.width : bounds.height;
  return pulse.direction === 1
    ? pulse.head - TAIL_LENGTH_PX > span
    : pulse.head + TAIL_LENGTH_PX < 0;
}
