/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/stores/useUIStore";
import { SnapToggle } from "./SnapToggle";

vi.mock("@xyflow/react", () => ({
  ControlButton: ({
    children,
    ...props
  }: { children?: ReactNode } & Record<string, unknown>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

describe("SnapToggle", () => {
  beforeEach(() => {
    useUIStore.setState({ snapToGrid: false });
  });
  afterEach(cleanup);

  it("reflects the stored preference via aria-pressed", () => {
    render(<SnapToggle />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(
      "false",
    );
    cleanup();
    useUIStore.setState({ snapToGrid: true });
    render(<SnapToggle />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("toggles the preference and keeps it across remount", () => {
    const { unmount } = render(<SnapToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(useUIStore.getState().snapToGrid).toBe(true);
    unmount();
    render(<SnapToggle />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button"));
    expect(useUIStore.getState().snapToGrid).toBe(false);
  });
});
