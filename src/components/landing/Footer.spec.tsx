/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOCS_URL, GITHUB_URL, LICENSE_URL } from "./constants";
import { Footer } from "./Footer";

describe("Footer", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("links Privacy and Terms to the legal pages", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("keeps the Docs link, opening externally and safely", () => {
    render(<Footer />);
    const docs = screen.getByRole("link", { name: "Docs" });
    expect(docs).toHaveAttribute("href", DOCS_URL);
    expect(docs).toHaveAttribute("target", "_blank");
    expect(docs).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("links GitHub and the MIT license externally", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      GITHUB_URL,
    );
    expect(
      screen.getByRole("link", { name: "License (MIT)" }),
    ).toHaveAttribute("href", LICENSE_URL);
  });

  it("links product entries to the app and landing anchors", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "App" })).toHaveAttribute(
      "href",
      "/app",
    );
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute(
      "href",
      "#features",
    );
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute(
      "href",
      "#compare",
    );
    expect(screen.getByRole("link", { name: "Requestr" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders the three column headings", () => {
    render(<Footer />);
    for (const title of ["Product", "Resources", "Legal"]) {
      expect(
        screen.getByRole("heading", { level: 3, name: title }),
      ).toBeInTheDocument();
    }
  });

  it("shows the copyright for the current year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-05-01T00:00:00Z"));
    render(<Footer />);
    expect(
      screen.getByText("© 2031 Requestr. Open source under MIT."),
    ).toBeInTheDocument();
  });
});
