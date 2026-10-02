/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { countSteps, RunFilterTabs } from "./RunFilterTabs";

afterEach(cleanup);

const step = (state: RunStep["state"]): RunStep => ({
  id: state,
  nodeId: state,
  nodeType: "api",
  label: state,
  state,
  startedAt: 0,
  durationMs: 1,
  extractedValues: {},
  unresolvedVars: [],
});

describe("countSteps", () => {
  it("counts aborted under failed and ignores other states for tabs", () => {
    const counts = countSteps([
      step("passed"),
      step("failed"),
      step("aborted"),
      step("skipped"),
    ]);
    expect(counts).toEqual({ all: 4, passed: 1, failed: 2, skipped: 1 });
  });
});

describe("RunFilterTabs", () => {
  it("hides zero-count tabs except All", () => {
    render(
      <RunFilterTabs
        counts={{ all: 2, passed: 2, failed: 0, skipped: 0 }}
        value="all"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "All 2" })).toBeInTheDocument();
  });

  it("marks the active tab with aria-pressed and reports clicks", async () => {
    const onChange = vi.fn();
    render(
      <RunFilterTabs
        counts={{ all: 3, passed: 1, failed: 1, skipped: 1 }}
        value="failed"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Failed 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Skipped 1" }));
    expect(onChange).toHaveBeenCalledWith("skipped");
  });
});
