/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunSummary } from "@/lib/chainRunHistory";
import { RunCardMenu } from "./RunCardMenu";

afterEach(cleanup);

const run = {
  id: "r1",
  chainId: "c1",
  startedAt: 0,
  status: "passed",
  trigger: "full",
  counts: { passed: 1, failed: 0, skipped: 0, aborted: 0 },
  bytes: 1,
  schemaVersion: 1,
  steps: [],
} as unknown as RunSummary;

function renderMenu(rerunEnabled = true) {
  const handlers = {
    onRerun: vi.fn(),
    onCopySummary: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<RunCardMenu run={run} rerunEnabled={rerunEnabled} {...handlers} />);
  return handlers;
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Run options" }));
}

describe("RunCardMenu", () => {
  it("keeps its items hidden until the trigger is clicked", () => {
    renderMenu();

    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();

    openMenu();

    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  it("calls onRerun with the run when Re-run is chosen", () => {
    const { onRerun, onCopySummary, onDelete } = renderMenu();
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Re-run same subset" }));

    expect(onRerun).toHaveBeenCalledExactlyOnceWith(run);
    expect(onCopySummary).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("calls onCopySummary with the run when Copy run summary is chosen", () => {
    const { onRerun, onCopySummary, onDelete } = renderMenu();
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Copy run summary" }));

    expect(onCopySummary).toHaveBeenCalledExactlyOnceWith(run);
    expect(onRerun).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete with the run when Delete run is chosen", () => {
    const { onRerun, onCopySummary, onDelete } = renderMenu();
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Delete run" }));

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(run);
    expect(onRerun).not.toHaveBeenCalled();
    expect(onCopySummary).not.toHaveBeenCalled();
  });

  it("disables Re-run and does not fire onRerun when the anchor node is gone", () => {
    const { onRerun } = renderMenu(false);
    openMenu();

    const rerun = screen.getByRole("menuitem", { name: "Re-run same subset" });
    expect(rerun).toHaveAttribute("aria-disabled", "true");
    expect(rerun).toHaveAttribute(
      "title",
      "Can't re-run: the starting node was deleted",
    );
    fireEvent.click(rerun);

    expect(onRerun).not.toHaveBeenCalled();
  });

  it("keeps Copy and Delete usable when Re-run is disabled", () => {
    const { onCopySummary, onDelete } = renderMenu(false);
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Copy run summary" }));
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete run" }));

    expect(onCopySummary).toHaveBeenCalledWith(run);
    expect(onDelete).toHaveBeenCalledWith(run);
  });

  it("leaves Re-run without a disabled-reason title when enabled", () => {
    renderMenu(true);
    openMenu();

    const rerun = screen.getByRole("menuitem", { name: "Re-run same subset" });
    expect(rerun).not.toHaveAttribute("title");
    expect(rerun).not.toHaveAttribute("aria-disabled", "true");
  });
});
