/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_ERROR_CODES,
  RELAY_ERROR_META,
  type MappedRelayError,
} from "@/lib/relay/errors";
import { ErrorBubble } from "./ErrorBubble";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(error: MappedRelayError, online = true) {
  const onRetry = vi.fn();
  const onEditMessage = vi.fn();
  render(
    <ErrorBubble
      error={error}
      online={online}
      onRetry={onRetry}
      onEditMessage={onEditMessage}
    />,
  );
  return { onRetry, onEditMessage };
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
});
