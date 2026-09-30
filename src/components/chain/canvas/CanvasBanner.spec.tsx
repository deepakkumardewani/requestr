/** @vitest-environment happy-dom */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CanvasBanner } from "./CanvasBanner";

// Mock the useTranslations hook
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("CanvasBanner", () => {
  it("renders cycle banner with node names", () => {
    render(
      <CanvasBanner type="cycle" nodeNames={["Node A", "Node B", "Node A"]} />
    );

    expect(screen.getByText(/cycleBannerMessage/)).toBeInTheDocument();
    expect(screen.getByText("Node A → Node B → Node A")).toBeInTheDocument();
  });

  it("renders merge banner with node names", () => {
    render(
      <CanvasBanner type="merge" nodeNames={["Merge 1", "Merge 2"]} />
    );

    expect(screen.getByText(/mergeBannerMessage/)).toBeInTheDocument();
    expect(screen.getByText("Merge 1, Merge 2")).toBeInTheDocument();
  });

  it("renders loop-unpaired banner", () => {
    render(
      <CanvasBanner type="loop-unpaired" nodeNames={["Loop 1"]} />
    );

    expect(screen.getByText(/loopUnpairedBannerMessage/)).toBeInTheDocument();
    expect(screen.getByText("Loop 1")).toBeInTheDocument();
  });

  it("renders collect-unresolved banner", () => {
    render(
      <CanvasBanner type="collect-unresolved" nodeNames={["Collect 1"]} />
    );

    expect(screen.getByText(/collectUnresolvedBannerMessage/)).toBeInTheDocument();
    expect(screen.getByText("Collect 1")).toBeInTheDocument();
  });

  it("renders loop-nesting-depth banner", () => {
    render(
      <CanvasBanner type="loop-nesting-depth" />
    );

    expect(screen.getByText(/loopNestingDepthBannerMessage/)).toBeInTheDocument();
  });

  it("renders subchain-invalid banner with node names", () => {
    render(
      <CanvasBanner type="subchain-invalid" nodeNames={["Sub-chain 1"]} />
    );

    expect(screen.getByText(/subchainInvalidBannerMessage/)).toBeInTheDocument();
    expect(screen.getByText("Sub-chain 1")).toBeInTheDocument();
  });

  it("renders dismiss button when onDismiss is provided", () => {
    const mockDismiss = vi.fn();
    const { container } = render(
      <CanvasBanner type="cycle" nodeNames={["A"]} onDismiss={mockDismiss} />
    );

    const dismissButton = container.querySelector('button[aria-label="dismissBanner"]');
    expect(dismissButton).toBeInTheDocument();
  });

  it("has destructive styling", () => {
    const { container } = render(
      <CanvasBanner type="merge" nodeNames={["Merge"]} />
    );

    const banner = container.querySelector('[role="status"]');
    expect(banner).toHaveClass("bg-destructive/10", "text-destructive");
  });

  it("has aria-live='polite' for accessibility", () => {
    const { container } = render(
      <CanvasBanner type="cycle" nodeNames={["A"]} />
    );

    const banner = container.querySelector('[role="status"]');
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});
