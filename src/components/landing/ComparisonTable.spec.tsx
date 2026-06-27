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

  it("renders the supported protocols row", () => {
    render(<ComparisonTable />);
    expect(screen.getAllByText("Supported protocols").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/HTTP, GraphQL, WebSocket, Socket\.IO, gRPC/).length,
    ).toBeGreaterThan(0);
  });
});
