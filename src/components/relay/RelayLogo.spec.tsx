/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RelayLogo } from "./RelayLogo";

afterEach(() => {
  cleanup();
});

describe("RelayLogo", () => {
  it("renders an SVG with data-testid", () => {
    render(<RelayLogo />);
    const logo = screen.getByTestId("relay-logo");
    expect(logo).toBeInTheDocument();
    expect(logo.tagName).toBe("svg");
  });

  it("applies default size class when no className provided", () => {
    render(<RelayLogo />);
    const logo = screen.getByTestId("relay-logo");
    expect(logo).toHaveClass("size-4");
  });

  it("applies custom className along with defaults", () => {
    render(<RelayLogo className="size-6 text-red-500" />);
    const logo = screen.getByTestId("relay-logo");
    expect(logo).toHaveClass("size-6");
    expect(logo).toHaveClass("text-red-500");
    expect(logo).toHaveClass("shrink-0");
  });

  it("uses currentColor for stroke", () => {
    render(<RelayLogo />);
    const logo = screen.getByTestId("relay-logo");
    expect(logo).toHaveAttribute("stroke", "currentColor");
  });

  it("is marked as decorative when used next to text (no label)", () => {
    render(<RelayLogo />);
    const logo = screen.getByTestId("relay-logo");
    expect(logo).toHaveAttribute("aria-hidden", "true");
    expect(logo).not.toHaveAttribute("role");
    expect(logo).not.toHaveAttribute("aria-label");
  });

  it("has an accessible name when label is provided", () => {
    render(<RelayLogo label="Relay chat" />);
    const logo = screen.getByTestId("relay-logo");
    expect(logo).toHaveAttribute("role", "img");
    expect(logo).toHaveAttribute("aria-label", "Relay chat");
    expect(logo).not.toHaveAttribute("aria-hidden");
  });

  it("includes title element when label is provided", () => {
    render(<RelayLogo label="Relay chat" />);
    const logo = screen.getByTestId("relay-logo");
    const title = logo.querySelector("title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Relay chat");
  });

  it("does not include title element when label is not provided", () => {
    render(<RelayLogo />);
    const logo = screen.getByTestId("relay-logo");
    const title = logo.querySelector("title");
    expect(title).not.toBeInTheDocument();
  });

  it("renders all three path elements for the paper plane glyph", () => {
    render(<RelayLogo />);
    const logo = screen.getByTestId("relay-logo");
    const paths = logo.querySelectorAll("path");
    expect(paths).toHaveLength(3);
    // Verify the paths contain the expected arc geometry
    expect(paths[0].getAttribute("d")).toBe("M21.5 2.5 2.5 10l7 3.2 12-10.7Z");
    expect(paths[1].getAttribute("d")).toBe("m9.5 13.2 2 7.8 10-18.5");
    expect(paths[2].getAttribute("d")).toBe("m9.5 13.2 5 4");
  });

  it("has stroke properties for outline style", () => {
    render(<RelayLogo />);
    const logo = screen.getByTestId("relay-logo");
    expect(logo).toHaveAttribute("fill", "none");
    expect(logo).toHaveAttribute("stroke-width", "1.75");
    expect(logo).toHaveAttribute("stroke-linecap", "round");
    expect(logo).toHaveAttribute("stroke-linejoin", "round");
  });
});
