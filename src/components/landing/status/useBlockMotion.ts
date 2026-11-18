"use client";

import { type RefObject, useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  bandProgress,
  blockAngles,
  FLIP_REST_DEG,
  pointerOffset,
  TILT_END_DEG,
} from "./flip";

/** Only devices with a real hover pointer get the pointer tilt. */
const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const NOTHING_TO_UNDO = () => undefined;

function writeAngles(
  stage: HTMLElement,
  angles: { rotateX: number; rotateY: number; flip: number },
) {
  stage.style.setProperty("--rx", `${angles.rotateX}deg`);
  stage.style.setProperty("--ry", `${angles.rotateY}deg`);
  stage.style.setProperty("--flip", String(angles.flip));
}

/** Scroll drives the angle, one rAF per frame at most. Returns the unsubscribe. */
function followScroll(band: HTMLElement, stage: HTMLElement): () => void {
  let frame = 0;
  const update = () => {
    frame = 0;
    const progress = bandProgress(
      band.getBoundingClientRect(),
      window.innerHeight,
    );
    writeAngles(stage, blockAngles(progress));
  };
  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

/** Pointer position over the band nudges the block; leaving recentres it. */
function followPointer(band: HTMLElement, stage: HTMLElement): () => void {
  if (!window.matchMedia(HOVER_QUERY).matches) return NOTHING_TO_UNDO;
  const move = (event: PointerEvent) => {
    const offset = pointerOffset(
      { x: event.clientX, y: event.clientY },
      band.getBoundingClientRect(),
    );
    stage.style.setProperty("--px", String(offset.x));
    stage.style.setProperty("--py", String(offset.y));
  };
  const leave = () => {
    stage.style.setProperty("--px", "0");
    stage.style.setProperty("--py", "0");
  };
  band.addEventListener("pointermove", move, { passive: true });
  band.addEventListener("pointerleave", leave);
  return () => {
    band.removeEventListener("pointermove", move);
    band.removeEventListener("pointerleave", leave);
  };
}

/** Listens only while the band is on screen, so the block costs nothing elsewhere. */
function whileVisible(band: HTMLElement, stage: HTMLElement): () => void {
  let stop: (() => void) | null = null;
  const halt = () => {
    stop?.();
    stop = null;
    stage.removeAttribute("data-live");
  };
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return halt();
    if (stop) return;
    const stopScroll = followScroll(band, stage);
    const stopPointer = followPointer(band, stage);
    stop = () => {
      stopScroll();
      stopPointer();
    };
    // will-change only while it is actually moving.
    stage.setAttribute("data-live", "");
  });
  observer.observe(band);
  return () => {
    observer.disconnect();
    halt();
  };
}

/** Rotates the extruded code with scroll and pointer; parks it when motion is reduced. */
export function useBlockMotion(
  bandRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
): void {
  const reduced = useReducedMotion();

  useEffect(() => {
    const band = bandRef.current;
    const stage = stageRef.current;
    if (!band || !stage) return;
    if (reduced) {
      writeAngles(stage, {
        rotateX: TILT_END_DEG,
        rotateY: FLIP_REST_DEG,
        flip: 1,
      });
      return;
    }
    return whileVisible(band, stage);
  }, [bandRef, stageRef, reduced]);
}
