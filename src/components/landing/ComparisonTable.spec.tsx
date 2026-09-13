/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComparisonTable } from "./ComparisonTable";

describe("ComparisonTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders three comparison columns", () => {
    render(<ComparisonTable />);
    expect(screen.getByRole("columnheader", { name: "Requestr" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Postman" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Insomnia" })).toBeInTheDocument();
  });

  it("does not show the strawman subtitle", () => {
    render(<ComparisonTable />);
    expect(screen.queryByText(/honest look/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/strawmen/i)).not.toBeInTheDocument();
  });

  it("renders the updated heading and intro copy", () => {
    const { container } = render(<ComparisonTable />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/How\s+Requestr\s+stacks\s+up/);
    expect(text).toMatch(/honest\s+comparison/);
  });

  it("renders all three highlights as a mobile chip row", () => {
    render(<ComparisonTable />);
    expect(screen.getAllByText("100% local").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Zero setup").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Free & open").length).toBeGreaterThan(0);
  });

  it("renders the supported protocols row", () => {
    render(<ComparisonTable />);
    expect(screen.getAllByText("Supported protocols").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/HTTP, GraphQL, WebSocket, Socket\.IO, gRPC/).length,
    ).toBeGreaterThan(0);
  });
});
