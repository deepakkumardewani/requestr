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

  it("renders protocol list in subhead", () => {
    mockReducedMotion(false);
    render(<Hero />);
    expect(
      screen.getByText(/HTTP, GraphQL, WebSocket and Socket\.IO/),
    ).toBeInTheDocument();
  });

  it("renders the microcopy line", () => {
    mockReducedMotion(false);
    render(<Hero />);
    expect(
      screen.getByText("No sign-up · No CORS errors · Open source"),
    ).toBeInTheDocument();
  });

  it("renders primary CTA with accessible label", () => {
    mockReducedMotion(false);
    render(<Hero />);
    expect(screen.getByRole("link", { name: /Open the app/i })).toHaveAttribute(
      "href",
      "/app",
    );
  });
});
