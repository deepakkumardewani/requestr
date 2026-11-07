/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComparisonStatStrip } from "./ComparisonStatStrip";

const FORBIDDEN = /postman|insomnia|faster|slower|\d\s*[x×](?![a-z])|times/i;

describe("ComparisonStatStrip", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the four measured values on first render without timers advancing", () => {
    vi.useFakeTimers();
    render(<ComparisonStatStrip />);
    expect(screen.getByText("6.6 s")).toBeInTheDocument();
    expect(screen.getByText("759 KB")).toBeInTheDocument();
    expect(screen.getByText("0.2 s")).toBeInTheDocument();
    expect(screen.getByText("0 downloads")).toBeInTheDocument();
  });

  it("pairs each value with its label in a description list", () => {
    const { container } = render(<ComparisonStatStrip />);
    const terms = Array.from(container.querySelectorAll("dt")).map(
      (t) => t.textContent,
    );
    expect(terms).toEqual([
      "Largest contentful paint",
      "First-load JavaScript",
      "Time to first request",
      "Needed to start",
    ]);
    expect(container.querySelectorAll("dd")).toHaveLength(4);
    // A dd must follow its dt in the DOM; the value is shown first visually only
    for (const term of container.querySelectorAll("dt")) {
      expect(term.nextElementSibling?.tagName).toBe("DD");
    }
  });

  it("names the region and states when and how it was measured", () => {
    render(<ComparisonStatStrip />);
    const region = screen.getByRole("region", {
      name: "Measured Requestr speed",
    });
    expect(region.textContent).toContain(
      "Measured Nov 2026, production build, /app. Load metrics use mobile emulation; time to first request is measured on desktop.",
    );
  });

  it("never compares against competitors or leaks code references", () => {
    const { container } = render(<ComparisonStatStrip />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(/\bsrc\//);
    expect(text).not.toMatch(/\bcodeRef\b/);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
