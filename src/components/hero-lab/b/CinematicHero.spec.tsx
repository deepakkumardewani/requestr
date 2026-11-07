/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CinematicHero } from "./CinematicHero";

const mocks = vi.hoisted(() => ({
  reduced: false,
  choreography: { progress: 0, stage: 0, inView: true },
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => mocks.reduced,
}));
vi.mock("./useScrollChoreography", () => ({
  useScrollChoreography: () => mocks.choreography,
}));
vi.mock("@/components/landing/ProductVisual", () => ({
  ProductVisual: () => <div data-testid="product-visual" />,
}));

describe("CinematicHero", () => {
  beforeEach(() => {
    mocks.reduced = false;
    mocks.choreography = { progress: 0, stage: 0, inView: true };
  });
  afterEach(cleanup);

  it("renders the intro with a CTA to the app", () => {
    render(<CinematicHero />);
    expect(
      screen.getByRole("heading", { level: 1, name: /one scroll/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the app/i })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  describe("animated (pinned) mode", () => {
    it("shows only the first stage with the product visual at progress 0", () => {
      render(<CinematicHero />);
      expect(screen.getByTestId("hero-b-track")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Send" })).toBeInTheDocument();
      expect(screen.getByTestId("product-visual")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Read" })).toBeNull();
    });

    it("reflects progress on the progressbar", () => {
      mocks.choreography = { progress: 0.4, stage: 1, inView: true };
      render(<CinematicHero />);
      const bar = screen.getByRole("progressbar", {
        name: "Sequence progress",
      });
      expect(bar).toHaveAttribute("aria-valuenow", "40");
      expect(bar.firstElementChild).toHaveStyle({ width: "40%" });
    });

    it("shows the response stage lines", () => {
      mocks.choreography = { progress: 0.3, stage: 1, inView: true };
      render(<CinematicHero />);
      expect(screen.getByRole("heading", { name: "Read" })).toBeInTheDocument();
      expect(screen.getByText("200 OK · 142 ms")).toBeInTheDocument();
      expect(screen.queryByTestId("product-visual")).toBeNull();
    });

    it("shows the chain stage and the relay stage", () => {
      mocks.choreography = { progress: 0.6, stage: 2, inView: true };
      const { unmount } = render(<CinematicHero />);
      expect(screen.getByText("2 GET /me (uses token)")).toBeInTheDocument();
      unmount();

      mocks.choreography = { progress: 1, stage: 3, inView: true };
      render(<CinematicHero />);
      expect(screen.getByText("✓ passed status is 200")).toBeInTheDocument();
      expect(
        screen.getByRole("progressbar", { name: "Sequence progress" }),
      ).toHaveAttribute("aria-valuenow", "100");
    });
  });

  describe("reduced motion", () => {
    beforeEach(() => {
      mocks.reduced = true;
    });

    it("renders every stage stacked, with no pinned track or progressbar", () => {
      render(<CinematicHero />);
      expect(screen.queryByTestId("hero-b-track")).toBeNull();
      expect(screen.queryByRole("progressbar")).toBeNull();
      for (const title of ["Send", "Read", "Chain", "Relay"]) {
        expect(
          screen.getByRole("heading", { name: title }),
        ).toBeInTheDocument();
      }
      expect(screen.getByTestId("product-visual")).toBeInTheDocument();
      expect(screen.getByText("200 OK · 142 ms")).toBeInTheDocument();
    });
  });
});
