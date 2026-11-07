"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { ReducedMotionSetting } from "@/types";

const QUERY = "(prefers-reduced-motion: reduce)";
/** Read by `globals.css`; absent while the setting follows the OS. */
export const REDUCED_MOTION_ATTRIBUTE = "data-reduced-motion";

/** The setting's final answer: an explicit override wins over the OS preference. */
export function resolveReducedMotion(
  setting: ReducedMotionSetting,
  systemPrefersReduced: boolean,
): boolean {
  return setting === "system" ? systemPrefersReduced : setting === "on";
}

/**
 * Returns true when motion should be reduced: the user's override from
 * Settings, or the OS preference while the override is `system`.
 * All animated components must render a static fallback when this is true.
 * Also mirrors the override onto `<html>` so plain CSS can follow it.
 */
export function useReducedMotion(): boolean {
  const setting = useSettingsStore((s) => s.reducedMotion);
  // Starts false so the server HTML and the first client render match; the
  // real OS preference is read in the effect below.
  const [systemPrefersReduced, setSystemPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    setSystemPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) =>
      setSystemPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (setting === "system") root.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
    else root.setAttribute(REDUCED_MOTION_ATTRIBUTE, setting);
  }, [setting]);

  return resolveReducedMotion(setting, systemPrefersReduced);
}
