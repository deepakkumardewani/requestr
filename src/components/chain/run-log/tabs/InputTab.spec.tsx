/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { InputTab } from "./InputTab";

afterEach(cleanup);

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: "step-1",
    nodeId: "node-1",
    nodeType: "api",
    label: "Get user",
    state: "passed",
    startedAt: Date.now(),
    durationMs: 120,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

describe("InputTab", () => {
  it("renders the resolved request method, url, headers, and body for an api step", () => {
    render(
      <InputTab
        step={makeStep({
          request: {
            method: "POST",
            url: "https://api.example.com/users/42",
            headers: { Authorization: "Bearer token-abc", "Content-Type": "application/json" },
            body: '{"id":42}',
          },
        })}
      />,
    );

    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(
      screen.getByText("https://api.example.com/users/42"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bearer token-abc/)).toBeInTheDocument();
    expect(screen.getByText('{"id":42}')).toBeInTheDocument();
  });

  it("highlights header/url substrings that match an extracted value", () => {
    render(
      <InputTab
        step={makeStep({
          extractedValues: { userId: "42" },
          request: {
            method: "GET",
            url: "https://api.example.com/users/42",
            headers: { "X-User-Id": "42" },
          },
        })}
      />,
    );

    const marks = screen.getAllByTestId("injected-value");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.some((mark) => mark.textContent === "42")).toBe(true);
  });

  it("lists unresolved variables when present", () => {
    render(
      <InputTab
        step={makeStep({
          request: {
            method: "GET",
            url: "https://api.example.com/users/{{userId}}",
            headers: {},
          },
          unresolvedVars: ["userId"],
        })}
      />,
    );

    expect(screen.getByTestId("unresolved-vars")).toHaveTextContent(
      "{{userId}}",
    );
  });

  it("does not render an unresolved variables section when there are none", () => {
    render(
      <InputTab
        step={makeStep({
          request: { method: "GET", url: "https://api.example.com", headers: {} },
        })}
      />,
    );

    expect(screen.queryByTestId("unresolved-vars")).not.toBeInTheDocument();
  });

  it("renders the delay duration for a delay step", () => {
    render(
      <InputTab
        step={makeStep({
          nodeType: "delay",
          label: "Wait",
          durationMs: 2000,
          request: undefined,
        })}
      />,
    );

    expect(screen.getByText(/Delay duration/)).toBeInTheDocument();
    expect(screen.getByText("2.00 s")).toBeInTheDocument();
  });

  it("renders evaluated values for a condition step", () => {
    render(
      <InputTab
        step={makeStep({
          nodeType: "condition",
          label: "Check status",
          request: undefined,
          extractedValues: { statusCode: 200 },
        })}
      />,
    );

    expect(screen.getByText(/Evaluated values/)).toBeInTheDocument();
    expect(screen.getByText("statusCode:")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("lists every Start block input with its resolved value", () => {
    render(
      <InputTab
        step={makeStep({
          nodeType: "start",
          label: "Start",
          request: undefined,
          extractedValues: { token: "override-value", userId: "42" },
        })}
      />,
    );

    expect(screen.getByText(/Chain inputs/)).toBeInTheDocument();
    expect(screen.getByText("token:")).toBeInTheDocument();
    expect(screen.getByText("override-value")).toBeInTheDocument();
    expect(screen.getByText("userId:")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders an empty state for a Start step with no inputs", () => {
    render(
      <InputTab
        step={makeStep({
          nodeType: "start",
          label: "Start",
          request: undefined,
          extractedValues: {},
        })}
      />,
    );

    expect(screen.getByText("No input data")).toBeInTheDocument();
  });

  it("renders an empty state when there is no request or extracted data", () => {
    render(
      <InputTab
        step={makeStep({
          nodeType: "display",
          request: undefined,
          extractedValues: {},
        })}
      />,
    );

    expect(screen.getByText("No input data")).toBeInTheDocument();
  });
});
