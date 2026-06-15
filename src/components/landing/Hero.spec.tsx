/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

describe("Hero", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders protocol static fallback under reduced motion", () => {
    mockReducedMotion(true);
    render(<Hero />);
    expect(
      screen.getAllByText(/HTTP, GraphQL, WebSocket & Socket\.IO/).length,
    ).toBeGreaterThan(0);
  });

  it("renders CTA links with accessible labels", () => {
    mockReducedMotion(false);
    render(<Hero />);
    expect(screen.getByRole("link", { name: /Try it now/i })).toHaveAttribute(
      "href",
      "/app",
    );
    expect(
      screen.getByRole("link", { name: /See how it works/i }),
    ).toHaveAttribute("href", "#how-it-works");
  });
});
