/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_ERROR_CODES,
  RELAY_ERROR_META,
  type RelayDisplayError,
  STEP_CAP_ERROR_CODE,
} from "@/lib/relay/errors";
import { ErrorBubble } from "./ErrorBubble";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(error: RelayDisplayError, online = true, withContinue = false) {
  const onRetry = vi.fn();
  const onEditMessage = vi.fn();
  const onContinue = vi.fn();
  render(
    <ErrorBubble
      error={error}
      online={online}
      onRetry={onRetry}
      onEditMessage={onEditMessage}
      onContinue={withContinue ? onContinue : undefined}
    />,
  );
  return { onRetry, onEditMessage, onContinue };
}

describe("ErrorBubble", () => {
  it.each(RELAY_ERROR_CODES)("%s renders an alert with its message key", (code) => {
    setup({ code });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-testid", "relay-banner");
    expect(alert).toHaveTextContent(RELAY_ERROR_META[code].messageKey);
  });

  it.each(["relay_unavailable", "tool_failed"] as const)(
    "%s offers an enabled Retry",
    (code) => {
      const { onRetry } = setup({ code });
      fireEvent.click(screen.getByTestId("relay-retry"));
      expect(onRetry).toHaveBeenCalledTimes(1);
    },
  );

  it("offline: Retry is disabled until the connection returns", () => {
    setup({ code: "offline" }, false);
    expect(screen.getByTestId("relay-retry")).toBeDisabled();
  });

  it("offline: Retry works once online", () => {
    const { onRetry } = setup({ code: "offline" }, true);
    fireEvent.click(screen.getByTestId("relay-retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("rate_limited counts down from Retry-After then enables Retry", () => {
    const { onRetry } = setup({ code: "rate_limited", retryAfterSeconds: 2 });
    const retry = screen.getByTestId("relay-retry");
    expect(retry).toBeDisabled();
    expect(retry).toHaveTextContent("retryIn");

    act(() => vi.advanceTimersByTime(1000));
    expect(retry).toBeDisabled();
    act(() => vi.advanceTimersByTime(1000));
    expect(retry).toBeEnabled();
    expect(retry).toHaveTextContent("retry");

    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("rate_limited without Retry-After falls back to a default countdown", () => {
    setup({ code: "rate_limited" });
    expect(screen.getByTestId("relay-retry")).toBeDisabled();
  });

  it("context_too_long offers Edit message instead of Retry", () => {
    const { onEditMessage } = setup({ code: "context_too_long" });
    expect(screen.queryByTestId("relay-retry")).toBeNull();
    fireEvent.click(screen.getByTestId("relay-edit-message"));
    expect(onEditMessage).toHaveBeenCalledTimes(1);
  });

  it.each(["aborted", "not_configured"] as const)("%s has no action", (code) => {
    setup({ code });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("not_configured copy names no environment variable", () => {
    setup({ code: "not_configured" });
    expect(screen.getByRole("alert").textContent).not.toMatch(/KEY|ENV|RELAY_/);
  });

  describe("step cap (HH-L23)", () => {
    it("offers Continue, not Retry, and runs the handler", () => {
      const { onContinue, onRetry } = setup({ code: STEP_CAP_ERROR_CODE }, true, true);
      expect(screen.getByRole("alert")).toHaveTextContent(
        RELAY_ERROR_META[STEP_CAP_ERROR_CODE].messageKey,
      );
      expect(screen.queryByTestId("relay-retry")).toBeNull();
      fireEvent.click(screen.getByTestId("relay-continue"));
      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it("shows no action when the host gave no Continue handler", () => {
      setup({ code: STEP_CAP_ERROR_CODE });
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("never offers Continue for an error that is retried instead", () => {
      setup({ code: "relay_unavailable" }, true, true);
      expect(screen.queryByTestId("relay-continue")).toBeNull();
      expect(screen.getByTestId("relay-retry")).toBeEnabled();
    });
  });
});
