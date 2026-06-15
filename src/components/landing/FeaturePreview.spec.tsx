/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeaturePreview } from "./FeaturePreview";

describe("FeaturePreview", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders multi-tab preview", () => {
    render(<FeaturePreview id="multi-tab" />);
    expect(screen.getByText("GET /users")).toBeInTheDocument();
  });

  it("renders env-vars preview", () => {
    render(<FeaturePreview id="env-vars" />);
    expect(screen.getByText("{{BASE_URL}}")).toBeInTheDocument();
  });

  it("returns null for unknown id", () => {
    const { container } = render(<FeaturePreview id="unknown" />);
    expect(container).toBeEmptyDOMElement();
  });
});
