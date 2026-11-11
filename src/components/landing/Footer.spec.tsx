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

  it("links the App and the logo", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "App" })).toHaveAttribute(
      "href",
      "/app",
    );
    expect(screen.getByRole("link", { name: "Requestr" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("lists the features hub and exactly nine feature pages in the Features column", () => {
    render(<Footer />);
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/features");
    const featureRoutes = hrefs.filter((h) => h?.startsWith("/features/"));
    expect(featureRoutes.sort()).toEqual([
      "/features/backup-restore",
      "/features/collections-environments",
      "/features/command-palette",
      "/features/import",
      "/features/json-compare",
      "/features/json-visualize",
      "/features/relay",
      "/features/request-chains",
      "/features/transform-playground",
    ]);
  });

  it("lists exactly the two compare pages in the Compare column", () => {
    render(<Footer />);
    const compareLinks = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("href")?.startsWith("/compare/"));
    expect(
      compareLinks.map((l) => [l.textContent, l.getAttribute("href")]),
    ).toEqual([
      ["Requestr vs Postman", "/compare/postman"],
      ["Requestr vs Insomnia", "/compare/insomnia"],
    ]);
  });

  it("no longer points at in-page landing anchors", () => {
    render(<Footer />);
    const anchors = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href?.startsWith("#"));
    expect(anchors).toEqual([]);
  });

  it("renders the five column headings", () => {
    render(<Footer />);
    for (const title of [
      "Product",
      "Features",
      "Compare",
      "Resources",
      "Legal",
    ]) {
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
