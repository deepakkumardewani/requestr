/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrustStrip } from "./TrustStrip";

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

describe("TrustStrip", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders benefit phrases in two opposing marquee rows", () => {
    mockReducedMotion(false);
    const { container } = render(<TrustStrip />);
    const rows = container.querySelectorAll("section > div");
    expect(rows.length).toBe(2);
    expect(screen.getAllByText(/No install/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Privacy-first/).length).toBeGreaterThan(0);
  });

  it("renders static legible text under reduced motion", () => {
    mockReducedMotion(true);
    render(<TrustStrip />);
    expect(screen.getAllByText(/Local-first/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Open in a tab/).length).toBeGreaterThan(0);
  });
});
