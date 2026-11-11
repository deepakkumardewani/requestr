/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Feature } from "../data/features";
import { getFeaturePage } from "../data/seoPages";
import { FeatureCard } from "./FeatureCard";

const STATIC_FEATURE: Feature = {
  id: "static-one",
  title: "Static feature",
  description: "Has no detail page.",
};

const LINKED_FEATURE: Feature = {
  id: "linked-one",
  seoSlug: "json-compare",
  title: "Linked feature",
  description: "Has a detail page.",
};

describe("FeatureCard", () => {
  afterEach(cleanup);

  it("renders a feature without a seoSlug as static content", () => {
    render(<FeatureCard feature={STATIC_FEATURE} />);
    expect(screen.getByText("Static feature")).toBeInTheDocument();
    expect(screen.getByText("Has no detail page.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/learn more/i)).not.toBeInTheDocument();
  });

  it("wraps a feature with a seoSlug in a link to its page route", () => {
    render(<FeatureCard feature={LINKED_FEATURE} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", getFeaturePage("json-compare")?.route);
    expect(link).toHaveTextContent("Linked feature");
    expect(link).toHaveTextContent(/learn more/i);
  });

  it("does not link when the slug resolves to no page", () => {
    const unknown = { ...LINKED_FEATURE, seoSlug: "nope" } as unknown as Feature;
    render(<FeatureCard feature={unknown} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("applies a custom title class and defaults to text-lg", () => {
    const { rerender } = render(<FeatureCard feature={STATIC_FEATURE} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveClass("text-lg");
    rerender(<FeatureCard feature={STATIC_FEATURE} titleClassName="text-sm" />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveClass("text-sm");
  });

  it("renders the preview only when the feature has one", () => {
    const { container, rerender } = render(
      <FeatureCard feature={STATIC_FEATURE} />,
    );
    const without = container.querySelectorAll(".mb-3").length;
    rerender(<FeatureCard feature={{ ...STATIC_FEATURE, preview: "compare" }} />);
    expect(container.querySelectorAll(".mb-3").length).toBe(without + 1);
  });
});
