// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_TOAST_DURATION_MS,
  FeedbackSuccessToast,
  showFeedbackSuccessToast,
} from "./FeedbackSuccessToast";

const mocks = vi.hoisted(() => ({ toastCustom: vi.fn() }));

vi.mock("next-intl", async () => {
  const { translateFeedback } = await import("./feedbackTestI18n");
  return { useTranslations: () => translateFeedback };
});

vi.mock("sonner", () => ({ toast: { custom: mocks.toastCustom } }));

afterEach(() => {
  cleanup();
  mocks.toastCustom.mockReset();
});

describe("FeedbackSuccessToast", () => {
  it.each([
    [1, "Thanks for being honest. It helps us fix things."],
    [2, "Thanks for being honest. It helps us fix things."],
    [3, "Thanks, this helps us improve."],
    [4, "Thanks, this helps us improve."],
    [5, "Thanks — that made our day."],
  ])("thanks a %s-star rating with fitting copy", (rating, copy) => {
    render(<FeedbackSuccessToast rating={rating} />);
    const toast = screen.getByTestId("feedback-success-toast");
    expect(toast.textContent).toBe(copy);
  });

  it("adds a reply subline only when an email was given", () => {
    render(<FeedbackSuccessToast rating={5} email="me@example.com" />);
    expect(screen.getByText("We'll reply to me@example.com.")).toBeTruthy();
    cleanup();
    render(<FeedbackSuccessToast rating={5} />);
    expect(screen.queryByText(/We'll reply to/)).toBeNull();
  });

  it("renders a check that is fully drawn when motion is off", () => {
    render(<FeedbackSuccessToast rating={4} />);
    const path = screen.getByTestId("feedback-success-toast").querySelector("path")!;
    expect(path.getAttribute("pathLength")).toBe("1");
    expect(path.getAttribute("stroke-dasharray")).toBe("1");
    expect(path.getAttribute("class")).toMatch(/^motion-safe:animate-\[check-draw/);
  });

  it("shows itself through sonner's custom toast with a fixed duration", () => {
    showFeedbackSuccessToast({ rating: 3, email: "me@example.com" });
    expect(mocks.toastCustom).toHaveBeenCalledWith(expect.any(Function), {
      duration: FEEDBACK_TOAST_DURATION_MS,
    });
    const element = mocks.toastCustom.mock.calls[0][0]();
    expect(element.props).toEqual({ rating: 3, email: "me@example.com" });
  });
});
