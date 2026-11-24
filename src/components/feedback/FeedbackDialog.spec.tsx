// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAnalyticsForTests } from "@/lib/analytics/adapter";
import {
  FEEDBACK_STATE_STORAGE_KEY,
  readFeedbackState,
} from "@/lib/feedback/feedbackState";
import { usePromptStore } from "@/stores/usePromptStore";
import { FeedbackDialog } from "./FeedbackDialog";

const mocks = vi.hoisted(() => ({
  configured: true,
  trackingActive: false,
  track: vi.fn(),
  toastCustom: vi.fn(),
}));

vi.mock("next-intl", async () => {
  const { translateFeedback } = await import("./feedbackTestI18n");
  return { useTranslations: () => translateFeedback };
});

vi.mock("sonner", () => ({ toast: { custom: mocks.toastCustom } }));

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

function submitButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Send feedback" }) as HTMLButtonElement;
}

function submit() {
  fireEvent.click(submitButton());
}

function rate(value: number) {
  fireEvent.click(screen.getByTestId(`feedback-rating-${value}`));
}

function star(value: number): HTMLElement {
  return screen.getByTestId(`feedback-rating-${value}`);
}

function textArea(): HTMLTextAreaElement {
  return screen.getByTestId("feedback-dialog").querySelector("textarea")!;
}

function enterReplyEmail(value: string): HTMLInputElement {
  fireEvent.click(screen.getByRole("switch", { name: "Want a reply?" }));
  const email = screen.getByPlaceholderText("you@example.com") as HTMLInputElement;
  fireEvent.change(email, { target: { value } });
  return email;
}

function sentEvents(): Array<{ name: string; props: Record<string, unknown> }> {
  const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
  return body.events;
}

/** Renders the element a `toast.custom` call would show, so its props can be asserted. */
function lastToastProps(): Record<string, unknown> {
  const render = mocks.toastCustom.mock.calls.at(-1)?.[0] as () => {
    props: Record<string, unknown>;
  };
  return render().props;
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
  mocks.toastCustom.mockReset();
  vi.unstubAllGlobals();
});

describe("FeedbackDialog", () => {
  it("renders nothing until the feedback prompt slot is active", () => {
    render(<FeedbackDialog />);
    expect(screen.queryByTestId("feedback-dialog")).toBeNull();
    openDialog();
    expect(screen.getByTestId("feedback-dialog")).toBeTruthy();
  });

  it("keeps Send disabled until a star is chosen", () => {
    render(<FeedbackDialog />);
    openDialog();
    expect(submitButton().disabled).toBe(true);
    fireEvent.submit(screen.getByTestId("feedback-dialog").querySelector("form")!);
    expect(fetchMock).not.toHaveBeenCalled();
    rate(3);
    expect(submitButton().disabled).toBe(false);
  });

  it("tells assistive tech why Send is disabled, until a star is chosen", () => {
    render(<FeedbackDialog />);
    openDialog();
    const hintId = submitButton().getAttribute("aria-describedby");
    const hint = document.getElementById(hintId!);
    expect(hint?.textContent).toBe("Pick a rating");
    expect(hint?.closest("[aria-hidden=true]")).toBeNull();
    rate(3);
    expect(submitButton().hasAttribute("aria-describedby")).toBe(false);
  });

  it("marks only the chosen rating as checked and names the live label", () => {
    render(<FeedbackDialog />);
    openDialog();
    expect(screen.getByTestId("feedback-rating-text").textContent).toBe("Pick a rating");
    rate(4);
    expect(star(4).getAttribute("aria-checked")).toBe("true");
    expect(star(3).getAttribute("aria-checked")).toBe("false");
    expect(star(4).getAttribute("aria-label")).toBe("4 out of 5, Pretty good");
    expect(screen.getByTestId("feedback-rating-text").textContent).toBe("Pretty good");
  });

  it("previews the hovered rating without selecting it", () => {
    render(<FeedbackDialog />);
    openDialog();
    rate(2);
    fireEvent.pointerEnter(star(5));
    expect(screen.getByTestId("feedback-rating-text").textContent).toBe("Love it");
    expect(star(5).getAttribute("aria-checked")).toBe("false");
    fireEvent.pointerLeave(screen.getByRole("radiogroup"));
    expect(screen.getByTestId("feedback-rating-text").textContent).toBe("Could be better");
  });

  it("supports arrow keys, Home and End with a single tab stop", () => {
    render(<FeedbackDialog />);
    openDialog();
    expect(star(1).tabIndex).toBe(0);
    expect(star(2).tabIndex).toBe(-1);
    const group = screen.getByRole("radiogroup");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(star(1).getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(group, { key: "End" });
    expect(star(5).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(star(5));
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(star(5).getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(star(4).getAttribute("aria-checked")).toBe("true");
    expect(star(4).tabIndex).toBe(0);
    expect(star(5).tabIndex).toBe(-1);
    fireEvent.keyDown(group, { key: "Home" });
    expect(star(1).getAttribute("aria-checked")).toBe("true");
  });

  it.each([
    [null, "Anything to add?", "Bugs, ideas, anything on your mind…"],
    [1, "What got in your way?", "A bug, a confusing step, something missing…"],
    [2, "What got in your way?", "A bug, a confusing step, something missing…"],
    [3, "What would make it better?", "The one thing you'd change…"],
    [4, "What's working well for you?", "A feature or workflow you rely on…"],
    [5, "What's working well for you?", "A feature or workflow you rely on…"],
  ])("adapts the note prompt to rating %s", (rating, label, placeholder) => {
    render(<FeedbackDialog />);
    openDialog();
    if (rating !== null) rate(rating);
    expect(screen.getByLabelText(label)).toBe(textArea());
    expect(textArea().placeholder).toBe(placeholder);
  });

  it("reveals the email field only behind the reply toggle", () => {
    render(<FeedbackDialog />);
    openDialog();
    const email = screen.getByPlaceholderText("you@example.com") as HTMLInputElement;
    expect(email.disabled).toBe(true);
    fireEvent.click(screen.getByRole("switch", { name: "Want a reply?" }));
    expect(email.disabled).toBe(false);
  });

  it("blocks an invalid email inline and keeps the dialog open", async () => {
    render(<FeedbackDialog />);
    openDialog();
    rate(4);
    const email = enterReplyEmail("not-an-email");
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Enter a valid email address.",
    );
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("feedback-dialog")).toBeTruthy();
  });

  it("ignores a typed email once the reply toggle is turned off", async () => {
    render(<FeedbackDialog />);
    openDialog();
    rate(4);
    enterReplyEmail("not-an-email");
    fireEvent.click(screen.getByRole("switch", { name: "Want a reply?" }));
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentEvents()[0].props.email).toBeUndefined();
  });

  it("is disabled with an explanation when feedback is not configured", () => {
    mocks.configured = false;
    render(<FeedbackDialog />);
    openDialog();
    rate(4);
    expect(screen.getByTestId("feedback-unconfigured").textContent).toBe(
      "Feedback isn't available in this build.",
    );
    expect(submitButton().disabled).toBe(true);
    fireEvent.submit(screen.getByTestId("feedback-dialog").querySelector("form")!);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("with analytics off, an explicit submit sends only app_version as common props", async () => {
    render(<FeedbackDialog />);
    openDialog();
    rate(4);
    fireEvent.change(textArea(), { target: { value: "  Great tool  " } });
    enterReplyEmail(" me@example.com ");
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

  it("shows the success toast with the rating and reply email after delivery", async () => {
    render(<FeedbackDialog />);
    openDialog();
    rate(5);
    enterReplyEmail("me@example.com");
    submit();
    await waitFor(() => expect(mocks.toastCustom).toHaveBeenCalledTimes(1));
    expect(lastToastProps()).toEqual({ rating: 5, email: "me@example.com" });
  });

  it("omits empty text and email from the payload and the toast", async () => {
    render(<FeedbackDialog />);
    openDialog();
    rate(2);
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(Object.keys(sentEvents()[0].props).sort()).toEqual([
      "app_version",
      "rating",
    ]);
    await waitFor(() => expect(mocks.toastCustom).toHaveBeenCalledTimes(1));
    expect(lastToastProps()).toEqual({ rating: 2, email: undefined });
  });

  it("tracks feedback_submitted and calls onSubmitted when analytics is active", async () => {
    mocks.trackingActive = true;
    const onSubmitted = vi.fn();
    render(<FeedbackDialog onSubmitted={onSubmitted} />);
    openDialog();
    rate(5);
    fireEvent.change(textArea(), { target: { value: "Nice" } });
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
    rate(3);
    fireEvent.change(textArea(), { target: { value: "Draft text" } });
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Couldn't send. Check your connection and try again — your note is still here.",
    );
    expect(textArea().value).toBe("Draft text");
    expect(star(3).getAttribute("aria-checked")).toBe("true");
    expect(window.localStorage.getItem(FEEDBACK_STATE_STORAGE_KEY)).toBeNull();
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.toastCustom).not.toHaveBeenCalled();

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
    rate(4);
    submit();
    const sending = (await screen.findByRole("button", {
      name: "Sending…",
    })) as HTMLButtonElement;
    expect(sending.disabled).toBe(true);
    expect(sending.getAttribute("aria-busy")).toBe("true");
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
    rate(4);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(usePromptStore.getState().active).toBeNull();
    expect(screen.queryByTestId("feedback-dialog")).toBeNull();
    openDialog();
    expect(star(4).getAttribute("aria-checked")).toBe("false");
  });
});
