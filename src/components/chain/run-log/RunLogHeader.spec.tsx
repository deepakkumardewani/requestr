/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/stores/useUIStore";
import { RunLogHeader } from "./RunLogHeader";

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
  useUIStore.setState({ chainRunLogAutoOpen: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderHeader(
  overrides: Partial<React.ComponentProps<typeof RunLogHeader>> = {},
) {
  const props = {
    runCount: 3,
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    onClearAll: vi.fn(),
    ...overrides,
  };
  render(<RunLogHeader {...props} />);
  return props;
}

describe("RunLogHeader", () => {
  it("collapses when the title area is clicked", async () => {
    const props = renderHeader();
    await userEvent.click(screen.getByText("Run Log"));
    expect(props.onToggleCollapsed).toHaveBeenCalledTimes(1);
    expect(screen.getByText("(3 runs)")).toBeTruthy();
  });

  it("uses the singular noun for one run", () => {
    renderHeader({ runCount: 1 });
    expect(screen.getByText("(1 run)")).toBeTruthy();
  });

  it("exposes the chevron with a state-aware accessible name", async () => {
    const props = renderHeader();
    await userEvent.click(screen.getByRole("button", { name: "Collapse run log" }));
    expect(props.onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("names the menu button 'Run Log options' and lists exactly two items", async () => {
    renderHeader();
    await userEvent.click(
      screen.getByRole("button", { name: "Run Log options" }),
    );
    const items = [
      ...screen.queryAllByRole("menuitemcheckbox"),
      ...screen.queryAllByRole("menuitem"),
    ];
    expect(items.map((i) => i.textContent)).toEqual([
      "Auto-open on run",
      "Clear all runs",
    ]);
    expect(screen.queryByText(/copy all/i)).toBeNull();
  });

  it("toggles the auto-open preference", async () => {
    renderHeader();
    await userEvent.click(
      screen.getByRole("button", { name: "Run Log options" }),
    );
    await userEvent.click(screen.getByText("Auto-open on run"));
    expect(useUIStore.getState().chainRunLogAutoOpen).toBe(false);
  });

  it("opens the confirm dialog for Clear all and clears only on confirm", async () => {
    const props = renderHeader();
    await userEvent.click(
      screen.getByRole("button", { name: "Run Log options" }),
    );
    await userEvent.click(screen.getByText("Clear all runs"));
    expect(await screen.findByText("Clear all runs?")).toBeTruthy();
    expect(props.onClearAll).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all runs" }),
    );
    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });

  it("does not mount the menu when collapsed", () => {
    renderHeader({ collapsed: true });
    expect(screen.queryByRole("button", { name: "Run Log options" })).toBeNull();
    expect(screen.getByRole("button", { name: "Expand run log" })).toBeTruthy();
  });
});
