/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./data/comparison", () => ({
  COMPARISON_CHECKED_ON: "2026-01-01",
  COMPARISON_GROUPS: [{ id: "capabilities", title: "Capabilities" }],
  formatCheckedMonth: () => "Jan 2026",
  COMPARISON_ROWS: [
    {
      feature: "Postman wins",
      group: "capabilities",
      emphasis: "postman",
      requestr: { text: "R1", codeRef: "src/a.ts" },
      postman: { text: "P1", source: "https://example.com/p1" },
      insomnia: { text: "I1", source: "https://example.com/i1" },
    },
    {
      feature: "Insomnia wins",
      group: "capabilities",
      emphasis: "insomnia",
      requestr: { text: "R2", codeRef: "src/b.ts" },
      postman: { text: "P2", source: "https://example.com/p2", tier: "Paid" },
      insomnia: { text: "I2", source: "https://example.com/i2" },
    },
  ],
}));

import { ComparisonTable } from "./ComparisonTable";

describe("ComparisonTable emphasis styling", () => {
  afterEach(() => {
    cleanup();
  });

  it("highlights the emphasised competitor cell and mutes the others", () => {
    render(<ComparisonTable />);
    const postmanCell = screen.getAllByText("P1", { selector: "td" })[0];
    const requestrCell = screen.getAllByText("R1", { selector: "td" })[0];
    expect(postmanCell.className).toContain("text-foreground/90");
    expect(postmanCell.className).toContain("font-medium");
    expect(requestrCell.className).toContain("text-muted-foreground");
  });

  it("highlights the insomnia cell on an insomnia row", () => {
    render(<ComparisonTable />);
    const insomniaCell = screen.getAllByText("I2", { selector: "td" })[0];
    expect(insomniaCell.className).toContain("text-foreground/90");
  });

  it("omits the tier chip when a cell has no tier", () => {
    render(<ComparisonTable />);
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });
});
