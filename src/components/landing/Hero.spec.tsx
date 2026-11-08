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

  it("renders the hybrid headline and a status tick", () => {
    mockReducedMotion(false);
    render(<Hero />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Send the request/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("hero-status")).toHaveTextContent("200 OK");
  });

  it("holds the status on 200 and lists the stages under reduced motion", () => {
    vi.useFakeTimers();
    mockReducedMotion(true);
    render(<Hero />);
    vi.advanceTimersByTime(10_000);
    expect(screen.getByTestId("hero-status")).toHaveTextContent("200 OK");
    expect(
      screen.getByRole("list", { name: "From request to test" }),
    ).toHaveTextContent(/Send.*Read.*Chain.*Relay/);
    vi.useRealTimers();
  });

  it("offers the demo entry", () => {
    mockReducedMotion(false);
    render(<Hero />);
    expect(
      screen.getByRole("button", { name: /Watch the demo/i }),
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
