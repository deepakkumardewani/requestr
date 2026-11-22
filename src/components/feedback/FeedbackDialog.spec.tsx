// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAnalyticsForTests } from "@/lib/analytics/adapter";
import {
  FEEDBACK_STATE_STORAGE_KEY,
  readFeedbackState,
} from "@/lib/feedback/feedbackState";
import enCommon from "../../../messages/en/common.json";
import { usePromptStore } from "@/stores/usePromptStore";
import { FeedbackDialog } from "./FeedbackDialog";

const mocks = vi.hoisted(() => ({
  configured: true,
  trackingActive: false,
  track: vi.fn(),
}));

// The global next-intl stub only knows top-level namespaces; resolve the nested one from the real catalog.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) => {
    const messages = enCommon.feedback as Record<string, string>;
    return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
      String(values?.[name]),
    );
  },
}));

vi.mock("@/providers/AppProviders", () => ({
  useFeedbackSurveyConfigured: () => mocks.configured,
}));

vi.mock("@/lib/analytics/adapter", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/analytics/adapter")
  >("@/lib/analytics/adapter");
  return {
    ...actual,
    isTrackingActive: () => mocks.trackingActive,
    track: mocks.track,
  };
});

const fetchMock = vi.fn();

function openDialog() {
  act(() => usePromptStore.getState().openUserInitiated("feedback"));
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
}

function sentEvents(): Array<{ name: string; props: Record<string, unknown> }> {
  const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
  return body.events;
}

beforeEach(() => {
  mocks.configured = true;
  mocks.trackingActive = false;
  window.__RQ_ANALYTICS_E2E__ = true;
  fetchMock.mockResolvedValue({ status: 200 });
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  usePromptStore.setState({ active: null, current: null, queue: [] });
});

afterEach(() => {
  cleanup();
  resetAnalyticsForTests();
  delete window.__RQ_ANALYTICS_E2E__;
  fetchMock.mockReset();
  mocks.track.mockReset();
  vi.unstubAllGlobals();
});

describe("FeedbackDialog", () => {
  it("renders nothing until the feedback prompt slot is active", () => {
    render(<FeedbackDialog />);
    expect(screen.queryByTestId("feedback-dialog")).toBeNull();
    openDialog();
    expect(screen.getByTestId("feedback-dialog")).toBeTruthy();
  });

  it("requires a rating and sends nothing without one", async () => {
    render(<FeedbackDialog />);
    openDialog();
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Choose a rating to continue.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks only the chosen rating as checked", () => {
    render(<FeedbackDialog />);
    openDialog();
    fireEvent.click(screen.getByTestId("feedback-rating-4"));
    expect(
      screen.getByTestId("feedback-rating-4").getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByTestId("feedback-rating-3").getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("blocks an invalid email inline and keeps the dialog open", async () => {
    render(<FeedbackDialog />);
    openDialog();
    fireEvent.click(screen.getByTestId("feedback-rating-4"));
    const email = screen.getByPlaceholderText("you@example.com");
    fireEvent.change(email, { target: { value: "not-an-email" } });
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Enter a valid email address.",
    );
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("feedback-dialog")).toBeTruthy();
  });

  it("is disabled with an explanation when feedback is not configured", () => {
    mocks.configured = false;
    render(<FeedbackDialog />);
    openDialog();
    expect(screen.getByTestId("feedback-unconfigured").textContent).toBe(
      "Feedback isn't available in this build.",
    );
    const button = screen.getByRole("button", {
      name: "Send feedback",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.submit(screen.getByTestId("feedback-dialog").querySelector("form")!);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("with analytics off, an explicit submit sends only app_version as common props", async () => {
    render(<FeedbackDialog />);
    openDialog();
    fireEvent.click(screen.getByTestId("feedback-rating-4"));
    fireEvent.change(screen.getByPlaceholderText("What works well, what doesn't?"), {
      target: { value: "  Great tool  " },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: " me@example.com " },
    });
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const batch = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(batch.id).toBeUndefined();
    expect(batch.events).toHaveLength(1);
    expect(Object.keys(batch.events[0].props).sort()).toEqual([
      "app_version",
      "email",
      "rating",
      "text",
    ]);
    expect(batch.events[0].props).toMatchObject({
      rating: 4,
      text: "Great tool",
      email: "me@example.com",
    });
    expect(mocks.track).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("feedback-dialog")).toBeNull());
    expect(readFeedbackState().submitted).toBe(true);
  });

  it("omits empty text and email from the payload", async () => {
    render(<FeedbackDialog />);
    openDialog();
    fireEvent.click(screen.getByTestId("feedback-rating-2"));
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(Object.keys(sentEvents()[0].props).sort()).toEqual([
      "app_version",
      "rating",
    ]);
  });

  it("tracks feedback_submitted and calls onSubmitted when analytics is active", async () => {
    mocks.trackingActive = true;
    const onSubmitted = vi.fn();
    render(<FeedbackDialog onSubmitted={onSubmitted} />);
    openDialog();
    fireEvent.click(screen.getByTestId("feedback-rating-5"));
    fireEvent.change(screen.getByPlaceholderText("What works well, what doesn't?"), {
      target: { value: "Nice" },
    });
    submit();
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(mocks.track).toHaveBeenCalledWith("feedback_submitted", {
      rating: 5,
      has_text: true,
      has_email: false,
    });
  });

  it("keeps the draft and shows an error when delivery fails, then succeeds on retry", async () => {
    fetchMock.mockResolvedValueOnce({ status: 503 });
    render(<FeedbackDialog />);
    openDialog();
    fireEvent.click(screen.getByTestId("feedback-rating-3"));
    const text = screen.getByPlaceholderText(
      "What works well, what doesn't?",
    ) as HTMLTextAreaElement;
    fireEvent.change(text, { target: { value: "Draft text" } });
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't send your feedback");
    expect(text.value).toBe("Draft text");
    expect(
      screen.getByTestId("feedback-rating-3").getAttribute("aria-checked"),
    ).toBe("true");
    expect(window.localStorage.getItem(FEEDBACK_STATE_STORAGE_KEY)).toBeNull();
    expect(mocks.track).not.toHaveBeenCalled();

    submit();
    await waitFor(() => expect(screen.queryByTestId("feedback-dialog")).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a submitting state and blocks dismissal while sending", async () => {
    let resolveFetch: (value: { status: number }) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const onDismiss = vi.fn();
    render(<FeedbackDialog onDismiss={onDismiss} />);
    openDialog();
    fireEvent.click(screen.getByTestId("feedback-rating-4"));
    submit();
    const sending = (await screen.findByRole("button", {
      name: "Sending...",
    })) as HTMLButtonElement;
    expect(sending.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId("feedback-dialog")).toBeTruthy();
    await act(async () => resolveFetch({ status: 200 }));
    await waitFor(() => expect(screen.queryByTestId("feedback-dialog")).toBeNull());
  });

  it("cancel resets the draft, releases the slot and calls onDismiss", () => {
    const onDismiss = vi.fn();
    render(<FeedbackDialog onDismiss={onDismiss} />);
    openDialog();
    fireEvent.click(screen.getByTestId("feedback-rating-4"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(usePromptStore.getState().active).toBeNull();
    expect(screen.queryByTestId("feedback-dialog")).toBeNull();
    openDialog();
    expect(
      screen.getByTestId("feedback-rating-4").getAttribute("aria-checked"),
    ).toBe("false");
  });
});
