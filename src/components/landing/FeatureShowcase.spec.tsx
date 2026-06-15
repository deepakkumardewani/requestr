/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureShowcase } from "./FeatureShowcase";

describe("FeatureShowcase", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the features grid without variant labels", () => {
    render(<FeatureShowcase />);
    expect(screen.queryByText(/Variant A/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Variant B/i)).not.toBeInTheDocument();
    expect(screen.getByText("Multi-tab workspace")).toBeInTheDocument();
  });

  it("renders all feature titles once", () => {
    render(<FeatureShowcase />);
    expect(screen.getAllByText("Collections")).toHaveLength(1);
    expect(screen.getAllByText("Response viewer")).toHaveLength(1);
  });
});
