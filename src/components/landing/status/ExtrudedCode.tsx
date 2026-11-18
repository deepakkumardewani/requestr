import type { CSSProperties } from "react";
import { FLIP_START_DEG, TILT_START_DEG } from "./flip";

/** Slices per face: enough for a solid edge, few enough to stay at 60fps. */
const LAYER_COUNT = 12;
/** Gap between slices; the text stroke below fills it so the edge has no stripes. */
const LAYER_STEP_PX = 2;
const HALF_DEPTH_PX = ((LAYER_COUNT - 1) * LAYER_STEP_PX) / 2;
/** Brightness of the slice right behind the face, and of the deepest one. */
const DEPTH_SHADE = { near: 62, far: 18 } as const;
const PERSPECTIVE_PX = 1100;
/** How far the pointer can nudge the block, on top of the scroll angle. */
const POINTER_TILT = { x: "7deg", y: "11deg" } as const;

const LAYERS = Array.from({ length: LAYER_COUNT }, (_, index) => index);

interface FaceProps {
  text: string;
  /** The family colour this face is lit with. */
  color: string;
  /** Pale top of the face gradient, the "light" hitting it from above. */
  highlight: string;
  /** The 200 face sits on the far side, turned to face backwards. */
  back?: boolean;
}

function sliceShade(index: number): number {
  const t = (index - 1) / Math.max(1, LAYER_COUNT - 2);
  return Math.round(
    DEPTH_SHADE.near + (DEPTH_SHADE.far - DEPTH_SHADE.near) * t,
  );
}

function sliceStyle(index: number, face: FaceProps): CSSProperties {
  const z = HALF_DEPTH_PX - index * LAYER_STEP_PX;
  const transform = `${face.back ? "rotateY(180deg) " : ""}translateZ(${z}px)`;
  if (index === 0) {
    return {
      transform,
      backgroundImage: `linear-gradient(175deg, ${face.highlight} 8%, ${face.color} 58%, color-mix(in oklab, ${face.color} 70%, black))`,
    };
  }
  const shade = `color-mix(in oklab, ${face.color} ${sliceShade(index)}%, black)`;
  return {
    transform,
    color: shade,
    WebkitTextStroke: `${LAYER_STEP_PX}px ${shade}`,
  };
}

/** One printed face of the block, extruded backwards as a stack of slices. */
function Face(face: FaceProps) {
  return LAYERS.map((index) => (
    <span
      key={index}
      style={sliceStyle(index, face)}
      className={
        index === 0
          ? "absolute inset-0 bg-clip-text text-center text-transparent [backface-visibility:hidden]"
          : "absolute inset-0 text-center [backface-visibility:hidden]"
      }
    >
      {face.text}
    </span>
  ));
}

const BLOCK_TRANSFORM = [
  `rotateX(calc(var(--rx, ${TILT_START_DEG}deg) + var(--py, 0) * ${POINTER_TILT.x} * -1))`,
  `rotateY(calc(var(--ry, ${FLIP_START_DEG}deg) + var(--px, 0) * ${POINTER_TILT.y}))`,
].join(" ");

interface ExtrudedCodeProps {
  from: FaceProps;
  to: FaceProps;
}

/**
 * Two status codes printed on the front and back of one solid CSS 3D block.
 * Turning it past edge-on swaps which code you read. It reads --rx, --ry,
 * --px and --py from an ancestor (see useBlockMotion). Purely visual: the
 * band states both codes in text.
 */
export function ExtrudedCode({ from, to }: ExtrudedCodeProps) {
  return (
    <div
      aria-hidden="true"
      style={{ perspective: `${PERSPECTIVE_PX}px` }}
      className="relative grid place-items-center py-6 select-none"
    >
      <div
        style={{ transform: BLOCK_TRANSFORM }}
        className="relative grid font-display text-[clamp(6rem,19vw,12.5rem)] leading-none font-black tracking-tight transition-transform duration-150 ease-out [transform-style:preserve-3d] group-data-[live]/stage:will-change-transform"
      >
        <span className="invisible col-start-1 row-start-1">{from.text}</span>
        <span className="invisible col-start-1 row-start-1">{to.text}</span>
        <Face {...from} />
        <Face {...to} back />
      </div>
    </div>
  );
}
