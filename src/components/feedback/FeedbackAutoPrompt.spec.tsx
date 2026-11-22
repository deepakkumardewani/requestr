/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_IDLE_WINDOW_MS,
  FEEDBACK_SNOOZE_MS,
} from "@/lib/feedback/eligibility";
import {
  FEEDBACK_STATE_STORAGE_KEY,
  readFeedbackState,
} from "@/lib/feedback/feedbackState";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { usePromptStore } from "@/stores/usePromptStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { FeedbackAutoPrompt } from "./FeedbackAutoPrompt";

const START = new Date("2026-06-10T12:00:00").getTime();
const IDLE = FEEDBACK_IDLE_WINDOW_MS;

const mocks = vi.hoisted(() => ({
  gateOpen: true,
  firstSession: false,
  sessionDays: ["2026-06-08", "2026-06-09", "2026-06-10"],
  tracking: true,
  track: vi.fn(),
}));

vi.mock("@/lib/prompts/useAutoPromptGate", () => ({
  useAutoPromptGate: () => mocks.gateOpen,
}));
vi.mock("@/lib/prompts/sessionTracker", () => ({
  getSessionDays: () => mocks.sessionDays,
  isFirstSession: () => mocks.firstSession,
}));
vi.mock("@/lib/analytics/adapter", () => ({
  isTrackingActive: () => mocks.tracking,
  track: mocks.track,
}));
vi.mock("@/components/feedback/FeedbackDialog", () => ({
  FeedbackDialog: ({ onDismiss }: { onDismiss?: () => void }) => {
    const open = usePromptStore((s) => s.active === "feedback");
    return open ? (
      <div role="dialog">
        <button
          type="button"
          data-testid="dismiss"
          onClick={() => {
            usePromptStore.getState().release("feedback");
            onDismiss?.();
          }}
        />
      </div>
    ) : null;
  },
}));

function seedState(
  overrides: { dismissedAt?: number; submitted?: boolean } = {},
) {
  localStorage.setItem(
    FEEDBACK_STATE_STORAGE_KEY,
    JSON.stringify({
      counters: { successfulRequests: 10, chainRuns: 0, relayActions: 0 },
      dismissedAt: null,
      submitted: false,
      ...overrides,
    }),
  );
}

const active = () => usePromptStore.getState().active;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function mount() {
  const view = render(<FeedbackAutoPrompt />);
  await advance(0);
  return view;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  localStorage.clear();
  seedState();
  mocks.gateOpen = true;
  mocks.firstSession = false;
  mocks.sessionDays = ["2026-06-08", "2026-06-09", "2026-06-10"];
  mocks.tracking = true;
  mocks.track.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  (document.activeElement as HTMLElement | null)?.blur();
  document.body.innerHTML = "";
  useResponseStore.setState({ loading: {} });
  useChainRunStore.setState({ activeRun: null });
  usePromptStore.setState({ active: null, current: null, queue: [] });
});

describe("FeedbackAutoPrompt idle detection", () => {
  it("does not open at mount: a full quiet window since mount is required", async () => {
    await mount();
    expect(active()).toBeNull();
    await advance(IDLE - 1000);
    expect(active()).toBeNull();
    await advance(1000);
    expect(active()).toBe("feedback");
  });

  it("restarts the quiet window on pointer and key activity", async () => {
    await mount();
    await advance(IDLE - 1000);
    window.dispatchEvent(new Event("keydown"));
    await advance(IDLE - 1000);
    expect(active()).toBeNull();
    window.dispatchEvent(new Event("pointermove"));
    await advance(IDLE);
    expect(active()).toBe("feedback");
  });

  it("stops listening for activity after unmount", async () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = await mount();
    unmount();
    expect(remove.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining(["pointerdown", "pointermove", "keydown"]),
    );
    remove.mockRestore();
  });

  it("waits while a request is in flight", async () => {
    useResponseStore.setState({ loading: { a: true } });
    await mount();
    await advance(IDLE * 2);
    expect(active()).toBeNull();
    useResponseStore.setState({ loading: { a: false } });
    await advance(1000);
    expect(active()).toBe("feedback");
  });

  it("waits while a chain run is in progress", async () => {
    useChainRunStore.setState({ activeRun: {} as never });
    await mount();
    await advance(IDLE * 2);
    expect(active()).toBeNull();
  });

  it("waits while a text input is focused", async () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    await mount();
    await advance(IDLE * 2);
    expect(active()).toBeNull();
    input.blur();
    await advance(1000);
    expect(active()).toBe("feedback");
  });

  it("waits while a code editor has focus", async () => {
    const editor = document.createElement("div");
    editor.className = "cm-editor";
    const inner = document.createElement("div");
    inner.tabIndex = 0;
    editor.appendChild(inner);
    document.body.appendChild(editor);
    inner.focus();
    await mount();
    await advance(IDLE * 2);
    expect(active()).toBeNull();
  });
});

describe("FeedbackAutoPrompt eligibility", () => {
  it("never prompts while the route gate is closed", async () => {
    mocks.gateOpen = false;
    await mount();
    await advance(IDLE * 2);
    expect(active()).toBeNull();
  });

  it("never prompts in the first session", async () => {
    mocks.firstSession = true;
    await mount();
    await advance(IDLE * 2);
    expect(active()).toBeNull();
  });

  it("needs three distinct session days", async () => {
    mocks.sessionDays = ["2026-06-09", "2026-06-10"];
    await mount();
    await advance(IDLE * 2);
    expect(active()).toBeNull();
  });

  it("needs enough usage", async () => {
    localStorage.removeItem(FEEDBACK_STATE_STORAGE_KEY);
    await mount();
    await advance(IDLE * 2);
    expect(active()).toBeNull();
  });

  it("stays quiet during the 30-day snooze and returns after it", async () => {
    seedState({ dismissedAt: START - FEEDBACK_SNOOZE_MS + 5000 });
    await mount();
    await advance(IDLE);
    expect(active()).toBeNull();
    await advance(5000);
    expect(active()).toBe("feedback");
  });

  it("never asks again after a submit", async () => {
    seedState({ submitted: true });
    await mount();
    await advance(IDLE * 2);
    expect(active()).toBeNull();
  });

  it("re-reads storage at show time so another tab's submit wins", async () => {
    await mount();
    seedState({ submitted: true });
    await advance(IDLE);
    expect(active()).toBeNull();
  });
});

describe("FeedbackAutoPrompt slot arbitration", () => {
  it("yields to a higher priority prompt, then shows once the slot frees", async () => {
    usePromptStore.getState().request("tour");
    await mount();
    await advance(IDLE);
    expect(active()).toBe("tour");
    usePromptStore.getState().release("tour");
    await advance(0);
    expect(active()).toBe("feedback");
  });

  it("withdraws a queued request when the user stops being idle", async () => {
    usePromptStore.getState().request("tour");
    await mount();
    await advance(IDLE);
    expect(usePromptStore.getState().queue.map((e) => e.id)).toEqual([
      "feedback",
    ]);
    useResponseStore.setState({ loading: { a: true } });
    await advance(1000);
    expect(usePromptStore.getState().queue).toEqual([]);
  });

  it("keeps the granted slot when its own dialog closes the route gate", async () => {
    const { rerender } = await mount();
    await advance(IDLE);
    expect(active()).toBe("feedback");
    mocks.gateOpen = false;
    rerender(<FeedbackAutoPrompt />);
    await advance(0);
    expect(active()).toBe("feedback");
  });

  it("releases the slot on unmount", async () => {
    const { unmount } = await mount();
    await advance(IDLE);
    unmount();
    expect(active()).toBeNull();
  });

  it("is shown at most once per session", async () => {
    await mount();
    await advance(IDLE);
    act(() => screen.getByTestId("dismiss").click());
    localStorage.clear();
    seedState();
    await advance(IDLE * 3);
    expect(active()).toBeNull();
  });
});

describe("FeedbackAutoPrompt dismissal and analytics", () => {
  it("records a 30-day snooze and an auto dismiss event", async () => {
    await mount();
    await advance(IDLE);
    expect(mocks.track).toHaveBeenCalledWith("feedback_prompt_shown", {
      trigger: "auto",
    });
    act(() => screen.getByTestId("dismiss").click());
    expect(readFeedbackState(Date.now()).dismissedAt).toBe(Date.now());
    expect(mocks.track).toHaveBeenCalledWith("feedback_prompt_dismissed", {
      trigger: "auto",
    });
  });

  it("still prompts opted-out users but emits no events", async () => {
    mocks.tracking = false;
    await mount();
    await advance(IDLE);
    expect(active()).toBe("feedback");
    act(() => screen.getByTestId("dismiss").click());
    expect(readFeedbackState(Date.now()).dismissedAt).not.toBeNull();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("menu-opened dialog tracks the menu trigger without snoozing or using the session slot", async () => {
    await mount();
    act(() => usePromptStore.getState().openUserInitiated("feedback"));
    expect(mocks.track).toHaveBeenCalledWith("feedback_prompt_shown", {
      trigger: "menu",
    });
    act(() => screen.getByTestId("dismiss").click());
    expect(readFeedbackState(Date.now()).dismissedAt).toBeNull();
    expect(mocks.track).toHaveBeenCalledWith("feedback_prompt_dismissed", {
      trigger: "menu",
    });
    await advance(IDLE);
    expect(active()).toBe("feedback");
  });
});
