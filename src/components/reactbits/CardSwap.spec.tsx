/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardSwap } from "./CardSwap";

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

describe("CardSwap", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders all cards when motion is enabled", () => {
    mockReducedMotion(false);
    render(
      <CardSwap>
        <div>card a</div>
        <div>card b</div>
        <div>card c</div>
      </CardSwap>,
    );
    expect(screen.getByText("card a")).toBeInTheDocument();
    expect(screen.getByText("card b")).toBeInTheDocument();
    expect(screen.getByText("card c")).toBeInTheDocument();
  });

  it("renders only the first card under reduced motion", () => {
    mockReducedMotion(true);
    render(
      <CardSwap>
        <div>card a</div>
        <div>card b</div>
      </CardSwap>,
    );
    expect(screen.getByText("card a")).toBeInTheDocument();
    expect(screen.queryByText("card b")).not.toBeInTheDocument();
  });
});
