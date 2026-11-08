"use client";

import { useEffect, useReducer, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  advancePlayback,
  getFinalFrame,
  getFrame,
  type PlaybackState,
  type RelayFrame,
} from "./relayDemoEngine";
import { RELAY_SCENARIOS, type RelayScenario } from "./scenarios";

export const TICK_MS = 50;
/** Fraction of the demo that must be on screen before it plays. */
const VISIBILITY_THRESHOLD = 0.3;

const INITIAL_PLAYBACK: PlaybackState = { scenarioIndex: 0, elapsedMs: 0 };

export interface RelayDemoState {
  scenario: RelayScenario;
  frame: RelayFrame;
  /** True when motion is reduced: the final frame is shown and nothing animates. */
  isStatic: boolean;
}

function playbackReducer(state: PlaybackState, deltaMs: number): PlaybackState {
  return advancePlayback(state, deltaMs, RELAY_SCENARIOS);
}

/**
 * Plays the Relay demo while the container is on screen and the tab is
 * visible. The interval exists only while playing, so nothing runs when hidden
 * or off-screen. Reduced motion returns the first scenario's final frame.
 */
export function useRelayDemo(
  containerRef: React.RefObject<HTMLElement | null>,
): RelayDemoState {
  const reduced = useReducedMotion();
  const [playback, advance] = useReducer(playbackReducer, INITIAL_PLAYBACK);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    if (reduced) return;
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: VISIBILITY_THRESHOLD },
    );
    observer.observe(container);
    const onVisibility = () => setTabVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [containerRef, reduced]);

  const playing = !reduced && inView && tabVisible;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => advance(TICK_MS), TICK_MS);
    return () => clearInterval(timer);
  }, [playing]);

  const scenario =
    RELAY_SCENARIOS[playback.scenarioIndex] ?? RELAY_SCENARIOS[0];
  if (reduced) {
    return { scenario, frame: getFinalFrame(scenario), isStatic: true };
  }
  return {
    scenario,
    frame: getFrame(scenario, playback.elapsedMs),
    isStatic: false,
  };
}
