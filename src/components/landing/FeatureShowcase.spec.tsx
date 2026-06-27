/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureShowcase } from "./FeatureShowcase";

describe("FeatureShowcase", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders hero feature titles", () => {
    render(<FeatureShowcase />);
    expect(screen.getByText("Transform Playground")).toBeInTheDocument();
    expect(screen.getByText("JSON Compare")).toBeInTheDocument();
    expect(screen.getByText("Shareable request links")).toBeInTheDocument();
  });

  it("links to the full features page", () => {
    render(<FeatureShowcase />);
    const links = screen.getAllByRole("link", { name: /see all features|explore all features/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/features");
  });

  it("does not render non-hero workspace features", () => {
    render(<FeatureShowcase />);
    expect(screen.queryByText("Command palette")).not.toBeInTheDocument();
  });
});
