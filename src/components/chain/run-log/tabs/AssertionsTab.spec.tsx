/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import type { AssertionResult, ChainAssertion } from "@/types/chain";
import { AssertionsTab } from "./AssertionsTab";

afterEach(cleanup);

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: "step-1",
    nodeId: "node-1",
    nodeType: "api",
    label: "Get users",
    state: "passed",
    startedAt: Date.now(),
    durationMs: 120,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

const assertionConfig: ChainAssertion = {
  id: "assertion-1",
  source: "status",
  operator: "eq",
  expectedValue: "200",
  enabled: true,
};

describe("AssertionsTab", () => {
  it("renders the empty state when there are no assertion results", () => {
    render(<AssertionsTab step={makeStep({ assertionResults: undefined })} />);
    expect(screen.getByText("No assertions")).toBeInTheDocument();
  });

  it("renders the empty state when assertionResults is an empty array", () => {
    render(<AssertionsTab step={makeStep({ assertionResults: [] })} />);
    expect(screen.getByText("No assertions")).toBeInTheDocument();
  });

  it("shows Expected and Actual for a failing assertion", () => {
    const result: AssertionResult = {
      assertionId: "assertion-1",
      passed: false,
      actual: "404",
    };
    render(
      <AssertionsTab
        step={makeStep({ assertionResults: [result] })}
        assertions={[assertionConfig]}
      />,
    );

    expect(screen.getByText("Expected:")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("Actual:")).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByLabelText("failed")).toBeInTheDocument();
    expect(screen.getByText("Status Code equals")).toBeInTheDocument();
  });

  it("renders a passing assertion correctly", () => {
    const result: AssertionResult = {
      assertionId: "assertion-1",
      passed: true,
      actual: "200",
    };
    render(
      <AssertionsTab
        step={makeStep({ assertionResults: [result] })}
        assertions={[assertionConfig]}
      />,
    );

    expect(screen.getByLabelText("passed")).toBeInTheDocument();
    expect(screen.queryByLabelText("failed")).not.toBeInTheDocument();
    expect(screen.getAllByText("200")).toHaveLength(2);
  });

  it("renders gracefully when the assertions prop is omitted", () => {
    const result: AssertionResult = {
      assertionId: "unknown-assertion",
      passed: false,
      actual: null,
    };
    render(<AssertionsTab step={makeStep({ assertionResults: [result] })} />);

    expect(screen.getByText("unknown-assertion")).toBeInTheDocument();
    expect(screen.getByText("Expected:")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
