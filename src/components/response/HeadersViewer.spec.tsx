/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import React from "react";
import { classifyHeaders, HeadersViewer } from "./HeadersViewer";

afterEach(cleanup);

// ── classifyHeaders (pure logic) ─────────────────────────────────────────────

describe("classifyHeaders", () => {
  it("puts content-type and content-length into Content Headers", () => {
    const groups = classifyHeaders({
      "content-type": "application/json",
      "content-length": "128",
    });
    const content = groups.find((g) => g.label === "Content Headers");
    expect(content?.keys).toContain("content-type");
    expect(content?.keys).toContain("content-length");
  });

  it("puts access-control-* into CORS Headers", () => {
    const groups = classifyHeaders({
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST",
    });
    const cors = groups.find((g) => g.label === "CORS Headers");
    expect(cors?.keys).toHaveLength(2);
  });

  it("puts everything else into Response Headers", () => {
    const groups = classifyHeaders({
      "cache-control": "no-cache",
      "x-request-id": "abc123",
    });
    const resp = groups.find((g) => g.label === "Response Headers");
    expect(resp?.keys).toContain("cache-control");
    expect(resp?.keys).toContain("x-request-id");
  });

  it("classifies mixed headers into three groups", () => {
    const groups = classifyHeaders({
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "x-request-id": "abc",
    });
    expect(groups).toHaveLength(3);
    const labels = groups.map((g) => g.label);
    expect(labels).toContain("Response Headers");
    expect(labels).toContain("Content Headers");
    expect(labels).toContain("CORS Headers");
  });

  it("returns empty array when headers is empty", () => {
    expect(classifyHeaders({})).toHaveLength(0);
  });

  it("only returns groups that have at least one key", () => {
    const groups = classifyHeaders({ "content-type": "text/plain" });
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Content Headers");
  });

  it("is case-insensitive for classification", () => {
    const groups = classifyHeaders({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    expect(groups.find((g) => g.label === "Content Headers")?.keys).toContain("Content-Type");
    expect(groups.find((g) => g.label === "CORS Headers")?.keys).toContain("Access-Control-Allow-Origin");
  });
});

// ── HeadersViewer rendering ───────────────────────────────────────────────────

describe("HeadersViewer", () => {
  it("renders group section headers", () => {
    render(
      <HeadersViewer
        headers={{
          "content-type": "application/json",
          "x-request-id": "abc",
        }}
      />,
    );
    expect(screen.getByText(/Content Headers/i)).toBeInTheDocument();
    expect(screen.getByText(/Response Headers/i)).toBeInTheDocument();
  });

  it("renders header rows with name and value", () => {
    render(
      <HeadersViewer headers={{ "content-type": "application/json" }} />,
    );
    expect(screen.getByTestId("response-header-name")).toHaveTextContent(
      "content-type",
    );
    expect(screen.getByTestId("response-header-value")).toHaveTextContent(
      "application/json",
    );
  });

  it("shows 'No headers' when headers object is empty", () => {
    render(<HeadersViewer headers={{}} />);
    expect(screen.getByText("No headers")).toBeInTheDocument();
  });

  it("shows header count per group", () => {
    render(
      <HeadersViewer
        headers={{
          "content-type": "application/json",
          "content-length": "50",
        }}
      />,
    );
    // Content Headers (2)
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("collapses a group when its toggle is clicked", async () => {
    const user = userEvent.setup();
    render(
      <HeadersViewer headers={{ "content-type": "application/json" }} />,
    );

    // rows visible initially (expanded by default)
    expect(screen.getByTestId("response-header-row")).toBeInTheDocument();

    const toggle = screen.getByTestId("header-group-toggle");
    await user.click(toggle);

    expect(screen.queryByTestId("response-header-row")).not.toBeInTheDocument();
  });

  it("expands a collapsed group when toggle is clicked again", async () => {
    const user = userEvent.setup();
    render(
      <HeadersViewer headers={{ "content-type": "application/json" }} />,
    );

    const toggle = screen.getByTestId("header-group-toggle");
    await user.click(toggle); // collapse
    await user.click(toggle); // expand

    expect(screen.getByTestId("response-header-row")).toBeInTheDocument();
  });

  it("renders copy button that is initially invisible on each row", () => {
    render(
      <HeadersViewer headers={{ "content-type": "application/json" }} />,
    );
    const copyBtn = screen.getByTestId("response-header-copy-btn");
    expect(copyBtn).toHaveClass("opacity-0");
  });

  it("renders all three group sections when all header types present", () => {
    render(
      <HeadersViewer
        headers={{
          "x-custom": "value",
          "content-type": "text/html",
          "access-control-allow-origin": "*",
        }}
      />,
    );
    expect(screen.getByText(/Response Headers/i)).toBeInTheDocument();
    expect(screen.getByText(/Content Headers/i)).toBeInTheDocument();
    expect(screen.getByText(/CORS Headers/i)).toBeInTheDocument();
  });
});
