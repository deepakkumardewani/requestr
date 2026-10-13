/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayToggleButton } from "./RelayToggleButton";

function renderButton() {
  return render(
    <TooltipProvider>
      <RelayToggleButton />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({ open: false, focusRequest: 0 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("RelayToggleButton", () => {
  it("is labelled for assistive tech and collapsed by default", () => {
    renderButton();

    const button = screen.getByTestId("relay-toggle");
    expect(button).toHaveAttribute("aria-label", "toggleLabel");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles the dock and mirrors the state in aria-expanded", () => {
    renderButton();
    const button = screen.getByTestId("relay-toggle");

    fireEvent.click(button);
    expect(useRelayStore.getState().open).toBe(true);
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(button);
    expect(useRelayStore.getState().open).toBe(false);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("reflects a dock opened elsewhere, such as by the shortcut", () => {
    renderButton();

    act(() => useRelayStore.getState().setOpen(true));

    expect(screen.getByTestId("relay-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("renders nothing when the feature flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    renderButton();

    expect(screen.queryByTestId("relay-toggle")).not.toBeInTheDocument();
  });
});
