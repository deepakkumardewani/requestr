/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { OutputTab } from "./OutputTab";

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

const writeText = vi.fn().mockResolvedValue(undefined);

describe("OutputTab", () => {
  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  });

  it("renders the empty state when there is no response", () => {
    render(<OutputTab step={makeStep({ response: undefined })} />);
    expect(
      screen.getByText("No response recorded."),
    ).toBeInTheDocument();
  });

  it("renders the body pretty-printed", () => {
    const step = makeStep({
      response: {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: 42 }),
        duration: 100,
        size: 20,
        url: "https://example.com",
        method: "GET",
        timestamp: Date.now(),
      },
    });
    render(<OutputTab step={step} />);
    expect(screen.getByText(/"userId": 42/)).toBeInTheDocument();
  });

  it("copies the raw body when the copy button is clicked", () => {
    const rawBody = JSON.stringify({ userId: 42 });
    const step = makeStep({
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        body: rawBody,
        duration: 100,
        size: 20,
        url: "https://example.com",
        method: "GET",
        timestamp: Date.now(),
      },
    });
    render(<OutputTab step={step} />);

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith(rawBody);
  });

  it("opens the JSONPath explorer for a JSON response", async () => {
    const user = userEvent.setup();
    const step = makeStep({
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ userId: 42 }),
        duration: 100,
        size: 20,
        url: "https://example.com",
        method: "GET",
        timestamp: Date.now(),
      },
    });
    render(<OutputTab step={step} />);

    await user.click(
      screen.getByRole("button", { name: /open in jsonpath explorer/i }),
    );

    expect(screen.getAllByText(/userId/).length).toBeGreaterThan(1);
  });

  it("disables the JSONPath explorer toggle for a non-JSON response", () => {
    const step = makeStep({
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "not json",
        duration: 100,
        size: 8,
        url: "https://example.com",
        method: "GET",
        timestamp: Date.now(),
      },
    });
    render(<OutputTab step={step} />);

    expect(
      screen.getByRole("button", { name: /open in jsonpath explorer/i }),
    ).toBeDisabled();
  });

  it("shows the truncation note when the response was truncated", () => {
    const step = makeStep({
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "x",
        duration: 100,
        size: 300000,
        url: "https://example.com",
        method: "GET",
        timestamp: Date.now(),
        truncated: true,
      },
    });
    render(<OutputTab step={step} />);
    expect(screen.getByText(/Truncated at 256 KB/)).toBeInTheDocument();
  });

  it("does not show the truncation note when the response was not truncated", () => {
    const step = makeStep({
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "x",
        duration: 100,
        size: 1,
        url: "https://example.com",
        method: "GET",
        timestamp: Date.now(),
      },
    });
    render(<OutputTab step={step} />);
    expect(screen.queryByText(/Truncated/)).not.toBeInTheDocument();
  });
});
