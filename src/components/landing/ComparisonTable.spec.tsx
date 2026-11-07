/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComparisonTable } from "./ComparisonTable";
import { COMPARISON_CHECKED_ON, COMPARISON_ROWS } from "./data/comparison";

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
      screen.getAllByText(/HTTP, GraphQL, gRPC, MQTT, SOAP/).length,
    ).toBeGreaterThan(0);
  });

  it("renders a source link with an https href for every competitor cell", () => {
    render(<ComparisonTable />);
    const links = screen.getAllByTestId("comparison-source-link");
    // table + mobile cards each render both competitor columns
    expect(links).toHaveLength(COMPARISON_ROWS.length * 2 * 2);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link.getAttribute("aria-label")).toMatch(/^Source for /);
    }
  });

  it("keeps source links keyboard reachable", () => {
    render(<ComparisonTable />);
    for (const link of screen.getAllByTestId("comparison-source-link")) {
      expect(link.tagName).toBe("A");
      expect(link.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  it("shows the Requestr code reference and plan tier notes", () => {
    render(<ComparisonTable />);
    expect(screen.getAllByText("src/lib/idb.ts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Plan: All plans").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Plan: Free (Scratch Pad)").length).toBeGreaterThan(0);
  });

  it("renders a plan tier note for every competitor cell that declares one", () => {
    render(<ComparisonTable />);
    const tiers = COMPARISON_ROWS.flatMap((r) => [r.postman.tier, r.insomnia.tier]).filter(
      (t): t is string => Boolean(t),
    );
    expect(tiers.length).toBeGreaterThan(0);
    for (const tier of tiers) {
      // table + mobile cards
      expect(screen.getAllByText(`Plan: ${tier}`).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("labels each source link with its vendor and feature", () => {
    render(<ComparisonTable />);
    const row = COMPARISON_ROWS[0];
    expect(
      screen.getAllByRole("link", { name: `Source for Postman: ${row.feature}` }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: `Source for Insomnia: ${row.feature}` }),
    ).toHaveLength(2);
  });

  it("opens source links safely in a new tab", () => {
    render(<ComparisonTable />);
    for (const link of screen.getAllByTestId("comparison-source-link")) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("renders a code reference for every Requestr cell", () => {
    render(<ComparisonTable />);
    const refs = screen.getAllByTestId("comparison-code-ref").map((e) => e.textContent);
    for (const row of COMPARISON_ROWS) {
      expect(refs.filter((r) => r === row.requestr.codeRef).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("states when the competitor claims were checked", () => {
    const { container } = render(<ComparisonTable />);
    expect(container.textContent).toContain(COMPARISON_CHECKED_ON);
  });
});
