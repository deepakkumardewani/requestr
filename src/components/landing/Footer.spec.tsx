/** @vitest-environment happy-dom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOCS_URL, GITHUB_URL, LICENSE_URL } from "./constants";
import { Footer } from "./Footer";
import {
  SIGN_OFF_LINE,
  SIGN_OFF_STATUS_CODE,
  SIGN_OFF_STATUS_TEXT,
} from "./footer/constants";

function linkLabels(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");
}

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

  it("lists App, Docs and License under Product, in that order", () => {
    render(<Footer />);
    const product = screen.getByRole("list", { name: "Product" });
    expect(linkLabels(product)).toEqual(["App", "Docs↗", "License (MIT)↗"]);
    expect(
      within(product).getByRole("link", { name: "App" }),
    ).toHaveAttribute("href", "/app");
  });

  it("opens Docs and License externally and safely", () => {
    render(<Footer />);
    const product = screen.getByRole("list", { name: "Product" });
    const docs = within(product).getByRole("link", { name: "Docs" });
    const license = within(product).getByRole("link", {
      name: "License (MIT)",
    });
    expect(docs).toHaveAttribute("href", DOCS_URL);
    expect(license).toHaveAttribute("href", LICENSE_URL);
    for (const link of [docs, license]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("has no GitHub link", () => {
    render(<Footer />);
    expect(screen.queryByRole("link", { name: /github/i })).toBeNull();
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).not.toContain(GITHUB_URL);
  });

  it("links the logo home", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Requestr" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("lists the features hub and exactly nine feature pages in the Features column", () => {
    render(<Footer />);
    const hrefs = within(screen.getByRole("list", { name: "Features" }))
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs[0]).toBe("/features");
    expect(hrefs.slice(1).sort()).toEqual([
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
    const compareLinks = within(
      screen.getByRole("list", { name: "Compare" }),
    ).getAllByRole("link");
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

  it("renders exactly the four column headings, with no Resources column", () => {
    render(<Footer />);
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Product", "Features", "Compare", "Legal"]);
    expect(screen.queryByRole("heading", { name: "Resources" })).toBeNull();
  });

  it("signs off with the 204 status line", () => {
    render(<Footer />);
    expect(
      screen.getByText(`${SIGN_OFF_STATUS_CODE} ${SIGN_OFF_STATUS_TEXT}`),
    ).toBeInTheDocument();
    expect(screen.getByText(SIGN_OFF_LINE)).toBeInTheDocument();
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
