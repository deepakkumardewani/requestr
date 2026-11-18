/** Front face (401) turned a little away, as if caught mid-thought. */
export const FLIP_START_DEG = -24;
/** Back face (200) turned the same amount the other way. */
export const FLIP_END_DEG = 180 + 24;
/** Where the block rests when motion is reduced: the 200 face, slightly turned. */
export const FLIP_REST_DEG = 180 - 18;
/** Looks down on the block as it arrives and levels out as it leaves. */
export const TILT_START_DEG = 16;
export const TILT_END_DEG = 6;
/** The flip happens while the band crosses the middle of the viewport. */
const FLIP_WINDOW = { from: 0.34, to: 0.66 } as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * How far the band has travelled through the viewport: 0 as its top enters
 * at the bottom, 1 as its bottom leaves at the top.
 */
export function bandProgress(
  rect: { top: number; height: number },
  viewportHeight: number,
): number {
  const travel = viewportHeight + rect.height;
  return travel > 0 ? clamp01((viewportHeight - rect.top) / travel) : 0;
}

/** 0 while the 401 face holds, easing to 1 once the 200 face has landed. */
export function flipAmount(progress: number): number {
  const { from, to } = FLIP_WINDOW;
  return smoothstep(clamp01((progress - from) / (to - from)));
}

export interface BlockAngles {
  rotateX: number;
  rotateY: number;
  /** 0-1, for anything that crossfades with the flip (glow, shadow). */
  flip: number;
}

/** The block's rotation for a scroll position through the band. */
export function blockAngles(progress: number): BlockAngles {
  const flip = flipAmount(progress);
  return {
    rotateX: lerp(TILT_START_DEG, TILT_END_DEG, clamp01(progress)),
    rotateY: lerp(FLIP_START_DEG, FLIP_END_DEG, flip),
    flip,
  };
}

/** Pointer position over an element as -1..1 on each axis, 0 at the centre. */
export function pointerOffset(
  point: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const toUnit = (value: number) => clamp01(value) * 2 - 1;
  return {
    x: rect.width > 0 ? toUnit((point.x - rect.left) / rect.width) : 0,
    y: rect.height > 0 ? toUnit((point.y - rect.top) / rect.height) : 0,
  };
}
