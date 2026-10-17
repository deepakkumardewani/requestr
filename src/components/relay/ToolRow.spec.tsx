/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isToolPart, ToolRow } from "./ToolRow";
import { relayMessages } from "./relayIntlMock";
const en = relayMessages("en");

// The shared setup knows no relay namespace, so resolve real English copy here.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
    const path = [...namespace.split(".").slice(1), ...key.split(".")];
    const template = path.reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    ) as string;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => values?.[name] ?? "");
  },
}));

afterEach(cleanup);

const row = () => screen.getByTestId("relay-tool-row");

describe("ToolRow", () => {
  it("shows a spinner while the call is running", () => {
    render(<ToolRow part={{ type: "tool-get_request", state: "input-available", input: {} }} />);
    expect(row()).toHaveAttribute("data-state", "running");
    expect(row()).toHaveTextContent("Reading request");
    expect(row().querySelector(".animate-spin")).not.toBeNull();
  });

  it("describes the request once it has been read", () => {
    render(
      <ToolRow
        part={{
          type: "tool-get_request",
          state: "output-available",
          output: { ok: true, data: { method: "GET", url: "https://api.test/orders" } },
        }}
      />,
    );
    expect(row()).toHaveAttribute("data-state", "done");
    expect(row()).toHaveTextContent("Read request: GET https://api.test/orders");
    expect(row().querySelector(".animate-spin")).toBeNull();
  });

  it("shows what was searched for", () => {
    render(
      <ToolRow
        part={{
          type: "tool-search_workspace",
          state: "output-available",
          input: { query: "orders" },
          output: { ok: true, data: { hits: [] } },
        }}
      />,
    );
    expect(row()).toHaveTextContent("Searched for orders");
  });

  it("names collections and environments, and reports a missing response", () => {
    const { rerender } = render(
      <ToolRow
        part={{
          type: "tool-get_collection",
          state: "output-available",
          output: { ok: true, data: { name: "Payments" } },
        }}
      />,
    );
    expect(row()).toHaveTextContent("Read collection: Payments");
    rerender(
      <ToolRow
        part={{
          type: "tool-get_last_response",
          state: "output-available",
          output: { ok: true, data: { available: false } },
        }}
      />,
    );
    expect(row()).toHaveTextContent("no response yet");
    rerender(
      <ToolRow
        part={{
          type: "tool-get_last_response",
          state: "output-available",
          output: { ok: true, data: { available: true, status: 401 } },
        }}
      />,
    );
    expect(row()).toHaveTextContent("Read last response: 401");
  });

  it("renders a readable error row when the tool reports a failure", () => {
    render(
      <ToolRow
        part={{
          type: "tool-get_request",
          state: "output-available",
          output: { ok: false, error: "request not found: r9" },
        }}
      />,
    );
    expect(row()).toHaveAttribute("data-state", "failed");
    expect(row()).toHaveAttribute("role", "alert");
    expect(row()).toHaveTextContent("Step failed");
    expect(screen.getByTestId("relay-tool-error")).toHaveTextContent("request not found: r9");
  });

  it("renders an SDK-level error too", () => {
    render(
      <ToolRow part={{ type: "tool-get_request", state: "output-error", errorText: "boom" }} />,
    );
    expect(row()).toHaveAttribute("data-state", "failed");
    expect(screen.getByTestId("relay-tool-error")).toHaveTextContent("boom");
  });

  it("labels a write tool that is still running, without an alert", () => {
    render(<ToolRow part={{ type: "tool-create_request", state: "input-available" }} />);
    expect(row()).toHaveTextContent("Creating request");
    expect(row()).not.toHaveAttribute("role");
  });

  it("falls back to a generic label for an unknown tool", () => {
    render(<ToolRow part={{ type: "tool-launch_rocket", state: "input-available" }} />);
    expect(row()).toHaveTextContent("Working on a step");
  });

  it("tolerates a result that is not an outcome", () => {
    render(<ToolRow part={{ type: "tool-get_request", state: "output-available", output: "x" }} />);
    expect(row()).toHaveAttribute("data-state", "done");
  });
});

describe("isToolPart", () => {
  it("recognises tool parts only", () => {
    expect(isToolPart({ type: "tool-get_request" } as never)).toBe(true);
    expect(isToolPart({ type: "text", text: "x" })).toBe(false);
  });
});
