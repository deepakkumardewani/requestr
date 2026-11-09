/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CommandPaletteSection } from "./CommandPaletteSection";
import {
  COMMAND_PALETTE_ALT,
  COMMAND_PALETTE_DARK_SRC,
  COMMAND_PALETTE_EYEBROW,
  COMMAND_PALETTE_HEADLINE,
  COMMAND_PALETTE_LEDE,
  COMMAND_PALETTE_LIGHT_SRC,
} from "./constants";

describe("CommandPaletteSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the heading, eyebrow and lede copy", () => {
    render(<CommandPaletteSection />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Do anything from one keystroke.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Command palette")).toBeInTheDocument();
    expect(screen.getByText(/Press one shortcut and type\./)).toBeInTheDocument();
  });

  it("uses the shared constants for the copy", () => {
    render(<CommandPaletteSection />);
    expect(screen.getByText(COMMAND_PALETTE_EYEBROW)).toBeInTheDocument();
    expect(screen.getByText(COMMAND_PALETTE_HEADLINE)).toBeInTheDocument();
    expect(screen.getByText(COMMAND_PALETTE_LEDE)).toBeInTheDocument();
  });

  it("has a stable id and is labelled by its heading", () => {
    const { container } = render(<CommandPaletteSection />);
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("id", "command-palette");
    expect(section).toHaveAttribute("aria-labelledby", "command-palette-title");
    expect(
      container.querySelector("#command-palette-title"),
    ).toHaveTextContent("Do anything from one keystroke.");
  });

  it("exposes the section as a named region", () => {
    render(<CommandPaletteSection />);
    expect(
      screen.getByRole("region", { name: "Do anything from one keystroke." }),
    ).toBeInTheDocument();
  });

  it("renders light and dark screenshots with non-empty alt text", () => {
    render(<CommandPaletteSection />);
    const images = screen.getAllByRole("img", { hidden: true });
    expect(images).toHaveLength(2);
    images.forEach((img) => {
      expect(img.getAttribute("alt")).toBeTruthy();
      expect(img).toHaveAttribute("alt", COMMAND_PALETTE_ALT);
    });
  });

  it("points the light and dark images at their theme sources", () => {
    render(<CommandPaletteSection />);
    const [light, dark] = screen.getAllByRole("img", { hidden: true });
    expect(light.getAttribute("src")).toContain("command-palette-light.webp");
    expect(dark.getAttribute("src")).toContain("command-palette-dark.webp");
    expect(COMMAND_PALETTE_LIGHT_SRC).toBe("/screens/command-palette-light.webp");
    expect(COMMAND_PALETTE_DARK_SRC).toBe("/screens/command-palette-dark.webp");
  });

  it("shows exactly one image per theme via CSS classes", () => {
    render(<CommandPaletteSection />);
    const [light, dark] = screen.getAllByRole("img", { hidden: true });
    expect(light).toHaveClass("dark:hidden");
    expect(light).not.toHaveClass("hidden");
    expect(dark).toHaveClass("hidden", "dark:block");
  });

  it("sets intrinsic dimensions on both images to avoid layout shift", () => {
    render(<CommandPaletteSection />);
    const images = screen.getAllByRole("img", { hidden: true });
    expect(images).toHaveLength(2);
    images.forEach((img) => {
      expect(img).toHaveAttribute("width", "1440");
      expect(img).toHaveAttribute("height", "900");
    });
  });
});
