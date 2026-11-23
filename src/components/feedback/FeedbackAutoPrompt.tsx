"use client";

import { useEffect, useRef } from "react";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { isTrackingActive, track } from "@/lib/analytics/adapter";
import {
  FEEDBACK_IDLE_WINDOW_MS,
  isFeedbackEligible,
} from "@/lib/feedback/eligibility";
import {
  readFeedbackState,
  recordFeedbackDismiss,
} from "@/lib/feedback/feedbackState";
import { getSessionDays, isFirstSession } from "@/lib/prompts/sessionTracker";
import { useAutoPromptGate } from "@/lib/prompts/useAutoPromptGate";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { usePromptStore } from "@/stores/usePromptStore";
import { useResponseStore } from "@/stores/useResponseStore";

/** Re-evaluation cadence; finer than the idle window so the prompt appears promptly once idle. */
const EVALUATE_INTERVAL_MS = FEEDBACK_IDLE_WINDOW_MS / 3;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown"] as const;
const TEXT_ENTRY_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor, .monaco-editor';

type Trigger = "auto" | "menu";

function isTextEntryFocused(): boolean {
  const active = document.activeElement;
  return (
    active instanceof Element && active.closest(TEXT_ENTRY_SELECTOR) !== null
  );
}

function isAnyRequestInFlight(): boolean {
  return Object.values(useResponseStore.getState().loading).some(Boolean);
}

/**
 * Requests the feedback slot when the user is idle and eligible (R31-R34), and
 * hosts the dialog so the menu entry points only need to open the slot.
 */
export function FeedbackAutoPrompt() {
  const gateOpen = useAutoPromptGate();
  const active = usePromptStore((s) => s.active === "feedback");
  const lastActivityAt = useRef<number | null>(null);
  const shownThisSession = useRef(false);
  const requested = useRef(false);
  const trigger = useRef<Trigger | null>(null);

  useEffect(() => {
    // Activity before mount is unobservable, so require a full quiet window since mount.
    lastActivityAt.current = Date.now();
    const onActivity = () => {
      lastActivityAt.current = Date.now();
    };
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    return () => {
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity);
      }
    };
  }, []);

  useEffect(() => {
    if (!gateOpen) return;
    const evaluate = () => {
      const store = usePromptStore.getState();
      if (store.active === "feedback") return;
      const now = Date.now();
      const eligible = isFeedbackEligible({
        sessionDays: getSessionDays(),
        isFirstSession: isFirstSession(),
        // Re-read each time: another tab may have dismissed or submitted.
        state: readFeedbackState(now),
        shownThisSession: shownThisSession.current,
        idle: {
          requestInFlight: isAnyRequestInFlight(),
          chainRunning: useChainRunStore.getState().activeRun !== null,
          inputFocused: isTextEntryFocused(),
          lastActivityAt: lastActivityAt.current,
        },
        now,
      });
      if (eligible && !requested.current) {
        requested.current = true;
        store.request("feedback", { priority: 0, auto: true });
      } else if (!eligible && requested.current) {
        requested.current = false;
        store.release("feedback");
      }
    };
    evaluate();
    const timer = setInterval(evaluate, EVALUATE_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      // The gate closes while our own dialog is open (it counts as a modal
      // dialog); a granted prompt must stay until the user closes it.
      if (
        requested.current &&
        usePromptStore.getState().active !== "feedback"
      ) {
        requested.current = false;
        usePromptStore.getState().release("feedback");
      }
    };
  }, [gateOpen]);

  useEffect(
    () => () => {
      if (requested.current) usePromptStore.getState().release("feedback");
    },
    [],
  );

  useEffect(() => {
    if (!active) return;
    const isAuto = usePromptStore.getState().current?.auto === true;
    trigger.current = isAuto ? "auto" : "menu";
    if (isAuto) shownThisSession.current = true;
    if (isTrackingActive()) {
      track("feedback_prompt_shown", { trigger: trigger.current });
    }
  }, [active]);

  const handleDismiss = () => {
    if (trigger.current === "auto") recordFeedbackDismiss();
    if (trigger.current && isTrackingActive()) {
      track("feedback_prompt_dismissed", { trigger: trigger.current });
    }
  };

  return <FeedbackDialog onDismiss={handleDismiss} />;
}
