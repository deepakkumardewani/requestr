/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { ErrorTab } from "./ErrorTab";

afterEach(cleanup);

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: "step-1",
    nodeId: "node-1",
    nodeType: "api",
    label: "Get users",
    state: "failed",
    startedAt: Date.now(),
    durationMs: 120,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

describe("ErrorTab", () => {
  it("renders the full, untruncated error message", () => {
    const longError = `Request failed with status 500.\n\n${"Detailed stack trace line. ".repeat(50)}\n\nEnd of trace.`;
    const { container } = render(
      <ErrorTab step={makeStep({ error: longError })} />,
    );
    expect(container.querySelector("p")?.textContent).toBe(longError);
  });

  it("renders the mapped error-kind name when errorKind is passed", () => {
    render(
      <ErrorTab
        step={makeStep({ error: "Injection failed" })}
        errorKind="injection"
      />,
    );
    expect(screen.getByText(/InjectionError/)).toBeInTheDocument();
  });

  it("does not render an error-kind badge when errorKind is omitted", () => {
    render(<ErrorTab step={makeStep({ error: "Something failed" })} />);
    expect(screen.queryByText(/Error type/)).not.toBeInTheDocument();
  });

  it("renders the empty-state message when step.error is undefined", () => {
    render(<ErrorTab step={makeStep({ error: undefined })} />);
    expect(screen.getByText("No error details")).toBeInTheDocument();
  });
});
