/** @vitest-environment happy-dom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HERO_SUBLINE } from "./constants";
import { Hero } from "./Hero";

vi.mock("next/dynamic", () => ({
  // Invoke the loader so the lazy import factory is exercised; render nothing.
  default: (loader: () => Promise<unknown>) => {
    loader().catch(() => {});
    return () => null;
  },
}));

let resolvedTheme: string | undefined;
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme }),
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
    resolvedTheme = undefined;
    cleanup();
    vi.restoreAllMocks();
  });

  it("states Relay is built in and does what you do by hand", () => {
    mockReducedMotion(false);
    render(<Hero />);
    expect(
      screen.getByText(/Relay is built into the app and can do whatever/),
    ).toBeInTheDocument();
  });

  it("renders the hybrid headline and a status tick", () => {
    mockReducedMotion(false);
    render(<Hero />);
    expect(
      screen.getByRole("heading", { level: 1, name: /AI that does/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("hero-status")).toHaveTextContent("200 OK");
  });

  it("renders under the light theme", () => {
    resolvedTheme = "light";
    mockReducedMotion(false);
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("cycles the status through the response codes when motion is allowed", () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    render(<Hero />);
    const status = screen.getByTestId("hero-status");
    act(() => vi.advanceTimersByTime(2200));
    expect(status).toHaveTextContent("201 Created");
    act(() => vi.advanceTimersByTime(2200));
    expect(status).toHaveTextContent("404 Not Found");
    vi.useRealTimers();
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

  it("renders the full headline and the sub-line from the shared constant", () => {
    mockReducedMotion(false);
    render(<Hero />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("AI that does your API work.");
    expect(screen.getByText(HERO_SUBLINE)).toBeInTheDocument();
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
