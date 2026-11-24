import { type Driver, type DriveStep, driver } from "driver.js";
import "driver.js/dist/driver.css";
import { toast } from "sonner";
import {
  renderTourPopover,
  unmountTourPopover,
} from "@/components/tour/TourPopover";
import { track } from "@/lib/analytics/adapter";
import { safeStorage } from "@/lib/analytics/dedupe";
import type { TOUR_STEP_IDS } from "@/lib/analytics/events";
import { usePromptStore } from "@/stores/usePromptStore";
import { type TourTrigger, useTourStore } from "@/stores/useTourStore";
import { ensureRequestTab } from "./ensureRequestTab";
import { tourAnchorSelector } from "./tourAnchors";
import { isOnTourRoute } from "./tourApplicability";
import {
  TOUR_STEPS,
  type TourStepDefinition,
  type TourStepId,
} from "./tourSteps";

export const MIN_TOUR_STEPS = 4;
export const TOUR_ANCHOR_WAIT_MS = 3000;
export const ONBOARDING_COMPLETE_KEY = "rq_onboarding_complete";

const ONBOARDING_COMPLETE_VALUE = "true";
// Each poll is a handful of querySelector calls, so a short interval keeps start latency low.
const ANCHOR_POLL_MS = 50;
const TOUR_PROMPT_ID = "tour";
const STAGE_PADDING_PX = 6;
const STAGE_RADIUS_PX = 8;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type TourTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

type StartTourOptions = {
  trigger: TourTrigger;
  t: TourTranslator;
};

type ResolvedStep = {
  definition: TourStepDefinition;
  element: Element | null;
};

type TourRun = {
  trigger: TourTrigger;
  abort: AbortController;
  instance: Driver | null;
  popover: HTMLElement | null;
  /** Highest step index shown, so completion reports how far the user got. */
  furthestStep: number;
  finished: boolean;
};

/** Allowlisted analytics ids differ from the copy keys for some steps. */
const ANALYTICS_STEP_ID: Record<TourStepId, (typeof TOUR_STEP_IDS)[number]> = {
  urlBar: "url_bar",
  requestTabs: "request_tabs",
  response: "response",
  sampleRequests: "samples",
  collections: "collections",
  save: "save",
  environments: "environments",
  chains: "chains",
  relay: "relay",
  palette: "palette",
};

let activeRun: TourRun | null = null;

function isVisible(element: Element): boolean {
  if (!element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function resolveStep(definition: TourStepDefinition): ResolvedStep | null {
  if (definition.anchor === null) return { definition, element: null };
  const element = document.querySelector(tourAnchorSelector(definition.anchor));
  return element && isVisible(element) ? { definition, element } : null;
}

type AnchorSnapshot = {
  resolved: ResolvedStep[];
  /** Every applicable anchor is visible on the tour route, so waiting longer gains nothing. */
  complete: boolean;
};

/** Re-evaluated on every poll: hydration and route changes alter which steps apply. */
function snapshotAnchors(): AnchorSnapshot {
  const applicable = TOUR_STEPS.filter(
    (definition) => definition.isApplicable?.() ?? true,
  );
  const resolved = applicable.flatMap(
    (definition) => resolveStep(definition) ?? [],
  );
  // Off the route (a replay mid-navigation) nothing applies yet, so never settle early there.
  const complete = isOnTourRoute() && resolved.length === applicable.length;
  return { resolved, complete };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waits until every applicable anchor is visible, the bounded wait elapses, or the run is aborted. */
async function waitForAnchors(signal: AbortSignal): Promise<ResolvedStep[]> {
  const deadline = Date.now() + TOUR_ANCHOR_WAIT_MS;
  let snapshot = snapshotAnchors();
  while (!snapshot.complete && Date.now() < deadline && !signal.aborted) {
    await sleep(ANCHOR_POLL_MS);
    snapshot = snapshotAnchors();
  }
  return snapshot.resolved;
}

function claimSlot(trigger: TourTrigger): void {
  const prompts = usePromptStore.getState();
  if (trigger === "replay") prompts.openUserInitiated(TOUR_PROMPT_ID);
  else prompts.request(TOUR_PROMPT_ID, { auto: true });
}

function waitForSlot(signal: AbortSignal): Promise<boolean> {
  const granted = () => usePromptStore.getState().active === TOUR_PROMPT_ID;
  if (granted()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const settle = () => {
      if (!granted() && !signal.aborted) return;
      unsubscribe();
      resolve(granted() && !signal.aborted);
    };
    const unsubscribe = usePromptStore.subscribe(settle);
    signal.addEventListener("abort", settle, { once: true });
  });
}

function markComplete(): void {
  safeStorage.set(ONBOARDING_COMPLETE_KEY, ONBOARDING_COMPLETE_VALUE);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

/** Releases everything a run holds; safe to call more than once. */
function teardown(run: TourRun): void {
  if (activeRun === run) activeRun = null;
  run.abort.abort();
  const instance = run.instance;
  run.instance = null;
  instance?.destroy();
  if (run.popover) unmountTourPopover(run.popover);
  run.popover = null;
  usePromptStore.getState().release(TOUR_PROMPT_ID);
  useTourStore.getState().end();
}

export function isTourRunning(): boolean {
  return activeRun !== null;
}

export function endActiveTour(): void {
  if (activeRun) teardown(activeRun);
}

function toDriveStep(
  { definition, element }: ResolvedStep,
  t: TourTranslator,
): DriveStep {
  const anchor = definition.anchor;
  return {
    element:
      anchor && element
        ? () => document.querySelector(tourAnchorSelector(anchor)) ?? element
        : undefined,
    popover: {
      title: t(`steps.${definition.id}.title`),
      description: t(`steps.${definition.id}.body`),
      side: definition.side,
      align: "start",
    },
  };
}

function trackTourEnd(run: TourRun, steps: ResolvedStep[]): void {
  if (run.finished) {
    track("tour_completed", { steps_seen: run.furthestStep + 1 });
    return;
  }
  const stepIndex = run.furthestStep;
  track("tour_skipped", {
    step_id: ANALYTICS_STEP_ID[steps[stepIndex].definition.id],
    index: stepIndex,
  });
}

function createDriver(
  run: TourRun,
  steps: ResolvedStep[],
  t: TourTranslator,
): Driver {
  return driver({
    steps: steps.map((step) => toDriveStep(step, t)),
    animate: !prefersReducedMotion(),
    smoothScroll: false,
    overlayClickBehavior: "none",
    stagePadding: STAGE_PADDING_PX,
    stageRadius: STAGE_RADIUS_PX,
    onPopoverRender: (popover, { driver: instance, index }) => {
      const stepIndex = index ?? instance.getActiveIndex() ?? 0;
      const isLast = stepIndex === steps.length - 1;
      run.popover = popover.wrapper;
      useTourStore.getState().setStep(stepIndex);
      run.furthestStep = Math.max(run.furthestStep, stepIndex);
      track("tour_step_viewed", {
        step_id: ANALYTICS_STEP_ID[steps[stepIndex].definition.id],
        index: stepIndex,
      });
      renderTourPopover(popover.wrapper, {
        title: t(`steps.${steps[stepIndex].definition.id}.title`),
        description: t(`steps.${steps[stepIndex].definition.id}.body`),
        stepIndex,
        isFirst: stepIndex === 0,
        isLast,
        labels: {
          progress: t("stepProgress", {
            current: stepIndex + 1,
            total: steps.length,
          }),
          back: t("back"),
          next: t("next"),
          done: t("done"),
          skip: t("skip"),
          close: t("close"),
        },
        onBack: () => instance.movePrevious(),
        onNext: () => {
          if (!isLast) return instance.moveNext();
          run.finished = true;
          instance.destroy();
        },
        onSkip: () => instance.destroy(),
      });
    },
    // Fires for done, skip, close and Esc; teardown-initiated destroys are already aborted.
    onDestroyed: () => {
      if (run.abort.signal.aborted) return;
      run.instance = null;
      trackTourEnd(run, steps);
      // Replay is not a first-run completion; it must not touch the flag.
      if (run.trigger === "auto") markComplete();
      teardown(run);
    },
  });
}

/**
 * Starts the first-run (or replay) tour. Resolves true when the tour is showing.
 * Auto-start never marks completion when it aborts, so the next visit retries.
 */
export async function startTour({
  trigger,
  t,
}: StartTourOptions): Promise<boolean> {
  endActiveTour();
  const run: TourRun = {
    trigger,
    abort: new AbortController(),
    instance: null,
    popover: null,
    furthestStep: 0,
    finished: false,
  };
  activeRun = run;
  claimSlot(trigger);

  // Anchors are awaited after claiming the slot so lower-priority prompts cannot take it first.
  if (!(await waitForSlot(run.abort.signal))) return false;
  await ensureRequestTab(run.abort.signal, TOUR_ANCHOR_WAIT_MS);
  const steps = await waitForAnchors(run.abort.signal);
  if (run.abort.signal.aborted) return false;

  if (steps.length < MIN_TOUR_STEPS) {
    toast.info(t("tooFewAnchors"));
    teardown(run);
    return false;
  }

  useTourStore.getState().begin(trigger);
  track("tour_started", { trigger });
  run.instance = createDriver(run, steps, t);
  run.instance.drive();
  return true;
}
