/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELAY_STORAGE_KEYS } from "@/lib/relay/constants";
import { RelayOnboarding } from "./RelayOnboarding";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RelayOnboarding", () => {
  it("shows the first step on the first open and records that it was seen", () => {
    render(<RelayOnboarding />);

    expect(screen.getByTestId("relay-onboarding")).toBeInTheDocument();
    expect(screen.getByText("steps.can.title")).toBeInTheDocument();
    expect(localStorage.getItem(RELAY_STORAGE_KEYS.onboarded)).toBe("true");
  });

  it("does not show again once seen", () => {
    localStorage.setItem(RELAY_STORAGE_KEYS.onboarded, "true");
    render(<RelayOnboarding />);

    expect(screen.queryByTestId("relay-onboarding")).toBeNull();
  });

  it("does not return after a remount in the same profile", () => {
    const first = render(<RelayOnboarding />);
    first.unmount();
    render(<RelayOnboarding />);

    expect(screen.queryByTestId("relay-onboarding")).toBeNull();
  });

  it("walks the three steps and closes on the last", () => {
    render(<RelayOnboarding />);

    fireEvent.click(screen.getByTestId("relay-onboarding-next"));
    expect(screen.getByText("steps.sees.title")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-onboarding-next"));
    expect(screen.getByText("steps.undo.title")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-onboarding-back"));
    expect(screen.getByText("steps.sees.title")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-onboarding-next"));
    fireEvent.click(screen.getByTestId("relay-onboarding-next"));

    expect(screen.queryByTestId("relay-onboarding")).toBeNull();
  });

  it("can be dismissed at any step", () => {
    render(<RelayOnboarding />);

    fireEvent.click(screen.getByTestId("relay-onboarding-dismiss"));

    expect(screen.queryByTestId("relay-onboarding")).toBeNull();
  });

  it("still shows when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<RelayOnboarding />);

    expect(screen.getByTestId("relay-onboarding")).toBeInTheDocument();
  });
});
