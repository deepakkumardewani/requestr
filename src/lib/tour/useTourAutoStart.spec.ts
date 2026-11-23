// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/app",
  running: false,
  startTour: vi.fn(async () => true),
  endActiveTour: vi.fn(),
  translate: vi.fn((key: string) => `t:${key}`),
}));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("next-intl", () => ({ useTranslations: () => mocks.translate }));
vi.mock("./startTour", () => ({
  ONBOARDING_COMPLETE_KEY: "rq_onboarding_complete",
  isTourRunning: () => mocks.running,
  startTour: mocks.startTour,
  endActiveTour: mocks.endActiveTour,
}));

import { safeStorage } from "@/lib/analytics/dedupe";
import {
  shouldAutoStartTour,
  TOUR_MIN_VIEWPORT_PX,
  useTourAutoStart,
} from "./useTourAutoStart";

type E2EWindow = Window & { __RQ_TOUR_E2E__?: boolean };

function setWebdriver(value: boolean) {
  Object.defineProperty(navigator, "webdriver", {
    value,
    configurable: true,
  });
}

describe("tour auto-start", () => {
  beforeEach(() => {
    mocks.pathname = "/app";
    mocks.running = false;
    mocks.startTour.mockClear();
    mocks.endActiveTour.mockClear();
    safeStorage.remove("rq_onboarding_complete");
    window.innerWidth = 1280;
    setWebdriver(false);
    delete (window as E2EWindow).__RQ_TOUR_E2E__;
  });

  afterEach(() => {
    safeStorage.remove("rq_onboarding_complete");
    delete (window as E2EWindow).__RQ_TOUR_E2E__;
  });

  describe("shouldAutoStartTour", () => {
    it("allows a fresh desktop profile", () => {
      expect(shouldAutoStartTour()).toBe(true);
    });

    it("blocks below the desktop breakpoint", () => {
      window.innerWidth = TOUR_MIN_VIEWPORT_PX - 1;
      expect(shouldAutoStartTour()).toBe(false);
    });

    it("allows exactly at the breakpoint", () => {
      window.innerWidth = TOUR_MIN_VIEWPORT_PX;
      expect(shouldAutoStartTour()).toBe(true);
    });

    it("blocks once onboarding is complete", () => {
      safeStorage.set("rq_onboarding_complete", "true");
      expect(shouldAutoStartTour()).toBe(false);
    });

    it("is suppressed under webdriver automation", () => {
      setWebdriver(true);
      expect(shouldAutoStartTour()).toBe(false);
    });

    it("lets a spec opt back in with __RQ_TOUR_E2E__ under webdriver", () => {
      setWebdriver(true);
      (window as E2EWindow).__RQ_TOUR_E2E__ = true;
      expect(shouldAutoStartTour()).toBe(true);
    });

    it("keeps the opt-in from overriding the completion flag", () => {
      setWebdriver(true);
      (window as E2EWindow).__RQ_TOUR_E2E__ = true;
      safeStorage.set("rq_onboarding_complete", "true");
      expect(shouldAutoStartTour()).toBe(false);
    });
  });

  describe("useTourAutoStart", () => {
    it("starts an auto tour on /app", () => {
      renderHook(() => useTourAutoStart());
      expect(mocks.startTour).toHaveBeenCalledTimes(1);
      expect(mocks.startTour).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: "auto" })
      );
    });

    it("passes a translator that forwards key and values", () => {
      renderHook(() => useTourAutoStart());
      const [{ t }] = mocks.startTour.mock.calls[0] as unknown as [
        { t: (key: string, values?: Record<string, number>) => string }
      ];
      expect(t("stepProgress", { current: 1 })).toBe("t:stepProgress");
      expect(mocks.translate).toHaveBeenCalledWith("stepProgress", {
        current: 1,
      });
    });

    it("does nothing on other routes", () => {
      mocks.pathname = "/settings";
      renderHook(() => useTourAutoStart());
      expect(mocks.startTour).not.toHaveBeenCalled();
    });

    it("does nothing when a tour is already running", () => {
      mocks.running = true;
      renderHook(() => useTourAutoStart());
      expect(mocks.startTour).not.toHaveBeenCalled();
    });

    it("does nothing when gating blocks it", () => {
      safeStorage.set("rq_onboarding_complete", "true");
      renderHook(() => useTourAutoStart());
      expect(mocks.startTour).not.toHaveBeenCalled();
    });

    it("ends the tour on unmount after starting", () => {
      const { unmount } = renderHook(() => useTourAutoStart());
      unmount();
      expect(mocks.endActiveTour).toHaveBeenCalledTimes(1);
    });

    it("ends an already-running tour (e.g. replay) when mounted off /app", () => {
      mocks.pathname = "/settings";
      mocks.running = true;
      renderHook(() => useTourAutoStart());
      expect(mocks.endActiveTour).toHaveBeenCalledTimes(1);
      expect(mocks.startTour).not.toHaveBeenCalled();
    });

    it("ends a running replay tour when the route leaves /app", () => {
      mocks.running = true;
      const { rerender } = renderHook(() => useTourAutoStart());
      expect(mocks.endActiveTour).not.toHaveBeenCalled();
      mocks.pathname = "/settings";
      rerender();
      expect(mocks.endActiveTour).toHaveBeenCalledTimes(1);
    });

    it("ends the tour when the route changes away from /app", () => {
      const { rerender } = renderHook(() => useTourAutoStart());
      mocks.pathname = "/settings";
      rerender();
      expect(mocks.endActiveTour).toHaveBeenCalled();
      expect(mocks.startTour).toHaveBeenCalledTimes(1);
    });
  });
});
