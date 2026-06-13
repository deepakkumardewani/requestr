/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BorderGlow } from "./BorderGlow";

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

describe("BorderGlow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders its children (motion enabled)", () => {
    mockReducedMotion(false);
    render(
      <BorderGlow>
        <span>card body</span>
      </BorderGlow>,
    );
    expect(screen.getByText("card body")).toBeInTheDocument();
  });

  it("renders children when reduced motion is set", () => {
    mockReducedMotion(true);
    render(
      <BorderGlow>
        <span>static card</span>
      </BorderGlow>,
    );
    expect(screen.getByText("static card")).toBeInTheDocument();
  });
});
