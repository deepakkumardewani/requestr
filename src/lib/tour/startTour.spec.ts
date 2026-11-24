// @vitest-environment happy-dom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

type DriverConfig = {
  steps: { element?: () => Element; popover: Record<string, unknown> }[];
  animate: boolean;
  onPopoverRender: (
    popover: { wrapper: HTMLElement },
    opts: { driver: FakeDriver; index?: number }
  ) => void;
  onDestroyed: () => void;
};

type FakeDriver = {
  drive: Mock<() => void>;
  destroy: Mock<() => void>;
  moveNext: Mock<() => void>;
  movePrevious: Mock<() => void>;
  getActiveIndex: Mock<() => number | undefined>;
};

type PopoverProps = {
  stepIndex: number;
  isFirst: boolean;
  isLast: boolean;
  title: string;
  description: string;
  labels: Record<string, string>;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};

const mocks = vi.hoisted(() => ({
  configs: [] as unknown[],
  instances: [] as unknown[],
  toastInfo: vi.fn(),
  track: vi.fn(),
  renderTourPopover: vi.fn(),
  unmountTourPopover: vi.fn(),
  applicability: {
    isOnTourRoute: vi.fn(() => true),
    hasActiveRequestTab: vi.fn(() => true),
    hasResponsePanel: vi.fn(() => true),
    areSampleRequestsShown: vi.fn(() => true),
    isCollectionsSidebarShown: vi.fn(() => true),
    isRelayAvailable: vi.fn(() => true),
  },
}));

vi.mock("driver.js", () => ({
  driver: (config: DriverConfig) => {
    const instance = {
      drive: vi.fn(),
      destroy: vi.fn(() => config.onDestroyed()),
      moveNext: vi.fn(),
      movePrevious: vi.fn(),
      getActiveIndex: vi.fn(() => 0),
    };
    mocks.configs.push(config);
    mocks.instances.push(instance);
    return instance;
  },
}));
vi.mock("driver.js/dist/driver.css", () => ({}));
vi.mock("sonner", () => ({ toast: { info: mocks.toastInfo } }));
vi.mock("@/components/tour/TourPopover", () => ({
  renderTourPopover: mocks.renderTourPopover,
  unmountTourPopover: mocks.unmountTourPopover,
}));
vi.mock("@/lib/analytics/adapter", () => ({ track: mocks.track }));
// Applicability reads app stores and the sidebar DOM; each spec controls it directly.
vi.mock("./tourApplicability", () => mocks.applicability);
// Opening a tab is covered by ensureRequestTab.spec; here it must not touch the tabs store.
vi.mock("./ensureRequestTab", () => ({
  ensureRequestTab: vi.fn().mockResolvedValue(undefined),
}));

import { safeStorage } from "@/lib/analytics/dedupe";
import { usePromptStore } from "@/stores/usePromptStore";
import { useTourStore } from "@/stores/useTourStore";
import {
  endActiveTour,
  isTourRunning,
  MIN_TOUR_STEPS,
  ONBOARDING_COMPLETE_KEY,
  startTour,
  TOUR_ANCHOR_WAIT_MS,
} from "./startTour";
import { TOUR_ANCHORS } from "./tourAnchors";
import { TOUR_STEPS } from "./tourSteps";

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

const ANCHOR_VALUES = Object.values(TOUR_ANCHORS);

function addAnchor(anchor: string, { visible = true } = {}): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-tour", anchor);
  if (!visible) el.setAttribute("data-hidden", "true");
  document.body.appendChild(el);
  return el;
}

function addAnchors(count: number) {
  ANCHOR_VALUES.slice(0, count).forEach((anchor) => addAnchor(anchor));
}

function stepIndexOf(id: string): number {
  return TOUR_STEPS.findIndex((step) => step.id === id);
}

function anchorOf(id: string): string {
  const anchor = TOUR_STEPS[stepIndexOf(id)].anchor;
  if (!anchor) throw new Error(`step ${id} has no anchor`);
  return anchor;
}

function lastConfig(): DriverConfig {
  return mocks.configs[mocks.configs.length - 1] as DriverConfig;
}

function lastInstance(): FakeDriver {
  return mocks.instances[mocks.instances.length - 1] as FakeDriver;
}

function renderStep(index: number): PopoverProps {
  const wrapper = document.createElement("div");
  lastConfig().onPopoverRender({ wrapper }, { driver: lastInstance(), index });
  const calls = mocks.renderTourPopover.mock.calls;
  return calls[calls.length - 1][1] as PopoverProps;
}

/** Starts a tour and lets slot grant plus anchor resolution settle. */
async function startAndSettle(trigger: "auto" | "replay" = "auto") {
  const pending = startTour({ trigger, t });
  await vi.advanceTimersByTimeAsync(0);
  return pending;
}

describe("startTour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const size = this.hasAttribute("data-hidden") ? 0 : 100;
        return { width: size, height: size } as DOMRect;
      }
    );
    mocks.configs.length = 0;
    mocks.instances.length = 0;
    for (const predicate of Object.values(mocks.applicability)) {
      predicate.mockReturnValue(true);
    }
    safeStorage.remove(ONBOARDING_COMPLETE_KEY);
  });

  afterEach(() => {
    endActiveTour();
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
    mocks.toastInfo.mockClear();
    mocks.track.mockClear();
    mocks.renderTourPopover.mockClear();
    mocks.unmountTourPopover.mockClear();
    safeStorage.remove(ONBOARDING_COMPLETE_KEY);
    usePromptStore.setState({
      active: null,
      current: null,
      queue: [],
      nextSeq: 0,
    });
    useTourStore.getState().end();
  });

  it("requires at least four steps", () => {
    expect(MIN_TOUR_STEPS).toBe(4);
  });

  describe("starting", () => {
    it("shows all steps when every anchor is visible", async () => {
      addAnchors(ANCHOR_VALUES.length);
      await expect(startAndSettle()).resolves.toBe(true);

      expect(lastConfig().steps).toHaveLength(TOUR_STEPS.length);
      expect(lastInstance().drive).toHaveBeenCalledTimes(1);
      expect(isTourRunning()).toBe(true);
      expect(useTourStore.getState()).toMatchObject({
        active: true,
        trigger: "auto",
        currentStep: 0,
      });
      expect(mocks.track).toHaveBeenCalledWith("tour_started", {
        trigger: "auto",
      });
    });

    it("builds steps in definition order with translated copy", async () => {
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();

      const titles = lastConfig().steps.map((step) => step.popover.title);
      expect(titles).toEqual(
        TOUR_STEPS.map((step) => `steps.${step.id}.title`)
      );
    });

    it("keeps the centred step without an element", async () => {
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();

      const steps = lastConfig().steps;
      expect(steps[steps.length - 1].element).toBeUndefined();
      expect(steps[0].element?.()).toBe(
        document.querySelector(`[data-tour="${ANCHOR_VALUES[0]}"]`)
      );
    });

    it("falls back to the resolved element if the anchor is re-rendered away", async () => {
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();
      const original = document.querySelector(
        `[data-tour="${ANCHOR_VALUES[0]}"]`
      );
      original?.remove();
      expect(lastConfig().steps[0].element?.()).toBe(original);
    });

    it("disables animation when the user prefers reduced motion", async () => {
      window.matchMedia = vi.fn(
        () => ({ matches: true } as MediaQueryList)
      ) as typeof window.matchMedia;
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();
      expect(lastConfig().animate).toBe(false);
    });

    it("animates when matchMedia is unavailable", async () => {
      // @ts-expect-error simulate a runtime without matchMedia
      window.matchMedia = undefined;
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();
      expect(lastConfig().animate).toBe(true);
    });
  });

  describe("anchor resolution", () => {
    it("skips anchors that exist but are not visible", async () => {
      ANCHOR_VALUES.forEach((anchor, i) =>
        addAnchor(anchor, { visible: i > 0 })
      );
      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(TOUR_ANCHOR_WAIT_MS + 200);
      await pending;

      const titles = lastConfig().steps.map((step) => step.popover.title);
      expect(titles).not.toContain("steps.urlBar.title");
      expect(titles).toContain("steps.palette.title");
    });

    it("waits for late anchors within the bounded wait", async () => {
      addAnchors(MIN_TOUR_STEPS - 1);
      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(500);
      expect(mocks.configs).toHaveLength(0);

      addAnchor(ANCHOR_VALUES[MIN_TOUR_STEPS - 1]);
      ANCHOR_VALUES.slice(MIN_TOUR_STEPS).forEach((anchor) =>
        addAnchor(anchor)
      );
      await vi.advanceTimersByTimeAsync(200);
      await expect(pending).resolves.toBe(true);
      expect(lastConfig().steps).toHaveLength(TOUR_STEPS.length);
    });

    it("stops waiting after the bounded wait and starts with what resolved", async () => {
      addAnchors(MIN_TOUR_STEPS - 1);
      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(TOUR_ANCHOR_WAIT_MS + 200);
      await expect(pending).resolves.toBe(true);
      // Three anchors plus the always-resolving centred step.
      expect(lastConfig().steps).toHaveLength(MIN_TOUR_STEPS);
    });
  });

  describe("applicable steps", () => {
    it("starts without waiting once every applicable anchor is visible", async () => {
      addAnchors(ANCHOR_VALUES.length);
      const pending = startTour({ trigger: "replay", t });
      await vi.advanceTimersByTimeAsync(0);
      await expect(pending).resolves.toBe(true);
      expect(mocks.configs).toHaveLength(1);
    });

    it("drops non-applicable steps without waiting for their anchors", async () => {
      mocks.applicability.areSampleRequestsShown.mockReturnValue(false);
      mocks.applicability.isRelayAvailable.mockReturnValue(false);
      const skipped = [anchorOf("sampleRequests"), anchorOf("relay")];
      ANCHOR_VALUES.filter((anchor) => !skipped.includes(anchor)).forEach(
        (anchor) => addAnchor(anchor)
      );

      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(0);
      await expect(pending).resolves.toBe(true);

      const titles = lastConfig().steps.map((step) => step.popover.title);
      expect(titles).toHaveLength(TOUR_STEPS.length - skipped.length);
      expect(titles).not.toContain("steps.sampleRequests.title");
      expect(titles).not.toContain("steps.relay.title");
    });

    it("omits a non-applicable step even when its anchor is in the DOM", async () => {
      mocks.applicability.isRelayAvailable.mockReturnValue(false);
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();
      const titles = lastConfig().steps.map((step) => step.popover.title);
      expect(titles).not.toContain("steps.relay.title");
    });

    it("keeps waiting for an applicable anchor that is still missing", async () => {
      ANCHOR_VALUES.filter((anchor) => anchor !== anchorOf("response")).forEach(
        (anchor) => addAnchor(anchor)
      );
      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(300);
      expect(mocks.configs).toHaveLength(0);

      addAnchor(anchorOf("response"));
      await vi.advanceTimersByTimeAsync(100);
      await expect(pending).resolves.toBe(true);
      expect(lastConfig().steps).toHaveLength(TOUR_STEPS.length);
    });

    it("never settles early off the tour route (replay mid-navigation)", async () => {
      mocks.applicability.isOnTourRoute.mockReturnValue(false);
      addAnchors(ANCHOR_VALUES.length);
      const pending = startTour({ trigger: "replay", t });
      await vi.advanceTimersByTimeAsync(500);
      expect(mocks.configs).toHaveLength(0);

      mocks.applicability.isOnTourRoute.mockReturnValue(true);
      await vi.advanceTimersByTimeAsync(100);
      await expect(pending).resolves.toBe(true);
    });

    it("re-evaluates applicability on every poll", async () => {
      mocks.applicability.hasActiveRequestTab.mockReturnValue(false);
      mocks.applicability.hasResponsePanel.mockReturnValue(false);
      mocks.applicability.isOnTourRoute.mockReturnValue(false);
      addAnchors(ANCHOR_VALUES.length);
      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(200);

      mocks.applicability.hasActiveRequestTab.mockReturnValue(true);
      mocks.applicability.hasResponsePanel.mockReturnValue(true);
      mocks.applicability.isOnTourRoute.mockReturnValue(true);
      await vi.advanceTimersByTimeAsync(100);
      await expect(pending).resolves.toBe(true);
      expect(lastConfig().steps).toHaveLength(TOUR_STEPS.length);
    });
  });

  describe("too few anchors", () => {
    it("toasts, aborts, and does not mark the tour complete", async () => {
      addAnchors(MIN_TOUR_STEPS - 2);
      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(TOUR_ANCHOR_WAIT_MS + 200);

      await expect(pending).resolves.toBe(false);
      expect(mocks.toastInfo).toHaveBeenCalledWith("tooFewAnchors");
      expect(mocks.configs).toHaveLength(0);
      expect(safeStorage.get(ONBOARDING_COMPLETE_KEY)).toBeNull();
      expect(isTourRunning()).toBe(false);
      expect(useTourStore.getState().active).toBe(false);
      expect(usePromptStore.getState().active).toBeNull();
    });
  });

  describe("prompt slot", () => {
    it("waits while a higher-priority user prompt holds the slot", async () => {
      usePromptStore.getState().openUserInitiated("relay-coach");
      addAnchors(ANCHOR_VALUES.length);
      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(1000);
      expect(mocks.configs).toHaveLength(0);

      usePromptStore.getState().release("relay-coach");
      await vi.advanceTimersByTimeAsync(0);
      await expect(pending).resolves.toBe(true);
      expect(usePromptStore.getState().active).toBe("tour");
    });

    it("replay takes the slot directly, preempting an auto prompt", async () => {
      usePromptStore.getState().request("whats-new", { auto: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(usePromptStore.getState().active).toBe("whats-new");

      addAnchors(ANCHOR_VALUES.length);
      await expect(startAndSettle("replay")).resolves.toBe(true);
      expect(usePromptStore.getState().active).toBe("tour");
    });

    it("releases the slot when the tour ends", async () => {
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();
      endActiveTour();
      expect(usePromptStore.getState().active).toBeNull();
    });
  });

  describe("replay", () => {
    it("starts even when onboarding was already completed", async () => {
      safeStorage.set(ONBOARDING_COMPLETE_KEY, "true");
      addAnchors(ANCHOR_VALUES.length);
      await expect(startAndSettle("replay")).resolves.toBe(true);
      expect(useTourStore.getState().trigger).toBe("replay");
      expect(mocks.track).toHaveBeenCalledWith("tour_started", {
        trigger: "replay",
      });
    });
  });

  describe("aborting", () => {
    it("starting a second tour ends the first without marking completion", async () => {
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();
      const first = lastInstance();

      await startAndSettle("replay");
      expect(first.destroy).toHaveBeenCalledTimes(1);
      expect(mocks.track).not.toHaveBeenCalledWith(
        "tour_skipped",
        expect.anything()
      );
      expect(safeStorage.get(ONBOARDING_COMPLETE_KEY)).toBeNull();
      expect(mocks.instances).toHaveLength(2);
    });

    it("endActiveTour while waiting for anchors resolves false and never marks completion", async () => {
      addAnchors(1);
      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(300);
      endActiveTour();
      await vi.advanceTimersByTimeAsync(300);

      await expect(pending).resolves.toBe(false);
      expect(mocks.configs).toHaveLength(0);
      expect(mocks.toastInfo).not.toHaveBeenCalled();
      expect(safeStorage.get(ONBOARDING_COMPLETE_KEY)).toBeNull();
    });

    it("endActiveTour while waiting for the slot resolves false", async () => {
      usePromptStore.getState().openUserInitiated("relay-coach");
      const pending = startTour({ trigger: "auto", t });
      await vi.advanceTimersByTimeAsync(100);
      endActiveTour();
      await expect(pending).resolves.toBe(false);
      expect(mocks.configs).toHaveLength(0);
    });

    it("endActiveTour is a no-op when nothing is running", () => {
      expect(() => endActiveTour()).not.toThrow();
      expect(isTourRunning()).toBe(false);
    });

    it("unmounts the popover on teardown", async () => {
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();
      const wrapper = document.createElement("div");
      lastConfig().onPopoverRender(
        { wrapper },
        { driver: lastInstance(), index: 0 }
      );
      endActiveTour();
      expect(mocks.unmountTourPopover).toHaveBeenCalledWith(wrapper);
    });
  });

  describe("popover and navigation", () => {
    beforeEach(async () => {
      addAnchors(ANCHOR_VALUES.length);
      await startAndSettle();
    });

    it("renders the first step as first and not last, tracking the view", () => {
      const props = renderStep(0);
      expect(props).toMatchObject({
        stepIndex: 0,
        isFirst: true,
        isLast: false,
        title: "steps.urlBar.title",
        description: "steps.urlBar.body",
      });
      expect(props.labels.progress).toBe(
        `stepProgress:${JSON.stringify({
          current: 1,
          total: TOUR_STEPS.length,
        })}`
      );
      expect(mocks.track).toHaveBeenCalledWith("tour_step_viewed", {
        step_id: "url_bar",
        index: 0,
      });
      expect(useTourStore.getState().currentStep).toBe(0);
    });

    it("falls back to the driver's active index when none is passed", () => {
      lastInstance().getActiveIndex.mockReturnValue(2);
      lastConfig().onPopoverRender(
        { wrapper: document.createElement("div") },
        { driver: lastInstance() }
      );
      expect(useTourStore.getState().currentStep).toBe(2);
    });

    it("falls back to step 0 when no index is available at all", () => {
      lastInstance().getActiveIndex.mockReturnValue(undefined);
      lastConfig().onPopoverRender(
        { wrapper: document.createElement("div") },
        { driver: lastInstance() }
      );
      expect(useTourStore.getState().currentStep).toBe(0);
    });

    it("maps the sampleRequests step to the samples analytics id", () => {
      const index = stepIndexOf("sampleRequests");
      renderStep(index);
      expect(mocks.track).toHaveBeenCalledWith("tour_step_viewed", {
        step_id: "samples",
        index,
      });
    });

    it("maps the requestTabs step to the request_tabs analytics id", () => {
      const index = stepIndexOf("requestTabs");
      renderStep(index);
      expect(mocks.track).toHaveBeenCalledWith("tour_step_viewed", {
        step_id: "request_tabs",
        index,
      });
    });

    it("marks the last step as last and its Next finishes with done semantics", () => {
      const last = TOUR_STEPS.length - 1;
      const props = renderStep(last);
      expect(props.isLast).toBe(true);
      props.onNext();
      expect(lastInstance().moveNext).not.toHaveBeenCalled();
      expect(lastInstance().destroy).toHaveBeenCalledTimes(1);
      expect(mocks.track).toHaveBeenCalledWith("tour_completed", {
        steps_seen: TOUR_STEPS.length,
      });
    });

    it("Next on a middle step advances without ending", () => {
      renderStep(1).onNext();
      expect(lastInstance().moveNext).toHaveBeenCalledTimes(1);
      expect(lastInstance().destroy).not.toHaveBeenCalled();
    });

    it("Back moves to the previous step", () => {
      renderStep(2).onBack();
      expect(lastInstance().movePrevious).toHaveBeenCalledTimes(1);
    });

    it("completing marks onboarding complete and releases everything", () => {
      renderStep(TOUR_STEPS.length - 1).onNext();
      expect(safeStorage.get(ONBOARDING_COMPLETE_KEY)).toBe("true");
      expect(isTourRunning()).toBe(false);
      expect(useTourStore.getState().active).toBe(false);
      expect(usePromptStore.getState().active).toBeNull();
    });

    it("skipping reports the furthest step reached and marks complete", () => {
      renderStep(0);
      renderStep(2);
      renderStep(1);
      renderStep(1).onSkip();

      expect(mocks.track).toHaveBeenCalledWith("tour_skipped", {
        step_id: "response",
        index: 2,
      });
      expect(mocks.track).not.toHaveBeenCalledWith(
        "tour_completed",
        expect.anything()
      );
      expect(safeStorage.get(ONBOARDING_COMPLETE_KEY)).toBe("true");
    });

    it("closing via the driver's own destroy (Esc/close) counts as a skip", () => {
      renderStep(0);
      lastInstance().destroy();
      expect(mocks.track).toHaveBeenCalledWith("tour_skipped", {
        step_id: "url_bar",
        index: 0,
      });
      expect(safeStorage.get(ONBOARDING_COMPLETE_KEY)).toBe("true");
    });
  });
});
